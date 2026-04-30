import { readFile } from 'node:fs/promises';
import { onRequestPost } from '../functions/api/os.js';

const root = new URL('..', import.meta.url);

const checks = [];

function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
}

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

const renderSource = await text('src/terminal/render.ts');
const appSource = await text('src/terminal/app.ts');
const mainSource = await text('src/main.ts');
const registrySource = await text('src/terminal/registry.ts');
const cssSource = await text('src/style.css');

check('shell includes one terminal input', (renderSource.match(/id="terminal-input"/g) ?? []).length === 1);
check('shell closes terminal containers', renderSource.includes('</section>') && renderSource.includes('id="terminal-dock"'));
check('no visible combobox status copy', !/Use arrow keys|\\d+ results|cmdk|combobox/i.test(`${renderSource}\n${appSource}\n${cssSource}`));
check('autocomplete has filtering and tab completion', appSource.includes('buildSuggestions') && appSource.includes("event.key === 'Tab'"));
check('history handles arrow navigation', appSource.includes("event.key === 'ArrowUp'") && appSource.includes("event.key === 'ArrowDown'"));
check('ls is not shadowed by timeline alias', !/ls:\s*['"]timeline['"]/.test(appSource));
check('particles canvas mounted', renderSource.includes('id="field-canvas"') && mainSource.includes('mountParticleField'));
check('particles cannot intercept input', cssSource.includes('pointer-events: none') && cssSource.includes('.field-canvas'));
const navSequenceSource = renderSource.match(/const navSequence = \[[\s\S]*?\] as const;/)?.[0] ?? '';
check('navbar excludes contact and pdf links', !navSequenceSource.includes("'contact'") && !navSequenceSource.includes("'pdf'"));
check('navbar rss uses text label', renderSource.includes('aria-label="RSS feed">RSS</a>') && !renderSource.includes('◔'));
check('codeblock placeholders cannot render numeric sentinels', !/\\\\u0000\\$\\{idx\\}\\\\u0000/.test(await text('src/terminal/markdown.ts')));
check('codeblock line numbers start at one', (await text('src/terminal/markdown.ts')).includes('for (let i = 1; i <= total; i += 1)'));
check('codeblock CSS overrides inline code tint', cssSource.includes('.pretty-output.markdown-body .md-code-block code'));

for (const command of ['about', 'resume', 'projects', 'posts', 'links', 'chat']) {
  check(
    `navbar includes ${command}`,
    registrySource.includes(`name: "${command}"`) ||
      registrySource.includes(`name: '${command}'`) ||
      registrySource.includes(`addViewCommand("${command}"`) ||
      registrySource.includes(`addViewCommand('${command}'`),
  );
}

const store = new Map();
const env = {
  PECUNIES_SUDO_PASSWD: 'PECUnies797++',
  PORTFOLIO_OS: {
    async get(key, options) {
      const value = store.get(key);
      return options?.type === 'json' && value ? JSON.parse(value) : value ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = '' }) {
      return {
        keys: [...store.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
      };
    },
  },
  AI: {
    async run() {
      return { response: 'ok' };
    },
  },
};

async function os(command) {
  const request = new Request('https://local.test/api/os', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: 'sanity', command }),
  });
  const response = await onRequestPost({ request, env });
  return { status: response.status, body: await response.json() };
}

const pwd = await os('pwd');
check('command execution works', pwd.status === 200 && pwd.body.output === '/home/guest');

const ls = await os('ls');
check('ls lists current directory', ls.status === 200 && String(ls.body.output).includes('README.md'));

const top = await os('top');
check('top command dispatches', top.status === 200 && String(top.body.output).includes('portfolio-os top'));

const echoQuoted = await os('echo "hello world"');
check('echo strips shell quotes', echoQuoted.status === 200 && echoQuoted.body.output === 'hello world');

await os('export ECHO_TEST=ok');
const echoEnv = await os("echo '$ECHO_TEST' \"$ECHO_TEST\" $USER");
check('echo respects quote-aware env expansion', echoEnv.status === 200 && echoEnv.body.output === '$ECHO_TEST ok guest');

const echoEscapes = await os('echo -e "a\\nb"');
check('echo -e expands escapes', echoEscapes.status === 200 && echoEscapes.body.output === 'a\nb');

const echoGt = await os('echo "a > b"');
check('echo ignores redirection inside quotes', echoGt.status === 200 && echoGt.body.output === 'a > b');

const write = await os('echo hello > /guest/sanity.md');
const read = await os('cat /guest/sanity.md');
check('redirection writes user file', write.status === 200 && read.body.output === 'hello');

const immutable = await os('echo nope > /README.md');
check('static files are immutable', immutable.status === 403);

const unknown = await os('definitely-not-a-command');
check('unknown OS command returns helpful error', unknown.status === 404 && /Unknown OS command/.test(unknown.body.output));

const piped = await os('echo one|echo two');
check('pipe without spaces chains commands', piped.status === 200 && String(piped.body.output).includes('two'));

await os('echo echo sourced > /guest/source.sh');
const sourced = await os('source /guest/source.sh');
check('source runs shell commands from files', sourced.status === 200 && String(sourced.body.output).includes('sourced'));

const failed = checks.filter((entry) => !entry.ok);

for (const entry of checks) {
  console.log(`${entry.ok ? 'ok' : 'not ok'} - ${entry.name}${entry.detail ? `: ${entry.detail}` : ''}`);
}

if (failed.length) {
  process.exitCode = 1;
}
