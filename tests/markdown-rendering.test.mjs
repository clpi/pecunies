import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

const repoRoot = '/home/runner/work/pecunies/pecunies';

async function loadMarkdownRenderer() {
  const sourcePath = path.join(repoRoot, 'src/terminal/markdown.ts');
  const tempDir = path.join(repoRoot, 'tmp/test-modules');
  const tempPath = path.join(tempDir, `markdown-renderer-${process.pid}-${Date.now()}.mjs`);

  const source = await readFile(sourcePath, 'utf8');
  const patchedSource = source.replace(
    "import DOMPurify from 'dompurify';",
    "const DOMPurify = { sanitize: (html) => html };",
  );
  const compiled = ts.transpileModule(patchedSource, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText;

  await mkdir(tempDir, { recursive: true });
  await writeFile(tempPath, compiled, 'utf8');
  try {
    return await import(`file://${tempPath}`);
  } finally {
    await rm(tempPath, { force: true });
  }
}

test('TypeScript code fences render intact syntax tokens', async () => {
  const { renderMarkdownToHtml } = await loadMarkdownRenderer();
  const html = renderMarkdownToHtml('```ts\nconst x = 1;\n```');

  assert.match(html, /<span class="tok-keyword">const<\/span>/);
  assert.match(html, /<span class="tok-number">1<\/span>/);
  assert.doesNotMatch(html, /span class="tok-operator"><\/span>span class/);
});

test('shell code fences highlight cat and less commands without mangling paths', async () => {
  const { renderMarkdownToHtml } = await loadMarkdownRenderer();
  const html = renderMarkdownToHtml('```bash\ncat /README.md\nless /README.md\n```');

  assert.match(html, /<span class="tok-builtin">cat<\/span>/);
  assert.match(html, /<span class="tok-builtin">less<\/span>/);
  assert.doesNotMatch(html, /tok-type">README/);
});

test('markdown code fences highlight markdown syntax markers', async () => {
  const { renderMarkdownToHtml } = await loadMarkdownRenderer();
  const html = renderMarkdownToHtml('```md\n# Title\n- item\n[docs](/README.md)\n`inline`\n```');

  assert.match(html, /<span class="tok-keyword"># Title<\/span>/);
  assert.match(html, /<span class="tok-punctuation">-<\/span> item/);
  assert.match(html, /<span class="tok-function">\[docs\]<\/span><span class="tok-string">\(\/README\.md\)<\/span>/);
  assert.match(html, /<span class="tok-string">`inline`<\/span>/);
});
