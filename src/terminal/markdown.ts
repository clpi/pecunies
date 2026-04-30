import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const PURIFY: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'del',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    's',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul',
  ],
  ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class'],
  ALLOW_DATA_ATTR: false,
};

export function renderMarkdownToHtml(markdown: string): string {
  const raw = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(raw, PURIFY) as string;
}
