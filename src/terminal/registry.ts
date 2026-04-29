import { resumeData } from '../data/resume';
import { terminalThemes, type ThemeName } from './palette';
import type {
  CommandDefinition,
  CommandHelpItem,
  CommandOutcome,
  ViewDefinition,
  ViewStat,
} from './types';

export function createCommandRegistry(): {
  commands: CommandDefinition[];
  featuredCommands: CommandDefinition[];
} {
  const overviewView: ViewDefinition = {
    id: 'resume',
    route: 'resume',
    prompt: './resume --overview',
    eyebrow: 'Profile',
    title: 'Cloud systems, DevOps automation, and runtime engineering.',
    description:
      'A terminal-shaped portfolio backed by the current resume instead of one-off landing page copy.',
    note: resumeData.availability,
    theme: 'amber',
    logline: 'Loaded overview, resume signals, and current availability.',
    stats: buildSignalStats(),
    actions: [
      { label: 'Experience', command: 'experience' },
      { label: 'Skills', command: 'skills' },
      { label: 'Resume PDF', command: 'pdf' },
      { label: 'download', command: 'download' },
      { label: 'download --markdown', command: 'download --markdown' },
      { label: 'Ask', command: 'ask ' },
      { label: 'Email Chris', href: 'mailto:chris@pecunies.com' },
    ],
    sections: [
      {
        type: 'paragraphs',
        heading: 'Summary',
        body: [...resumeData.summary],
      },
      {
        type: 'metrics',
        heading: 'Signals',
        items: buildSignalStats(),
      },
      {
        type: 'note',
        heading: 'Current track',
        lines: [
          'Cloud work: AWS, Azure, GCP, OCI, CI/CD, Infrastructure as Code, workflow automation, and orchestration tooling.',
          'Production systems: blockchain infrastructure, GCP provisioning, observability tuning, GitOps hardening, and distributed transaction systems.',
          'Projects: a Zig WebAssembly runtime and a serverless AWS marketplace aggregator at moe.pecunies.com.',
        ],
      },
    ],
  };

  const experienceView: ViewDefinition = {
    id: 'experience',
    route: 'experience',
    prompt: './resume --experience',
    eyebrow: 'Work history',
    title: 'Four roles across blockchain infrastructure, distributed systems, cloud training, and research engineering.',
    description:
      'The work history moves from research-side engineering through AWS consulting into distributed systems and recent blockchain infrastructure work.',
    theme: 'frost',
    logline: 'Loaded timeline view across consulting, blockchain infra, and platform work.',
    actions: [
      { label: 'Resume', command: 'resume' },
      { label: 'Projects', command: 'projects' },
      { label: 'Contact', command: 'contact' },
    ],
    sections: [
      {
        type: 'timeline',
        heading: 'Experience',
        items: resumeData.experience.map((item) => ({
          role: item.role,
          company: item.company,
          location: item.location,
          period: item.period,
          summary: item.summary,
          bullets: item.bullets,
        })),
      },
    ],
  };

  const skillsView: ViewDefinition = {
    id: 'skills',
    route: 'skills',
    prompt: './resume --skills',
    eyebrow: 'Stack',
    title: 'Cloud platforms, runtime code, and product delivery.',
    description:
      "The infrastructure, application surfaces, runtime systems, data paths, and observability tools I've worked with.",
    theme: 'red',
    logline: 'Loaded grouped skills across languages, cloud, web, and observability.',
    actions: [
      { label: 'Projects', command: 'projects' },
      { label: 'Experience', command: 'experience' },
      { label: 'Themes', command: 'themes' },
    ],
    sections: [
      {
        type: 'tag-groups',
        heading: 'Skill groups',
        groups: resumeData.skills.map((group) => ({
          title: group.title,
          items: [...group.items],
          note: group.note,
        })),
      },
      {
        type: 'note',
        heading: 'Biases',
        lines: [
          'Strong preference for automated delivery, reproducible infrastructure, and production-friendly interfaces.',
          'Most comfortable when the system underneath the UI is still visible and measurable.',
        ],
      },
    ],
  };

  const projectsView: ViewDefinition = {
    id: 'projects',
    route: 'projects',
    prompt: './resume --projects',
    eyebrow: 'Independent work',
    title: 'Independent systems work and production-shaped prototypes.',
    description:
      'The project surface includes low-level runtime work, hardware-constrained infrastructure, and an API-driven marketplace integration prototype.',
    theme: 'red',
    logline: 'Loaded projects: Moe marketplace aggregation, Zig runtime work, and Raspberry Pi cluster ops.',
    actions: [
      { label: 'Skills', command: 'skills' },
      { label: 'Resume PDF', command: 'pdf' },
      { label: 'Contact', command: 'contact' },
    ],
    sections: [
      {
        type: 'projects',
        heading: 'Projects',
        items: resumeData.projects.map((project) => ({
          name: project.name,
          period: project.period,
          summary: project.summary,
          details: project.details,
          link: project.link,
        })),
      },
    ],
  };

  const educationView: ViewDefinition = {
    id: 'education',
    route: 'education',
    prompt: './resume --education',
    eyebrow: 'Education',
    title: 'University of Washington roots, plus research-side engineering work.',
    description:
      'Formal training came through materials science, but the applied work quickly bent toward data systems, APIs, scientific tooling, and software delivery.',
    theme: 'frost',
    logline: 'Loaded education and coursework context.',
    actions: [
      { label: 'Experience', command: 'experience' },
      { label: 'Resume', command: 'resume' },
    ],
    sections: [
      {
        type: 'education',
        heading: 'Education',
        item: { ...resumeData.education },
      },
      {
        type: 'note',
        heading: 'Context',
        lines: [
          'The academic track crossed over with research software engineering at GEMSEC.',
          'That overlap is where containerized apps, scientific APIs, and data-heavy tooling first became part of the portfolio.',
        ],
      },
    ],
  };

  const contactView: ViewDefinition = {
    id: 'contact',
    route: 'contact',
    prompt: './resume --contact',
    eyebrow: 'Reach out',
    title: 'Direct channels, no middleware.',
    description:
      'The site still behaves like a terminal, but the contact surface is straightforward: email, phone, links, and a PDF route when needed.',
    theme: 'amber',
    logline: 'Loaded contact channels and resume links.',
    actions: [
      { label: 'Email', href: 'mailto:chris@pecunies.com' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/chrispecunies', external: true },
      { label: 'GitHub', href: 'https://github.com/clpi', external: true },
      { label: 'GitLab', href: 'https://gitlab.com/clpi', external: true },
      { label: 'Resume PDF', command: 'pdf' },
    ],
    sections: [
      {
        type: 'contact',
        heading: 'Contact',
        items: resumeData.contact.map((item) => ({ ...item })),
      },
      {
        type: 'note',
        heading: 'Fit',
        lines: [
          'Open to platform engineering, DevOps, distributed systems, cloud architecture, and full-stack delivery work.',
          'Seattle-based and comfortable with remote or hybrid collaboration.',
        ],
      },
    ],
  };

  const pdfView: ViewDefinition = {
    id: 'pdf',
    route: 'resume-pdf',
    prompt: './resume --pdf',
    eyebrow: 'Document view',
    title: 'The exact resume, embedded without translation.',
    description:
      'This route keeps the terminal framing while showing the real two-page PDF directly inside the experience.',
    note: 'Use the page thumbnails for a quick scan or open the file in a new tab for the raw document.',
    theme: 'frost',
    logline: 'Loaded embedded resume PDF and page previews.',
    actions: [
      { label: 'download', command: 'download' },
      { label: 'download --markdown', command: 'download --markdown' },
      { label: 'Resume', command: 'resume' },
      { label: 'Contact', command: 'contact' },
    ],
    sections: [
      {
        type: 'pdf',
        heading: 'Resume PDF',
        src: resumeData.pdf.href,
        summary: 'Two-page PDF pulled directly from the latest resume file and styled inside the shell.',
        previews: resumeData.pdf.previews.map((preview) => ({ ...preview })),
      },
    ],
  };

  const timelineView: ViewDefinition = {
    id: 'timeline',
    route: 'timeline',
    prompt: './resume --timeline',
    eyebrow: 'Chronology',
    title: 'A single timeline for work, education, and projects.',
    description:
      'This view compresses the portfolio into chronological landmarks so the whole path is visible from one command.',
    theme: 'red',
    logline: 'Loaded combined timeline across education, work history, and projects.',
    actions: [
      { label: 'Projects', command: 'projects' },
      { label: 'Work', command: 'experience' },
      { label: 'Education', command: 'education' },
    ],
    sections: [
      {
        type: 'timeline',
        heading: 'Timeline',
        items: [
          ...resumeData.experience.map((item) => ({
            role: item.role,
            company: item.company,
            location: item.location,
            period: item.period,
            summary: item.summary,
            bullets: item.bullets.slice(0, 2),
          })),
          ...resumeData.projects.map((project) => ({
            role: project.name,
            company: 'Independent project',
            location: project.link?.href ?? 'Local / cloud',
            period: project.period,
            summary: project.summary,
            bullets: project.details.slice(0, 2),
          })),
          {
            role: resumeData.education.degree,
            company: resumeData.education.school,
            location: resumeData.education.location,
            period: resumeData.education.period,
            summary: 'Formal engineering background with software-heavy coursework and research overlap.',
            bullets: resumeData.education.highlights,
          },
        ],
      },
    ],
  };

  const linksView: ViewDefinition = {
    id: 'links',
    route: 'links',
    prompt: './resume --links',
    eyebrow: 'Links',
    title: 'External surfaces and live project endpoints.',
    description:
      'A compact link board for contact channels, source control, deployed projects, and the resume document.',
    theme: 'amber',
    logline: 'Loaded link board with GitHub, GitLab, LinkedIn, Moe, PDF, and Markdown resume.',
    actions: [
      { label: 'GitHub', href: 'https://github.com/clpi', external: true },
      { label: 'GitLab', href: 'https://gitlab.com/clpi', external: true },
      { label: 'SourceHut', href: 'https://sr.ht/~clp/', external: true },
      { label: 'Moe', href: 'https://moe.pecunies.com', external: true },
      { label: 'download', command: 'download' },
      { label: 'download --markdown', command: 'download --markdown' },
    ],
    sections: [
      {
        type: 'contact',
        heading: 'Links',
        items: [
          { label: 'GitHub', value: 'github.com/clpi', href: 'https://github.com/clpi' },
          { label: 'GitLab', value: 'gitlab.com/clpi', href: 'https://gitlab.com/clpi' },
          { label: 'SourceHut', value: 'sr.ht/~clp', href: 'https://sr.ht/~clp/' },
          { label: 'LinkedIn', value: 'linkedin.com/in/chrispecunies', href: 'https://linkedin.com/in/chrispecunies' },
          { label: 'Short site', value: 'clp.is', href: 'https://clp.is' },
          { label: 'Moe Marketplace', value: 'moe.pecunies.com', href: 'https://moe.pecunies.com' },
          { label: 'WASM Runtime', value: 'github.com/clpi/wart.git', href: 'https://github.com/clpi/wart.git' },
          { label: 'down.nvim', value: 'github.com/clpi/down.nvim.git', href: 'https://github.com/clpi/down.nvim.git' },
          { label: 'Ko-fi', value: 'ko-fi.com/clp', href: 'https://ko-fi.com/clp' },
          { label: 'X', value: 'x.com/clpif', href: 'https://x.com/clpif' },
          { label: 'Patreon', value: 'patreon.com/pecunies', href: 'https://patreon.com/pecunies' },
          { label: 'Open Collective', value: 'opencollective.com/clp', href: 'https://opencollective.com/clp' },
          { label: 'Cal.com', value: 'cal.com/chrisp', href: 'https://cal.com/chrisp' },
          { label: 'Calendly', value: 'calendly.com/pecunies', href: 'https://calendly.com/pecunies' },
          { label: 'Buy Me a Coffee', value: 'buymeacoffee.com/pecunies', href: 'https://buymeacoffee.com/pecunies' },
          { label: 'Instagram', value: 'instagram.com/chris.pecunies', href: 'https://www.instagram.com/chris.pecunies/' },
          { label: 'Facebook', value: 'facebook.com/chris.pecunies', href: 'https://www.facebook.com/chris.pecunies/' },
          { label: 'Resume PDF', value: resumeData.pdf.href, href: resumeData.pdf.href },
          { label: 'Resume Markdown', value: resumeData.pdf.markdownHref, href: resumeData.pdf.markdownHref },
        ],
      },
    ],
  };

  const postsView: ViewDefinition = {
    id: 'posts',
    route: 'posts',
    prompt: './posts --list',
    eyebrow: 'Posts',
    title: 'Chronological notes and essays.',
    description:
      'A lightweight post index for writing that will stay terminal-native and RSS-addressable.',
    note: 'RSS feed: /rss.xml',
    theme: 'ivory',
    logline: 'Loaded post index and RSS location.',
    actions: [
      { label: 'RSS', href: '/rss.xml', external: true },
      { label: 'About', command: 'about' },
      { label: 'Projects', command: 'projects' },
    ],
    sections: [
      {
        type: 'timeline',
        heading: 'Posts',
        items: [
          {
            role: 'Terminal portfolio changelog',
            company: 'pecunies.com',
            location: '/posts',
            period: '2026-04-29',
            summary:
              'Initial placeholder for terminal-native posts, RSS entries, and future technical writing.',
            bullets: [
              'Posts are listed chronologically from newest to oldest.',
              'The RSS feed is available at /rss.xml for readers and automation.',
            ],
          },
        ],
      },
    ],
  };

  const aboutView: ViewDefinition = {
    id: 'about',
    route: 'about',
    prompt: './terminal --about',
    eyebrow: 'About',
    title: 'A portfolio that behaves like a small operating system.',
    description:
      'This site is a one-page terminal emulator with command history, fake files, AI-assisted commands, games, metrics, and views rendered as terminal output.',
    theme: 'ivory',
    logline: 'Loaded about page for the terminal application.',
    actions: [
      { label: 'README', command: 'cat /README.md' },
      { label: 'TODO', command: 'cat /TODO.md' },
      { label: 'Commands', command: 'help' },
    ],
    sections: [
      {
        type: 'paragraphs',
        heading: 'Intent',
        body: [
          'The interface keeps the site minimal: one glass terminal, a command prompt, and content that appears where the command produced it.',
          'The visual layer uses a dark particle vortex, subtle parallax, glass surfaces, and theme-driven accents instead of conventional portfolio sections.',
          'The command registry is intentionally centralized so adding a new view or command does not require rewriting the shell.',
        ],
      },
      {
        type: 'note',
        heading: 'Architecture',
        lines: [
          'Static portfolio views live in the command registry.',
          'Stateful OS commands and AI context are handled by Cloudflare Pages Functions, Workers AI, and KV.',
          'The root OS files README.md and TODO.md document the current application and planned additions.',
        ],
      },
    ],
  };

  const staticViews = {
    about: aboutView,
    resume: overviewView,
    experience: experienceView,
    timeline: timelineView,
    skills: skillsView,
    projects: projectsView,
    education: educationView,
    links: linksView,
    posts: postsView,
    contact: contactView,
    pdf: pdfView,
  } as const;

  const commands: CommandDefinition[] = [];

  const buildHelpView = (): ViewDefinition => ({
    id: 'help',
    route: 'help',
    prompt: './terminal --help',
    eyebrow: 'Registry',
    title: 'Every interaction hangs off a single command registry.',
    description:
      'Add a new command by appending one definition to the registry file, then decide whether it returns a view or a one-off system response.',
    note: 'Leading slashes like /skills are accepted, and aliases like whoami still resolve cleanly.',
    theme: 'amber',
    logline: 'Loaded command registry and usage guide.',
    actions: [
      { label: 'Resume', command: 'resume' },
      { label: 'Experience', command: 'experience' },
      { label: 'Themes', command: 'themes' },
      { label: 'Full command list', command: 'commands' },
    ],
    sections: [
      {
        type: 'command-list',
        heading: 'Commands',
        items: commands.map<CommandHelpItem>((command) => ({
          name: command.name,
          usage: command.usage,
          description: command.description,
          command: command.name,
          group: command.group,
        })),
      },
      {
        type: 'note',
        heading: 'Extension path',
        lines: [
          'Static views are defined once and mapped to commands with a small helper.',
          'Custom behavior such as theme switching uses the same command interface and can still emit log messages or full views.',
          'Click any command card to run man <command>; the prompt is prefilled with that command for immediate use.',
        ],
      },
    ],
  });

  const buildThemesView = (currentTheme: ThemeName | null): ViewDefinition => ({
    id: 'themes',
    route: 'themes',
    prompt: './terminal --themes',
    eyebrow: 'Palette',
    title: 'Manual palette overrides sit on top of view-driven color modes.',
    description:
      'Leave the shell on auto to let each view steer the accent, or pin a palette for the whole session.',
    note: currentTheme
      ? `Current manual palette: ${terminalThemes[currentTheme].label}.`
      : 'Current palette mode: auto, driven by the active panel.',
    theme: currentTheme ?? 'ivory',
    logline: 'Loaded palette controls and theme options.',
    actions: [
      { label: 'theme red', command: 'theme red' },
      { label: 'theme amber', command: 'theme amber' },
      { label: 'theme frost', command: 'theme frost' },
      { label: 'theme ivory', command: 'theme ivory' },
      { label: 'theme auto', command: 'theme auto' },
    ],
    sections: [
      {
        type: 'metrics',
        heading: 'Available palettes',
        items: Object.entries(terminalThemes).map(([key, theme]) => ({
          label: key,
          value: theme.label,
          detail: key === currentTheme ? 'currently pinned' : 'available',
          command: `theme ${key}`,
        })),
      },
      {
        type: 'note',
        heading: 'Usage',
        lines: [
          'Use theme red, theme amber, theme frost, or theme ivory to pin the shell.',
          'Use theme auto to let each command view restore its own palette.',
        ],
      },
    ],
  });

  const buildSkillsCategoryView = (): ViewDefinition => ({
    ...skillsView,
    id: 'skills-category',
    prompt: './resume --skills --category',
    title: 'Skills grouped by category and depth.',
    description:
      'Category mode keeps the resume skill list grouped exactly by language, web, cloud, database, AI, and tooling areas.',
    logline: 'Loaded skills category breakdown.',
  });

  const buildSkillsApplicationsView = (): ViewDefinition => ({
    id: 'skills-applications',
    route: 'skills',
    prompt: './resume --skills --applications',
    eyebrow: 'Applied stack',
    title: 'Skills organized by how they get used.',
    description:
      'Application mode maps skills onto the kinds of systems they support: cloud delivery, APIs, runtime work, observability, and AI-assisted workflows.',
    theme: 'red',
    logline: 'Loaded skills applications breakdown.',
    actions: [
      { label: 'skills --category', command: 'skills --category' },
      { label: 'Projects', command: 'projects' },
      { label: 'Experience', command: 'experience' },
    ],
    sections: [
      {
        type: 'tag-groups',
        heading: 'Applications',
        groups: [
          {
            title: 'Cloud delivery',
            items: ['AWS', 'Azure', 'GCP', 'OCI', 'Terraform', 'Ansible', 'Kubernetes', 'AWS CDK'],
            note: 'Infrastructure, deployment, orchestration, and repeatable cloud architecture.',
          },
          {
            title: 'Application surfaces',
            items: ['TypeScript', 'React', 'Next.js', 'FastAPI', 'Django', 'Node.js', 'GraphQL', 'REST'],
            note: 'Interfaces and APIs connected directly to operational systems.',
          },
          {
            title: 'Runtime and distributed systems',
            items: ['Go', 'Rust', 'Zig', 'WebAssembly', 'gRPC', 'Protocol Buffers', 'SQL'],
            note: 'Lower-level execution, serialization, transaction systems, and networked services.',
          },
          {
            title: 'Observability and reliability',
            items: ['Grafana', 'Prometheus', 'PromQL', 'GitHub Actions', 'Jenkins', 'Docker', 'GitOps'],
            note: 'Delivery feedback, production visibility, and operational hardening.',
          },
          {
            title: 'AI-assisted workflows',
            items: ['Cloudflare Workers AI', 'OpenAI API', 'Anthropic API', 'LangChain', 'LangGraph', 'Codex'],
            note: 'Agentic tooling, AI APIs, and coding-assistant workflows.',
          },
        ],
      },
    ],
  });

  const addViewCommand = (
    name: keyof typeof staticViews,
    config: {
      aliases: string[];
      usage: string;
      group: string;
      featured?: boolean;
      description?: string;
    },
  ): void => {
    const view = staticViews[name];

    commands.push({
      name,
      aliases: config.aliases,
      usage: config.usage,
      group: config.group,
      route: view.route,
      featured: config.featured,
      description: config.description ?? view.description,
      execute(_context, args) {
        if (name === 'skills' && (args.includes('--category') || args.includes('--categories'))) {
          return { kind: 'view', view: buildSkillsCategoryView() };
        }

        if (name === 'skills' && args.includes('--applications')) {
          return { kind: 'view', view: buildSkillsApplicationsView() };
        }

        return { kind: 'view', view };
      },
    });
  };

  const addOsCommand = (
    name: string,
    config: {
      aliases?: string[];
      usage: string;
      group: string;
      featured?: boolean;
      description: string;
    },
  ): void => {
    commands.push({
      name,
      aliases: config.aliases ?? [],
      usage: config.usage,
      group: config.group,
      featured: config.featured,
      description: config.description,
      execute(_context, _args, raw) {
        return { kind: 'os', command: raw };
      },
    });
  };

  // Add a new command here and either point it at a view or return a custom outcome.
  addViewCommand('about', {
    aliases: ['site'],
    usage: 'about',
    group: 'Core',
    featured: true,
    description: 'Explain the terminal app, design, and architecture.',
  });

  addViewCommand('resume', {
    aliases: ['home'],
    usage: 'resume',
    group: 'Core',
    featured: true,
    description: 'Load the resume-backed landing view.',
  });

  addViewCommand('experience', {
    aliases: ['work'],
    usage: 'experience',
    group: 'Core',
    featured: true,
    description: 'Show the work timeline with role-by-role details.',
  });

  addViewCommand('timeline', {
    aliases: ['chronology'],
    usage: 'timeline',
    group: 'Core',
    featured: true,
    description: 'Show a combined timeline of work, projects, and education.',
  });

  addViewCommand('skills', {
    aliases: ['stack', 'tools'],
    usage: 'skills [--category|--applications]',
    group: 'Core',
    featured: true,
    description: 'List skill groups across languages, cloud, and observability.',
  });

  addViewCommand('projects', {
    aliases: ['builds'],
    usage: 'projects',
    group: 'Deep dive',
    featured: true,
    description: 'Open the independent project panel.',
  });

  addViewCommand('posts', {
    aliases: ['writing'],
    usage: 'posts',
    group: 'Core',
    featured: true,
    description: 'List chronological posts and expose the RSS feed.',
  });

  addViewCommand('links', {
    aliases: ['linktree'],
    usage: 'links',
    group: 'Core',
    featured: true,
    description: 'Open source-control, contact, project, and resume links.',
  });

  addViewCommand('education', {
    aliases: ['school'],
    usage: 'education',
    group: 'Deep dive',
    description: 'Show education background and coursework context.',
  });

  addViewCommand('contact', {
    aliases: ['hire'],
    usage: 'contact',
    group: 'Core',
    featured: true,
    description: 'Open direct contact channels and hiring context.',
  });

  addViewCommand('pdf', {
    aliases: ['cv', 'resume-pdf'],
    usage: 'pdf',
    group: 'Documents',
    featured: true,
    description: 'Embed the exact PDF resume in the terminal shell.',
  });

  commands.unshift({
    name: 'help',
    aliases: ['commands'],
    usage: 'help',
    group: 'Utility',
    route: 'help',
    description: 'Inspect the command registry and extension pattern.',
    execute() {
      return { kind: 'view', view: buildHelpView() };
    },
  });

  commands.push({
    name: 'commands',
    aliases: ['command-list'],
    usage: 'commands',
    group: 'Utility',
    route: 'help',
    featured: true,
    description: 'Open the full command list with descriptions and man-page shortcuts.',
    execute() {
      return { kind: 'view', view: buildHelpView() };
    },
  });

  commands.push({
    name: 'themes',
    aliases: ['palette'],
    usage: 'themes',
    group: 'Utility',
    route: 'themes',
    description: 'Preview the available shell palettes.',
    execute(context) {
      return { kind: 'view', view: buildThemesView(context.getTheme()) };
    },
  });

  commands.push({
    name: 'theme',
    aliases: [],
    usage: 'theme <red|amber|frost|ivory|auto>',
    group: 'Utility',
    description: 'Pin or clear a manual shell palette override.',
    execute(context, args): CommandOutcome {
      const next = args[0]?.toLowerCase() as ThemeName | 'auto' | 'view' | undefined;

      if (!next) {
        return {
          kind: 'system',
          text: 'Usage: theme <red|amber|frost|ivory|auto>',
          tone: 'warn',
        };
      }

      if (next === 'auto' || next === 'view') {
        context.setTheme(null);
        return {
          kind: 'system',
          text: 'Palette override cleared. Active views now control the shell accent.',
          tone: 'success',
        };
      }

      if (!(next in terminalThemes)) {
        return {
          kind: 'system',
          text: `Unknown palette "${next}". Try themes for the supported set.`,
          tone: 'warn',
        };
      }

      context.setTheme(next);
      return {
        kind: 'system',
        text: `Pinned palette: ${terminalThemes[next].label}.`,
        tone: 'success',
      };
    },
  });

  commands.push({
    name: 'download',
    aliases: ['dl'],
    usage: 'download [--markdown]',
    group: 'Documents',
    featured: true,
    description: 'Download the resume PDF or Markdown version.',
    execute(_context, args): CommandOutcome {
      return {
        kind: 'download',
        format: args.includes('--markdown') || args.includes('-m') ? 'markdown' : 'pdf',
        text: args.includes('--markdown') || args.includes('-m')
          ? 'Downloading resume markdown.'
          : 'Downloading resume PDF.',
        tone: 'success',
      };
    },
  });

  commands.push({
    name: 'shutdown',
    aliases: ['poweroff'],
    usage: 'shutdown',
    group: 'Window',
    description: 'Close the terminal window visually.',
    execute(): CommandOutcome {
      return {
        kind: 'window',
        action: 'shutdown',
        text: 'Terminal shutdown requested.',
        tone: 'warn',
      };
    },
  });

  commands.push({
    name: 'maximize',
    aliases: ['zoom'],
    usage: 'maximize',
    group: 'Window',
    description: 'Toggle the terminal between default and maximized size.',
    execute(): CommandOutcome {
      return {
        kind: 'window',
        action: 'maximize',
        text: 'Window maximize toggled.',
        tone: 'info',
      };
    },
  });

  commands.push({
    name: 'minimize',
    aliases: ['hide'],
    usage: 'minimize',
    group: 'Window',
    description: 'Minimize the terminal to the bottom dock icon.',
    execute(): CommandOutcome {
      return {
        kind: 'window',
        action: 'minimize',
        text: 'Window minimized.',
        tone: 'info',
      };
    },
  });

  commands.push({
    name: 'chat',
    aliases: ['ollama'],
    usage: 'chat',
    group: 'AI',
    route: 'chat',
    featured: true,
    description: 'Enter an AI chat session about Chris, his work history, and his projects.',
    execute() {
      return {
        kind: 'chat',
        text: 'Chat mode active. Ask about Chris, his work history, or projects. Type /exit to leave.',
        tone: 'success',
      };
    },
  });

  addOsCommand('ask', {
    usage: 'ask <question>',
    group: 'AI',
    featured: true,
    description: 'Ask Workers AI a question with terminal OS context.',
  });

  addOsCommand('explain', {
    usage: 'explain <project|skill|work|education|command> [name]',
    group: 'AI',
    featured: true,
    description: 'Explain projects, skills, work, education, or commands using Workers AI.',
  });

  addOsCommand('email', {
    usage: 'email <your email> <subject> <message>',
    group: 'Contact',
    description: 'Prepare an email to Chris with structured arguments.',
  });

  addOsCommand('book', {
    usage: 'book <your email> <date> <time> <duration> <message>',
    group: 'Contact',
    description: 'Request a meeting slot and notify both parties through the edge worker.',
  });

  addOsCommand('ls', {
    usage: 'ls [path]',
    group: 'OS',
    featured: false,
    description: 'List files in the portfolio OS.',
  });

  addOsCommand('cat', {
    usage: 'cat <path>',
    group: 'OS',
    featured: false,
    description: 'Read a file from the portfolio OS.',
  });

  addOsCommand('man', {
    usage: 'man <command>',
    group: 'OS',
    featured: false,
    description: 'Show command documentation.',
  });

  addOsCommand('whoami', {
    usage: 'whoami',
    group: 'OS',
    description: 'Print the current portfolio identity.',
  });

  addOsCommand('history', {
    usage: 'history',
    group: 'OS',
    description: 'Show persisted command history for this terminal session.',
  });

  addOsCommand('ps', {
    usage: 'ps',
    group: 'OS',
    description: 'List pseudo processes running in the terminal OS.',
  });

  addOsCommand('top', {
    usage: 'top',
    group: 'OS',
    description: 'Show pseudo live resource usage for the terminal OS.',
  });

  addOsCommand('pwd', {
    usage: 'pwd',
    group: 'OS',
    description: 'Print the current working directory.',
  });

  addOsCommand('echo', {
    usage: 'echo <text>',
    group: 'OS',
    description: 'Print arguments back to the terminal.',
  });

  addOsCommand('cp', {
    usage: 'cp <text>',
    group: 'OS',
    description: 'Copy text to the local clipboard and echo what was copied.',
  });

  addOsCommand('tree', {
    usage: 'tree [path]',
    group: 'OS',
    description: 'Print a tree view of the portfolio OS.',
  });

  addOsCommand('find', {
    usage: 'find <query>',
    group: 'OS',
    description: 'Find files and directories in the portfolio OS.',
  });

  addOsCommand('grep', {
    usage: 'grep <query>',
    group: 'OS',
    description: 'Search readable OS files for matching text.',
  });

  addOsCommand('touch', {
    usage: 'touch <path>',
    group: 'OS',
    description: 'Create an empty file in writable areas of the portfolio OS.',
  });

  addOsCommand('rm', {
    usage: 'rm <path>',
    group: 'OS',
    description: 'Remove a writable file; protected areas require sudo.',
  });

  addOsCommand('sudo', {
    usage: 'sudo <command>',
    group: 'OS',
    description: 'Run a protected filesystem command after password authentication.',
  });

  addOsCommand('su', {
    usage: 'su',
    group: 'OS',
    description: 'Start a short-lived root session after password authentication.',
  });

  addOsCommand('comment', {
    usage: 'comment <post> <name> <message>',
    group: 'OS',
    description: 'Add a viewer comment to a markdown post.',
  });

  addOsCommand('date', {
    usage: 'date',
    group: 'OS',
    description: 'Print current edge time.',
  });

  addOsCommand('curl', {
    usage: 'curl <url>',
    group: 'Network',
    description: 'Fetch a URL from the Cloudflare edge and print a short response.',
  });

  addOsCommand('ping', {
    usage: 'ping <host>',
    group: 'Network',
    description: 'Measure HTTP reachability from the Cloudflare edge.',
  });

  addOsCommand('weather', {
    usage: 'weather [location]',
    group: 'Network',
    description: 'Show current weather; defaults to Seattle, WA.',
  });

  addOsCommand('stock', {
    usage: 'stock <ticker>',
    group: 'Network',
    description: 'Show a compact market quote for a ticker.',
  });

  addOsCommand('trace', {
    usage: 'trace <website>',
    group: 'Network',
    description: 'Show a stylized route from the browser through Cloudflare to a site.',
  });

  addOsCommand('metrics', {
    usage: 'metrics',
    group: 'System',
    description: 'Show visits, page hits, command counts, and geographic breakdowns from KV.',
  });

  addOsCommand('leaderboard', {
    usage: 'leaderboard [game]',
    group: 'Games',
    description: 'Show high scores for 2048, chess, and minesweeper.',
  });

  addOsCommand('internet', {
    usage: 'internet [site]',
    group: 'Network',
    description: 'Open a tiny fake text-web browser with navigable terminal sites.',
  });

  addOsCommand('fzf', {
    usage: 'fzf [query]',
    group: 'OS',
    description: 'Fuzzy-find commands, files, projects, and views.',
  });

  commands.push({
    name: '2048',
    aliases: ['game'],
    usage: '2048',
    group: 'Games',
    featured: true,
    description: 'Boot a text-mode 2048 game in the terminal.',
    execute() {
      return {
        kind: 'game',
        game: '2048',
        text: '2048 booted. Use w/a/s/d to move, n for a new board, q to quit.',
        tone: 'success',
      };
    },
  });

  commands.push({
    name: 'chess',
    aliases: [],
    usage: 'chess',
    group: 'Games',
    featured: true,
    description: 'Boot a lightweight text-mode chess board.',
    execute() {
      return {
        kind: 'game',
        game: 'chess',
        text: 'Chess booted. Enter moves like e2e4, n for a new board, q to quit.',
        tone: 'success',
      };
    },
  });

  commands.push({
    name: 'minesweeper',
    aliases: ['mines'],
    usage: 'minesweeper',
    group: 'Games',
    featured: true,
    description: 'Boot a text-mode minesweeper board.',
    execute() {
      return {
        kind: 'game',
        game: 'minesweeper',
        text: 'Minesweeper booted. Use open A1, flag B2, n for new, q to quit.',
        tone: 'success',
      };
    },
  });

  commands.push({
    name: 'exit',
    aliases: ['quit'],
    usage: 'exit',
    group: 'AI',
    description: 'Exit the AI chat session and return to terminal commands.',
    execute() {
      return {
        kind: 'exit',
        text: 'Chat mode closed.',
        tone: 'info',
      };
    },
  });

  commands.push({
    name: 'clear',
    aliases: ['reset'],
    usage: 'clear',
    group: 'Utility',
    description: 'Clear the terminal window completely.',
    execute() {
      return {
        kind: 'clear',
      };
    },
  });

  return {
    commands,
    featuredCommands: commands.filter((command) => command.featured),
  };
}

function buildSignalStats(): ViewStat[] {
  return resumeData.signals.map((signal) => ({
    label: signal.label,
    value: signal.value,
    detail: signal.detail,
  }));
}
