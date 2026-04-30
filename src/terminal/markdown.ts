import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

type FrontmatterMeta = {
  title?: string;
  date?: string;
  tags: string[];
  description?: string;
};

const PURIFY: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    'a', 'b', 'blockquote', 'br', 'button', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3', 'h4',
    'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub', 'sup',
    'table', 'tbody', 'td', 'th', 'thead', 'time', 'tr', 'ul',
  ],
  ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'data-command', 'data-lang', 'datetime', 'type', 'aria-label'],
  ALLOW_DATA_ATTR: false,
};

export function renderMarkdownToHtml(markdown: string): string {
  return renderMarkdownCore(markdown);
}

export function renderPostMarkdownToHtml(markdown: string): string {
  const { meta, body } = parseFrontmatter(markdown);
  const header = renderPostHeader(meta);
  return `${header}${renderMarkdownCore(body)}`;
}

function renderMarkdownCore(markdown: string): string {
  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }) => {
    const language = (lang || 'text').toLowerCase();
    const highlighted = highlightCode(text, language);
    const lineNumbers = buildLineNumbers(text);
    return `<pre class="md-code-block" data-lang="${escapeHtml(language)}"><div class="md-code-block-head"><span class="md-code-block-language">${escapeHtml(language)}</span><button type="button" class="md-code-copy-button" aria-label="Copy code" data-copy-code></button></div><div class="md-code-block-body"><span class="md-code-line-numbers" aria-hidden="true">${lineNumbers}</span><code class="language-${escapeHtml(language)}">${highlighted}</code></div></pre>`;
  };
  const raw = marked.parse(markdown, { async: false, renderer }) as string;
  return DOMPurify.sanitize(raw, PURIFY) as string;
}

