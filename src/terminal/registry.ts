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
    theme: 'ivory',
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
    theme: 'amber',
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
    theme: 'ivory',
    logline: 'Loaded contact channels and resume links.',
    actions: [
      { label: 'Email', href: 'mailto:chris@pecunies.com' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/chrispecunies', external: true },
      { label: 'GitHub', href: 'https://github.com/clpi', external: true },
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
      { label: 'Download PDF', href: resumeData.pdf.href, external: true },
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

  const staticViews = {
    resume: overviewView,
    experience: experienceView,
    skills: skillsView,
    projects: projectsView,
    education: educationView,
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
        })),
      },
      {
        type: 'note',
        heading: 'Usage',
        lines: [
          'Use theme amber, theme frost, or theme ivory to pin the shell.',
          'Use theme auto to let each command view restore its own palette.',
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
      execute() {
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
  addViewCommand('resume', {
    aliases: ['about', 'home'],
    usage: 'resume',
    group: 'Core',
    featured: true,
    description: 'Load the resume-backed landing view.',
  });

  addViewCommand('experience', {
    aliases: ['work', 'timeline'],
    usage: 'experience',
    group: 'Core',
    featured: true,
    description: 'Show the work timeline with role-by-role details.',
  });

  addViewCommand('skills', {
    aliases: ['stack', 'tools'],
    usage: 'skills',
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
    aliases: ['h'],
    usage: 'help',
    group: 'Utility',
    route: 'help',
    description: 'Inspect the command registry and extension pattern.',
    execute() {
      return { kind: 'view', view: buildHelpView() };
    },
  });

  addOsCommand('commands', {
    usage: 'commands',
    group: 'Utility',
    description: 'List all available terminal commands.',
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
    usage: 'theme <amber|frost|ivory|auto>',
    group: 'Utility',
    description: 'Pin or clear a manual shell palette override.',
    execute(context, args): CommandOutcome {
      const next = args[0]?.toLowerCase() as ThemeName | 'auto' | 'view' | undefined;

      if (!next) {
        return {
          kind: 'system',
          text: 'Usage: theme <amber|frost|ivory|auto>',
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
    usage: 'explain <project|skill|work|education>',
    group: 'AI',
    featured: true,
    description: 'Explain a project, skill set, work history, or education using Workers AI.',
  });

  addOsCommand('ls', {
    usage: 'ls [path]',
    group: 'OS',
    description: 'List files in the portfolio OS.',
  });

  addOsCommand('cat', {
    usage: 'cat <path>',
    group: 'OS',
    description: 'Read a file from the portfolio OS.',
  });

  addOsCommand('man', {
    usage: 'man <command>',
    group: 'OS',
    description: 'Show command documentation.',
  });

  addOsCommand('whoami', {
    usage: 'whoami',
    group: 'OS',
    description: 'Print the current portfolio identity plus your IP, geolocation, and browser.',
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
    description: 'HTTP traceroute to a website from the Cloudflare edge.',
  });

  addOsCommand('email', {
    usage: 'email <your-email> <subject> <message>',
    group: 'Utility',
    description: 'Send a message to chris@pecunies.com.',
  });

  addOsCommand('metrics', {
    usage: 'metrics',
    group: 'Utility',
    description: 'Show site visit analytics, page breakdowns, and command usage.',
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
        text: '2048 booted. Use w/a/s/d to move, n for a new board, q to quit.',
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
