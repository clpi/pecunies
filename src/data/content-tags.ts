/**
 * Canonical tag index for views, OS files, posts, and commands.
 * Keep roughly in sync with TAGS in functions/api/os.js for CLI `tags` output.
 */

export type TagContentItem = {
  label: string;
  type: 'command' | 'view' | 'file' | 'link' | 'post' | 'dir' | 'section';
  command: string;
};

/** Tag slug → items carrying that tag */
export const TAG_INDEX: Record<string, TagContentItem[]> = {
  portfolio: [
    { label: 'About view', type: 'view', command: 'about' },
    { label: 'Resume view', type: 'view', command: 'resume' },
    { label: 'README.md', type: 'file', command: 'cat /README.md' },
    { label: 'TODO.md', type: 'file', command: 'cat /TODO.md' },
    { label: 'CHANGELOG.md', type: 'file', command: 'cat /CHANGELOG.md' },
    { label: 'system/man.txt', type: 'file', command: 'cat /system/man.txt' },
  ],
  terminal: [
    { label: 'About view', type: 'view', command: 'about' },
    { label: 'Help view', type: 'view', command: 'help' },
    { label: 'Themes view', type: 'view', command: 'themes' },
    { label: 'Tags browser', type: 'view', command: 'tags' },
    { label: 'clear', type: 'command', command: 'clear' },
    { label: 'man', type: 'command', command: 'man' },
  ],
  architecture: [{ label: 'About view', type: 'view', command: 'about' }],
  career: [
    { label: 'Resume view', type: 'view', command: 'resume' },
    { label: 'Experience view', type: 'view', command: 'experience' },
    { label: 'Timeline view', type: 'view', command: 'timeline' },
    { label: 'Contact view', type: 'view', command: 'contact' },
    { label: 'PDF view', type: 'view', command: 'pdf' },
    { label: 'resume.md', type: 'file', command: 'cat /resume/resume.md' },
    { label: 'explain work', type: 'command', command: 'explain work' },
    { label: 'explain education', type: 'command', command: 'explain education' },
  ],
  resume: [
    { label: 'Resume view', type: 'view', command: 'resume' },
    { label: 'PDF view', type: 'view', command: 'pdf' },
    { label: 'download', type: 'command', command: 'download' },
  ],
  skills: [
    { label: 'Skills view', type: 'view', command: 'skills' },
    { label: 'skills.md', type: 'file', command: 'cat /resume/skills.md' },
    { label: 'explain skill', type: 'command', command: 'explain skill' },
  ],
  projects: [
    { label: 'Projects view', type: 'view', command: 'projects' },
    { label: 'projects.md', type: 'file', command: 'cat /resume/projects.md' },
    { label: '/projects', type: 'dir', command: 'ls /projects' },
    { label: 'explain project market', type: 'command', command: 'explain project market' },
    { label: 'explain project wasm', type: 'command', command: 'explain project wasm' },
  ],
  engineering: [
    { label: 'Skills view', type: 'view', command: 'skills' },
    { label: 'Projects view', type: 'view', command: 'projects' },
    { label: 'About view', type: 'view', command: 'about' },
  ],
  chronology: [{ label: 'Timeline view', type: 'view', command: 'timeline' }],
  writing: [
    { label: 'Posts view', type: 'view', command: 'posts' },
    { label: 'Terminal portfolio changelog', type: 'post', command: 'cat /posts/2026/04/29/terminal-portfolio-changelog.md' },
    { label: 'posts/', type: 'dir', command: 'ls /posts' },
  ],
  content: [
    { label: 'Posts view', type: 'view', command: 'posts' },
    { label: 'README.md', type: 'file', command: 'cat /README.md' },
    { label: 'cat --pretty', type: 'command', command: 'cat --pretty /README.md' },
  ],
  links: [
    { label: 'Links view', type: 'view', command: 'links' },
    { label: 'contact.md', type: 'file', command: 'cat /contact.md' },
  ],
  social: [
    { label: 'Links view', type: 'view', command: 'links' },
    { label: 'Contact view', type: 'view', command: 'contact' },
    { label: 'comment', type: 'command', command: 'comment' },
  ],
  contact: [
    { label: 'Contact view', type: 'view', command: 'contact' },
    { label: 'email', type: 'command', command: 'email' },
    { label: 'book', type: 'command', command: 'book' },
  ],
  document: [
    { label: 'PDF view', type: 'view', command: 'pdf' },
    { label: 'download', type: 'command', command: 'download' },
  ],
  system: [
    { label: 'ps', type: 'command', command: 'ps' },
    { label: 'top', type: 'command', command: 'top' },
    { label: 'pwd', type: 'command', command: 'pwd' },
    { label: 'logs', type: 'command', command: 'logs' },
    { label: 'session', type: 'command', command: 'session' },
    { label: 'config', type: 'command', command: 'config' },
    { label: 'neofetch', type: 'command', command: 'neofetch' },
  ],
  cloud: [
    { label: 'weather', type: 'command', command: 'weather' },
    { label: 'Marketplace Aggregator', type: 'view', command: 'explain project market' },
    { label: 'trace', type: 'command', command: 'trace' },
  ],
  devops: [
    { label: 'Projects view', type: 'view', command: 'projects' },
    { label: 'Experience view', type: 'view', command: 'experience' },
    { label: 'grep', type: 'command', command: 'grep' },
    { label: 'docker (refs)', type: 'section', command: 'skills' },
  ],
  wasm: [
    { label: 'explain project wasm', type: 'command', command: 'explain project wasm' },
    { label: 'WASM project file', type: 'file', command: 'cat /projects/webassembly-runtime.md' },
  ],
  ai: [
    { label: 'ask', type: 'command', command: 'ask' },
    { label: 'chat', type: 'command', command: 'chat' },
    { label: 'explain', type: 'command', command: 'explain' },
  ],
  games: [
    { label: '2048', type: 'command', command: '2048' },
    { label: 'chess', type: 'command', command: 'chess' },
    { label: 'minesweeper', type: 'command', command: 'minesweeper' },
    { label: 'jobquest', type: 'command', command: 'jobquest' },
    { label: 'leaderboard', type: 'command', command: 'leaderboard' },
  ],
  network: [
    { label: 'curl', type: 'command', command: 'curl' },
    { label: 'ping', type: 'command', command: 'ping' },
    { label: 'dig', type: 'command', command: 'dig' },
    { label: 'internet', type: 'command', command: 'internet' },
  ],
  tooling: [
    { label: 'fzf', type: 'command', command: 'fzf' },
    { label: 'tree', type: 'command', command: 'tree' },
    { label: 'find', type: 'command', command: 'find' },
    { label: 'mkdir', type: 'command', command: 'mkdir' },
    { label: 'tags', type: 'command', command: 'tags' },
  ],
  theme: [
    { label: 'Themes view', type: 'view', command: 'themes' },
    { label: 'theme', type: 'command', command: 'theme' },
  ],
};