function parseFrontmatter(markdown: string): { meta: FrontmatterMeta; body: string } {
  const meta: FrontmatterMeta = { tags: [] };
  if (!markdown.startsWith('---\n')) {
    return { meta, body: markdown };
  }
  const end = markdown.indexOf('\n---\n', 4);
  if (end < 0) {
    return { meta, body: markdown };
  }
  const frontmatter = markdown.slice(4, end).trim();
  const body = markdown.slice(end + 5);
  for (const line of frontmatter.split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    if (key === 'title') meta.title = value;
    if (key === 'date') meta.date = value;
    if (key === 'description') meta.description = value;
    if (key === 'tags') {
      meta.tags = value.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }
  return { meta, body };
}

function renderPostHeader(meta: FrontmatterMeta): string {
  const title = meta.title ? `<h1 class="post-frontmatter-title">${escapeHtml(meta.title)}</h1>` : '';
  const date = meta.date ? `<time class="post-frontmatter-date" datetime="${escapeHtml(meta.date)}">${escapeHtml(meta.date)}</time>` : '';
  const description = meta.description ? `<p class="post-frontmatter-description">${escapeHtml(meta.description)}</p>` : '';
  const tags = meta.tags.length
    ? `<div class="post-frontmatter-tags">${meta.tags
        .map((tag) => `<button type="button" class="content-tag" data-command="tags ${escapeHtml(tag)}" aria-label="Filter by tag ${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`)
        .join('')}</div>`
    : '';
  if (!title && !date && !description && !tags) return '';
  return `<header class="post-frontmatter">${title}${date}${description}${tags}</header>`;
}

const MAJOR_LANGS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'pyi',
  'go',
  'rs',
  'java', 'kt', 'kts', 'scala',
  'cs',
  'c', 'h', 'cpp', 'cc', 'cxx', 'hpp',
  'php', 'rb',
  'swift',
  'zig',
  'sh', 'bash', 'zsh', 'fish', 'ps1',
  'sql',
  'html', 'xml', 'svg',
  'css', 'scss', 'sass', 'less',
  'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'env',
  'dockerfile',
  'md', 'markdown',
]);

const LANG_ALIASES: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  python: 'py',
  golang: 'go',
  rust: 'rs',
  shell: 'sh',
  console: 'sh',
  powershell: 'ps1',
  csharp: 'cs',
  plaintext: 'text',
};

function highlightCode(source: string, language: string): string {
  const normalized = LANG_ALIASES[language] ?? language;
  const cleanSource = normalizeSourceForHighlight(source);
  if (!MAJOR_LANGS.has(normalized)) {
    return escapeHtml(cleanSource);
  }

  const placeholders: string[] = [];
  const stash = (raw: string, cls: string): string => {
    const idx = placeholders.push(`<span class="${cls}">${escapeHtml(raw)}</span>`) - 1;
    return `\u0000${idx}\u0000`;
  };

  // Preserve comments/strings first so later passes don't recolor internals.
  let raw = cleanSource
    .replace(/\/\*[\s\S]*?\*\//g, (m) => stash(m, 'tok-comment'))
    .replace(/(^|[^\\:])\/\/.*$/gm, (m) => stash(m, 'tok-comment'))
    .replace(/(^|\s)#.*$/gm, (m) => stash(m, 'tok-comment'))
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\[\s\S])*`)/g, (m) =>
      stash(m, 'tok-string'),
    );

  raw = escapeHtml(raw);

  // Numbers and booleans.
  raw = raw
    .replace(/\b(0x[a-fA-F0-9]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/g, '<span class="tok-number">$1</span>')
    .replace(/\b(true|false|null|undefined|None|nil)\b/g, '<span class="tok-constant">$1</span>');

  // Keywords shared by major languages.
  raw = raw.replace(
    /\b(abstract|as|asm|async|await|auto|break|case|catch|class|const|continue|crate|default|def|defer|del|do|elif|else|enum|except|export|extends|fallthrough|finally|fn|for|foreach|from|func|function|go|goto|if|implements|import|in|inline|interface|internal|is|lambda|let|loop|macro|match|module|mut|namespace|new|operator|out|override|package|pass|private|protected|pub|public|raise|readonly|ref|return|sealed|self|static|struct|super|switch|this|throw|trait|try|type|typeof|union|unsafe|use|using|var|virtual|void|volatile|where|while|with|yield)\b/g,
    '<span class="tok-keyword">$1</span>',
  );

  // Builtins and types.
  raw = raw
    .replace(/\b(Array|Boolean|Date|Error|Map|Math|Number|Object|Promise|RegExp|Set|String|Symbol|BigInt|JSON|console|process|window|document|printf|fmt|len|cap|make|append|panic|println|Vec|String|Result|Option|HashMap|HashSet|i8|i16|i32|i64|isize|u8|u16|u32|u64|usize|f32|f64|int|float|bool|char|str)\b/g, '<span class="tok-builtin">$1</span>')
    .replace(/\b([A-Z][A-Za-z0-9_]+)\b/g, '<span class="tok-type">$1</span>');

  // Functions, decorators, operators, punctuation.
  raw = raw
    .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, '<span class="tok-function">$1</span>')
    .replace(/(^|\s)(@[a-zA-Z_][a-zA-Z0-9_.-]*)/gm, '$1<span class="tok-decorator">$2</span>')
    .replace(/([+\-*/%!=<>|&^~?:]+)/g, '<span class="tok-operator">$1</span>')
    .replace(/([()[\]{}.,;])/g, '<span class="tok-punctuation">$1</span>');

  // Restore preserved comments/strings.
  raw = raw.replace(/\u0000(\d+)\u0000/g, (_m, i) => placeholders[Number(i)] ?? '');
  return raw;
}

function normalizeSourceForHighlight(source: string): string {
  let next = String(source ?? '');
  // If upstream content already contains our token spans, collapse them back to plain code first.
  next = next.replace(/<\/?span\b[^>]*>/gi, '');
  // Decode common escaped HTML entities so literal "&lt;span...&gt;" doesn't render as text noise.
  next = next
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
  return next;
}

function buildLineNumbers(source: string): string {
  const total = Math.max(1, String(source).split('\n').length);
  const lines: string[] = [];
  for (let i = 1; i <= total; i += 1) {
    lines.push(String(i));
  }
  return escapeHtml(lines.join('\n'));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
