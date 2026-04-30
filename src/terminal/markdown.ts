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
    return `<pre class="md-code-block" data-lang="${escapeHtml(language)}"><div class="md-code-block-head">${escapeHtml(language)}</div><code class="language-${escapeHtml(language)}">${highlighted}</code></pre>`;
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

function highlightCode(source: string, language: string): string {
  let html = escapeHtml(source);
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'sh', 'bash', 'zig', 'go', 'rs', 'py', 'md'].includes(language)) {
    html = html
      .replace(/(\/\/.*$)/gm, '<span class="tok-comment">$1</span>')
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="tok-string">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>')
      .replace(/\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|class|new|import|from|export|default|async|await|try|catch|throw|type|interface|public|private|protected|extends|implements|struct|enum|match|fn)\b/g, '<span class="tok-keyword">$1</span>');
  }
  return html;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
