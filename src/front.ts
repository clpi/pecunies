import { frontView } from './front-routes';

const view = frontView(location.pathname);
const get = (id: string) => document.getElementById(id)!;

function current(id: string, enabled: boolean) {
  const element = get(id);
  if (enabled) element.setAttribute('aria-current', 'page');
  else element.removeAttribute('aria-current');
}

if (view === 'legacy') {
  document.body.classList.remove('journal');
  document.documentElement.classList.add('crt-on');
  get('journal').hidden = true;
  get('app').hidden = false;

  const addLink = (rel: string, href: string, cors = false) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (cors) link.crossOrigin = 'anonymous';
    document.head.append(link);
  };
  addLink('icon', '/favicon.svg');
  addLink('preconnect', 'https://fonts.googleapis.com');
  addLink('preconnect', 'https://fonts.gstatic.com', true);
  addLink('stylesheet', 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Sora:wght@400;600;700;800&display=swap');

  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = '#050505';
  document.head.append(meta);
  void import('./main');
} else {
  const about = view === 'about';
  get('posts-view').hidden = about;
  get('about-view').hidden = !about;
  get('posts-list').hidden = view !== 'posts';
  get('papers-list').hidden = view !== 'papers';
  current('nav-posts', !about);
  current('nav-about', about);
  current('filter-posts', view === 'posts');
  current('filter-papers', view === 'papers');
  document.title = about ? 'Contact / About · Pecunies' :
    view === 'papers' ? 'Papers · Pecunies' : 'Posts · Pecunies';
}
