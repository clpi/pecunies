export type FrontView = 'posts' | 'papers' | 'about' | 'legacy';

export function frontView(pathname: string): FrontView {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/posts' || path === '/index.html') return 'posts';
  if (path === '/papers') return 'papers';
  if (path === '/about' || path === '/contact') return 'about';
  return 'legacy';
}