export function listTagSummaries(): { slug: string; count: number }[] {
  return Object.keys(TAG_INDEX)
    .sort()
    .map((slug) => ({ slug, count: TAG_INDEX[slug].length }));
}

export function getItemsForTag(slug: string): TagContentItem[] | null {
  const key = slug.toLowerCase();
  if (TAG_INDEX[key]) return TAG_INDEX[key];
  const partial = Object.keys(TAG_INDEX).filter((k) => k.includes(key) || k.startsWith(key));
  if (partial.length === 1) return TAG_INDEX[partial[0]];
  return null;
}

export function findTagsMatching(fragment: string): string[] {
  const f = fragment.toLowerCase();
  return Object.keys(TAG_INDEX)
    .filter((k) => k.includes(f) || k.startsWith(f))
    .sort();
}

const TAG_DESCRIPTIONS: Record<string, string> = {
  ai: 'AI-assisted behavior, prompts, model usage, and agent flows.',
  architecture: 'Architecture notes, system structure, and implementation design.',
  career: 'Professional history, work trajectory, and hiring context.',
  chronology: 'Timeline-oriented views across work, projects, and education.',
  cloud: 'Cloud platforms, infrastructure delivery, and hosted systems.',
  contact: 'Direct contact paths, booking, and outbound communication.',
  content: 'Posts, markdown content, files, and publishing surfaces.',
  devops: 'Automation, operations, delivery workflows, and platform maintenance.',
  document: 'Document-style outputs such as the resume and downloads.',
  engineering: 'General engineering capability, implementation depth, and systems work.',
  games: 'Interactive terminal games and related commands.',
  links: 'External links, profiles, public endpoints, and outbound references.',
  network: 'Networking tools, connectivity, reachability, and web traversal.',
  portfolio: 'Portfolio-wide pages, files, and public identity surfaces.',
  projects: 'Project pages, project files, and project-specific explainer commands.',
  resume: 'Resume views, export paths, and professional profile material.',
  skills: 'Skill views, skill files, and capability-related surfaces.',
  social: 'Social presence, comments, and public engagement surfaces.',
  system: 'Shell behavior, process/state inspection, and system-level utilities.',
  terminal: 'Terminal-native commands, shell UI, and interactive workflow surfaces.',
  theme: 'Theme palettes, palette switching, and visual shell modes.',
  tooling: 'Utility commands, search, navigation, and operator productivity tools.',
  wasm: 'WebAssembly-related project content and explainer commands.',
  writing: 'Posts, writing workflows, and text publishing surfaces.',
};

export function getTagDescription(slug: string): string {
  return (
    TAG_DESCRIPTIONS[slug.toLowerCase()] ??
    'Tag used to group related commands, views, files, and content.'
  );
}

/** Tags shown on `man` pages (OS commands) */
export const COMMAND_TAGS: Record<string, string[]> = {
  ask: ['ai', 'network', 'portfolio'],
  explain: ['ai', 'portfolio', 'career'],
  chat: ['ai', 'terminal'],
  model: ['ai', 'terminal'],
  context: ['ai', 'terminal'],
  ls: ['system', 'tooling'],
  cat: ['portfolio', 'content', 'tooling'],
  man: ['terminal', 'tooling'],
  tags: ['portfolio', 'tooling', 'terminal'],
  config: ['system', 'terminal'],
  theme: ['theme', 'terminal'],
  grep: ['tooling', 'devops'],
  find: ['tooling'],
  curl: ['network', 'cloud'],
  ping: ['network'],
  weather: ['cloud', 'network'],
  internet: ['network', 'games'],
  fzf: ['tooling', 'terminal'],
  sudo: ['system'],
  ps: ['system'],
  logs: ['system'],
  session: ['system'],
  email: ['contact', 'social'],
  book: ['contact', 'social'],
  download: ['resume', 'document'],
  clear: ['terminal'],
  neofetch: ['system', 'terminal'],
};
