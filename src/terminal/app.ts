import { resumeData } from '../data/resume';
import type { AmbientFieldHandle } from '../wasm';
import { terminalThemes, type ThemeName } from './palette';
import { renderLog, renderShell, renderView } from './render';
import type {
  CommandContext,
  CommandDefinition,
  CommandOutcome,
  LogTone,
  SessionLine,
  ViewDefinition,
} from './types';

type TerminalAppOptions = {
  root: HTMLElement;
  commands: CommandDefinition[];
  featuredCommands: CommandDefinition[];
};

type ExecuteOptions = {
  echo?: boolean;
  syncHash?: boolean;
  focus?: boolean;
  recordHistory?: boolean;
};

type Suggestion = {
  completion: string;
  usage: string;
  description: string;
  commandName?: string;
};

type OsResponse = {
  output?: string;
  error?: string;
  mode?: 'chat';
 };

type GameKind = '2048' | 'chess' | 'minesweeper';

type MinesCell = {
  mine: boolean;
  open: boolean;
  flag: boolean;
  count: number;
};

const ARG_COMMANDS = new Set([
  'ask',
  'book',
  'cat',
  'cp',
  'curl',
  'download',
  'echo',
  'email',
  'explain',
  'find',
  'fzf',
  'grep',
  'internet',
  'leaderboard',
  'ls',
  'man',
  'ping',
  'stock',
  'trace',
  'tree',
  'weather',
]);
const FILE_PATHS = [
  '/',
  '/README.md',
  '/TODO.md',
  '/app',
  '/guest',
  '/home',
  '/posts',
  '/posts/terminal-portfolio-changelog.md',
  '/resume',
  '/resume/resume.md',
  '/resume/skills.md',
  '/resume/projects.md',
  '/projects',
  '/projects/marketplace-aggregator.md',
  '/projects/pi-cluster.md',
  '/projects/webassembly-runtime.md',
  '/projects/down-nvim.md',
  '/contact.md',
  '/system/man.txt',
];
const DIRECTORY_PATHS = ['/', '/app', '/guest', '/home', '/posts', '/resume', '/projects', '/system'];
const ARG_HINTS: Record<string, Array<{ token: string; description: string }>> = {
  ask: [{ token: '<question>', description: 'question to answer with Workers AI' }],
  book: [
    { token: '<your email>', description: 'where the booking confirmation should go' },
    { token: '<date>', description: 'requested date, for example 2026-05-18' },
    { token: '<time>', description: 'requested local time, for example 14:30' },
    { token: '<duration>', description: 'meeting length, for example 30m' },
    { token: '<message>', description: 'short context for the meeting' },
  ],
  email: [
    { token: '<your email>', description: 'your email' },
    { token: '<subject>', description: 'subject line' },
    { token: '<message>', description: 'message body' },
  ],
  explain: [
    { token: '<project|skill|work|education|command>', description: 'category to explain' },
    { token: '<name>', description: 'specific target, for example market, pi, wasm, or ask' },
  ],
  trace: [{ token: '<website>', description: 'site to trace' }],
  weather: [{ token: '<location>', description: 'optional city; defaults to Seattle, WA' }],
  stock: [{ token: '<ticker>', description: 'market ticker' }],
  cp: [{ token: '<text>', description: 'text copied to clipboard' }],
  echo: [{ token: '<text>', description: 'text to print' }],
  find: [{ token: '<query>', description: 'file or directory search term' }],
  grep: [{ token: '<query>', description: 'text to search for in files' }],
  touch: [{ token: '<path>', description: 'file to create, for example /guest/note.md' }],
  rm: [{ token: '<path>', description: 'file to remove' }],
  sudo: [{ token: '<command>', description: 'command to run after password prompt' }],
  su: [{ token: '<password>', description: 'optional password to become root for 5 minutes' }],
  comment: [
    { token: '<post>', description: 'post slug, for example terminal-portfolio-changelog' },
    { token: '<name>', description: 'display name' },
    { token: '<message>', description: 'comment text' },
  ],
};

export class TerminalApp {
  private readonly root: HTMLElement;
  private readonly commands: CommandDefinition[];
  private readonly featuredCommands: CommandDefinition[];
  private readonly routeMap = new Map<string, CommandDefinition>();
  private readonly shellElement: HTMLElement;
  private readonly outputElement: HTMLElement;
  private readonly logElement: HTMLOListElement;
  private readonly viewElement: HTMLElement;
  private readonly inputElement: HTMLInputElement;
  private readonly formElement: HTMLFormElement;
  private readonly routeIndicator: HTMLElement;
  private readonly themeIndicator: HTMLElement;
  private readonly promptScramble: HTMLElement;
  private readonly statusScramble: HTMLElement;
  private readonly autocompletePanel: HTMLElement;
  private readonly autocompleteList: HTMLElement;
  private readonly promptLabel: HTMLElement;
  private readonly dockElement: HTMLButtonElement;

  private fieldHandle: AmbientFieldHandle | null = null;
  private manualTheme: ThemeName | null = null;
  private activeView: ViewDefinition | null = null;
  private lines: SessionLine[] = [];
  private suppressHashChange = false;
  private scrambleFrames = new WeakMap<HTMLElement, number>();
  private suggestions: Suggestion[] = [];
  private suggestionIndex = 0;
  private history: string[] = [];
  private historyIndex: number | null = null;
  private chatMode = false;
  private chatPending = false;
  private gameMode: GameKind | null = null;
  private pendingPrompt: 'ask' | null = null;
  private sensitiveNextInput = false;
  private gameBoard: number[][] = [];
  private gameScore = 0;
  private chessBoard: string[][] = [];
  private chessMoves = 0;
  private minesBoard: MinesCell[][] = [];
  private minesOpenCount = 0;
  private minesGameOver = false;
  private pendingScore: { game: GameKind; score: number } | null = null;
  private readonly sessionId: string;

  constructor({ root, commands, featuredCommands }: TerminalAppOptions) {
    this.root = root;
    this.commands = commands;
    this.featuredCommands = featuredCommands;
    this.sessionId = this.getSessionId();
    this.root.innerHTML = renderShell({ featuredCommands });

    this.shellElement = this.requireElement<HTMLElement>('#terminal-shell');
    this.outputElement = this.requireElement<HTMLElement>('.terminal-output');
    this.logElement = this.requireElement<HTMLOListElement>('#terminal-log');
    this.viewElement = this.requireElement<HTMLElement>('#active-view');
    this.inputElement = this.requireElement<HTMLInputElement>('#terminal-input');
    this.formElement = this.requireElement<HTMLFormElement>('#terminal-form');
    this.routeIndicator = this.requireElement<HTMLElement>('#route-indicator');
    this.themeIndicator = this.requireElement<HTMLElement>('#theme-indicator');
    this.promptScramble = this.requireElement<HTMLElement>('#prompt-scramble');
    this.statusScramble = this.requireElement<HTMLElement>('#status-scramble');
    this.autocompletePanel = this.requireElement<HTMLElement>('#autocomplete-panel');
    this.autocompleteList = this.requireElement<HTMLElement>('#autocomplete-list');
    this.promptLabel = this.requireElement<HTMLElement>('#terminal-prompt-label');
    this.dockElement = this.requireElement<HTMLButtonElement>('#terminal-dock');

    for (const command of this.commands) {
      if (command.route) {
        this.routeMap.set(command.route, command);
      }
    }
    this.restorePersistedHistory();

    this.formElement.addEventListener('submit', (event) => {
      event.preventDefault();

      const raw = this.inputElement.value.trim();
      let submitted = raw;

      if (this.pendingPrompt && raw && !raw.startsWith('/')) {
        submitted = `${this.pendingPrompt} ${raw}`;
        this.pendingPrompt = null;
        this.promptLabel.textContent = 'chris@pecunies:~$';
      }

      if (!submitted) {
        return;
      }

      if (this.chatMode && !this.shouldRunCommandInChat(submitted)) {
        this.pushHistory(submitted);
        void this.sendChat(submitted);
      } else {
        this.execute(submitted, {
          echo: !this.sensitiveNextInput,
          recordHistory: !this.sensitiveNextInput,
        });
      }
      this.sensitiveNextInput = false;
      this.inputElement.value = '';
      this.historyIndex = null;
      this.hideAutocomplete();
    });

    this.inputElement.addEventListener('input', () => {
      this.updateAutocomplete();
    });

    this.inputElement.addEventListener('blur', () => {
      window.setTimeout(() => {
        this.hideAutocomplete();
      }, 120);
    });

    this.inputElement.addEventListener('keydown', (event) => {
      if (!this.suggestions.length) {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          this.restoreHistory(-1);
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          this.restoreHistory(1);
          return;
        }

        if (event.key === 'Escape') {
          this.hideAutocomplete();
        }

        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.suggestionIndex = (this.suggestionIndex + 1) % this.suggestions.length;
        this.renderAutocomplete();
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.suggestionIndex =
          (this.suggestionIndex - 1 + this.suggestions.length) % this.suggestions.length;
        this.renderAutocomplete();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        const completion = this.selectedCompletion();

        if (!completion) {
          return;
        }

        this.inputElement.value = completion;
        this.inputElement.setSelectionRange(completion.length, completion.length);
        this.updateAutocomplete();
        return;
      }

      if (event.key === 'Escape') {
        this.hideAutocomplete();
      }
    });

    this.shellElement.addEventListener('click', (event) => {
      const target = event.target;

      if (
        target instanceof HTMLElement &&
        target.closest('button, a, input, iframe, [data-command], [data-suggestion-value]')
      ) {
        return;
      }

      this.inputElement.focus();
    });

    this.root.addEventListener('click', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const windowAction = target.closest<HTMLElement>('[data-window-action]')?.dataset.windowAction;

      if (windowAction === 'shutdown' || windowAction === 'minimize' || windowAction === 'maximize') {
        this.execute(windowAction);
        return;
      }

      if (target.closest('#terminal-dock')) {
        this.restoreWindow();
        return;
      }

      const manCommand = target.closest<HTMLElement>('[data-man-command]')?.dataset.manCommand;

      if (manCommand) {
        this.execute(`man ${manCommand}`);
        this.inputElement.value = manCommand;
        this.inputElement.setSelectionRange(manCommand.length, manCommand.length);
        this.inputElement.focus();
        this.hideAutocomplete();
        return;
      }

      const suggestion = target.closest<HTMLElement>('[data-suggestion-value]')?.dataset.suggestionValue;

      if (suggestion) {
        this.acceptSuggestion(suggestion);
        this.hideAutocomplete();
        return;
      }

      const command = target.closest<HTMLElement>('[data-command]')?.dataset.command;

      if (!command) {
        return;
      }

      this.execute(command);
      const prepopulate = target.closest<HTMLElement>('[data-prepopulate-command]')?.dataset.prepopulateCommand;
      this.inputElement.value = prepopulate ?? '';
      if (prepopulate) {
        this.inputElement.setSelectionRange(prepopulate.length, prepopulate.length);
      }
      this.hideAutocomplete();
    });

    window.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.inputElement.focus();
        this.inputElement.select();
      }
    });

    window.addEventListener('hashchange', () => {
      if (this.suppressHashChange) {
        return;
      }

      const command = this.routeMap.get(this.readRoute());

      if (!command) {
        return;
      }

      this.execute(command.name, {
        echo: false,
        syncHash: false,
        focus: false,
      });
    });

    this.setupPointerDepth();
  }

  boot(): void {
    const routeCommand = this.routeMap.get(this.readRoute());

    if (routeCommand) {
      this.execute(routeCommand.name, {
        echo: false,
        syncHash: false,
        focus: false,
      });
      return;
    }

    this.execute('resume', {
      echo: false,
      syncHash: true,
      focus: false,
    });
  }

  attachFieldHandle(handle: AmbientFieldHandle): void {
    this.fieldHandle = handle;

    if (this.activeView) {
      this.applyTheme(this.effectiveTheme(this.activeView));
    }
  }

  private execute(rawInput: string, options: ExecuteOptions = {}): void {
    const echo = options.echo ?? true;
    const syncHash = options.syncHash ?? true;
    const focus = options.focus ?? true;
    const recordHistory = options.recordHistory ?? echo;
    const normalized = rawInput.trim();

    if (!normalized) {
      return;
    }

    if (this.gameMode && this.shouldHandleAsGameInput(normalized)) {
      if (echo) {
        this.lines.push(this.commandLine(normalized));
      }

      this.handleGameInput(normalized);
      this.renderLog();

      if (focus) {
        this.inputElement.focus();
      }

      return;
    }

    if (this.gameMode) {
      this.gameMode = null;
      this.promptLabel.textContent = 'chris@pecunies:~$';
      this.lines.push(this.responseLine('Game session closed; running terminal command.', 'info'));
    }

    const { name, args } = this.parseCommand(normalized);
      const command = this.resolveCommand(name);

      if (echo) {
        this.lines.push(this.commandLine(normalized));
      }

      if (recordHistory) {
        this.pushHistory(normalized);
      }

      if (!command) {
      void this.recordCommand(normalized);
      const suggestion = this.closestCommands(name);
      const suffix = suggestion.length ? ` Try ${suggestion.join(', ')}.` : ' Try help.';
      this.lines.push(this.responseLine(`Unknown command "${name}".${suffix}`, 'warn'));
      this.renderLog();

      if (focus) {
        this.inputElement.focus();
      }

      return;
    }

    if (name === 'ask' && !args.length) {
      this.pendingPrompt = 'ask';
      this.promptLabel.textContent = 'ask?>';
      this.lines.push(this.responseLine('Question:', 'info'));
      this.renderLog();

      if (focus) {
        this.inputElement.focus();
      }

      return;
    }

    const outcome = command.execute(this.commandContext(), args, normalized);
    if (outcome.kind === 'os') {
      this.copyIfClipboardCommand(outcome.command);
      void this.sendOsCommand(outcome.command);
      return;
    }

    void this.recordCommand(normalized);
    this.applyOutcome(outcome, command, syncHash);
    this.renderLog();

    if (focus) {
      this.inputElement.focus();
    }
  }

  private applyOutcome(outcome: CommandOutcome, command: CommandDefinition, syncHash: boolean): void {
    if (outcome.kind === 'clear') {
      this.clearTerminal();
      this.renderLog();
      this.inputElement.focus();
      this.writeRoute('');
      return;
    }

    if (outcome.kind === 'chat') {
      this.chatMode = true;
      this.gameMode = null;
      this.promptLabel.textContent = 'chat>';
      this.routeIndicator.textContent = '~/chat';
      this.themeIndicator.textContent = 'workers-ai';
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? 'success'));
      this.applyTheme(this.manualTheme ?? 'red');

      if (syncHash) {
        this.writeRoute(command.route ?? 'chat');
      }

      return;
    }

    if (outcome.kind === 'exit') {
      this.chatMode = false;
      this.gameMode = null;
      this.promptLabel.textContent = 'chris@pecunies:~$';
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? 'info'));
      return;
    }

    if (outcome.kind === 'game') {
      this.chatMode = false;
      this.startGame(outcome.game);
      this.promptLabel.textContent = `${outcome.game}>`;
      this.routeIndicator.textContent = `~/${outcome.game}`;
      this.themeIndicator.textContent = 'tui';
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? 'success'));
      this.lines.push(this.responseLine(this.renderGame(), 'info'));
      void this.sendOsCommand(`leaderboard ${outcome.game}`);
      return;
    }

    if (outcome.kind === 'system') {
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? 'info'));

      if (this.activeView) {
        this.applyTheme(this.effectiveTheme(this.activeView));
      }

      return;
    }

    if (outcome.kind === 'window') {
      this.lines.push(this.responseLine(outcome.text ?? outcome.action, outcome.tone ?? 'info'));
      this.applyWindowAction(outcome.action);
      return;
    }

    if (outcome.kind === 'download') {
      this.lines.push(this.responseLine(outcome.text ?? 'Downloading resume.', outcome.tone ?? 'success'));
      this.downloadResume(outcome.format);
      return;
    }

    if (outcome.kind === 'os') {
      this.copyIfClipboardCommand(outcome.command);
      void this.sendOsCommand(outcome.command);
      return;
    }

    this.activeView = outcome.view;
    this.chatMode = false;
    this.gameMode = null;
    this.promptLabel.textContent = 'chris@pecunies:~$';
    this.lines.push(this.responseLine(outcome.view.logline, outcome.tone ?? 'success'));
    const viewHtml = renderView(outcome.view);
    this.viewElement.innerHTML = '';
    this.lines.push({
      id: this.makeId(),
      kind: 'view',
      html: viewHtml,
      text: this.viewText(outcome.view),
    });
    this.routeIndicator.textContent = `~/${outcome.view.route}`;
    this.scrambleText(this.promptScramble, outcome.view.prompt);
    this.scrambleText(this.statusScramble, outcome.view.description);
    this.applyTheme(this.effectiveTheme(outcome.view));
    void this.recordMetric(outcome.view.route);
    this.pulseView();

    if (outcome.view.id === 'posts') {
      void this.loadPosts();
    }

    if (syncHash) {
      this.writeRoute(command.route ?? outcome.view.route);
    }
  }

  private applyTheme(themeName: ThemeName): void {
    const theme = terminalThemes[themeName];

    document.documentElement.style.setProperty('--bg', theme.depth);
    document.documentElement.style.setProperty('--panel', theme.panel);
    document.documentElement.style.setProperty('--panel-strong', theme.panelStrong);
    document.documentElement.style.setProperty('--line', theme.line);
    document.documentElement.style.setProperty('--line-strong', theme.lineStrong);
    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--accent-strong', theme.accentStrong);
    document.documentElement.style.setProperty('--accent-soft', theme.accentSoft);
    document.documentElement.style.setProperty('--glow', theme.glow);
    document.documentElement.style.setProperty('--bg-accent-a', theme.backgroundA);
    document.documentElement.style.setProperty('--bg-accent-b', theme.backgroundB);
    document.documentElement.style.setProperty('--ink', theme.text);
    document.documentElement.style.setProperty('--muted', theme.muted);
    this.themeIndicator.textContent = `palette:${themeName}`;
    this.fieldHandle?.setMode(theme.mode);
    this.fieldHandle?.burst();
  }

  private effectiveTheme(view: ViewDefinition): ThemeName {
    return this.manualTheme ?? view.theme;
  }

  private renderLog(): void {
    const pinTop = this.outputElement.dataset.pinTop === 'true';
    this.logElement.innerHTML = renderLog(this.lines);
    this.outputElement.scrollTop = pinTop ? 0 : this.outputElement.scrollHeight;
    delete this.outputElement.dataset.pinTop;
  }

  private pulseView(): void {
    this.viewElement.classList.remove('is-live');
    window.requestAnimationFrame(() => {
      this.viewElement.classList.add('is-live');
    });
  }

  private commandContext(): CommandContext {
    return {
      commands: this.commands,
      resume: resumeData,
      getTheme: () => this.manualTheme,
      setTheme: (theme) => {
        this.manualTheme = theme;

        if (this.activeView) {
          this.applyTheme(this.effectiveTheme(this.activeView));
        }
      },
    };
  }

  private parseCommand(rawInput: string): { name: string; args: string[] } {
    const normalized = rawInput.replace(/^\//, '').replace(/^\.\//, '').trim();
    const [name = '', ...args] = normalized.split(/\s+/);
    return { name: name.toLowerCase(), args };
  }

  private resolveCommand(name: string): CommandDefinition | undefined {
    return this.commands.find((command) => command.name === name || command.aliases.includes(name));
  }

  private closestCommands(fragment: string): string[] {
    if (!fragment) {
      return ['help'];
    }

    return this.commands
      .filter(
        (command) =>
          command.name.startsWith(fragment) || command.aliases.some((alias) => alias.startsWith(fragment)),
      )
      .slice(0, 3)
      .map((command) => command.name);
  }

  private updateAutocomplete(): void {
    this.suggestions = this.buildSuggestions(this.inputElement.value);
    this.suggestionIndex = 0;
    this.renderAutocomplete();
  }

  private buildSuggestions(rawValue: string): Suggestion[] {
    const commandLine = rawValue.replace(/^\//, '').replace(/^\.\//, '');
    const normalized = commandLine.trim().toLowerCase();
    const explicitCommand = rawValue.trim().startsWith('/');
    const trailingSpace = /\s$/.test(commandLine);
    const [currentName = '', ...argTokens] = commandLine.trimStart().split(/\s+/);
    const activeCommand = currentName.toLowerCase();

    if (this.chatMode && normalized && !explicitCommand) {
      return [];
    }

    if (!normalized) {
      return this.featuredCommands.slice(0, 6).map((command) => ({
        completion: this.completionForCommand(command.name),
        usage: command.usage,
        description: command.description,
        commandName: command.name,
      }));
    }

    const argSuggestions = this.argumentSuggestions(activeCommand, argTokens, trailingSpace);

    if (argSuggestions.length) {
      return argSuggestions;
    }

    if (normalized === 'ask') {
      return [
        {
          completion: 'ask ',
          usage: 'ask <question>',
          description: 'Complete ask, then type a question for Workers AI.',
          commandName: 'ask',
        },
      ];
    }

    if (normalized === 'explain') {
      return [
        {
          completion: 'explain ',
          usage: 'explain <project>',
          description: 'Complete explain, then choose a project.',
          commandName: 'explain',
        },
      ];
    }

    if (normalized.startsWith('explain ')) {
      const fragment = normalized.replace(/^explain\s+/, '');
      const explainTargets = [
        { completion: 'explain project ', usage: 'explain project <market|pi|wasm>', description: 'Explain a project with Workers AI.' },
        { completion: 'explain skill ', usage: 'explain skill <skill>', description: 'Explain a skill from the resume.' },
        { completion: 'explain work ', usage: 'explain work <role>', description: 'Explain a work-history entry.' },
        { completion: 'explain education', usage: 'explain education', description: 'Explain the education entry.' },
        { completion: 'explain command ', usage: 'explain command <command>', description: 'Explain a terminal command.' },
        ...resumeData.projects.map((project) => ({
          completion: `explain project ${project.slug}`,
          usage: `explain project ${project.slug}`,
          description: project.summary,
        })),
        { completion: 'explain project market', usage: 'explain project market', description: 'Explain Moe marketplace aggregation.' },
        { completion: 'explain project pi', usage: 'explain project pi', description: 'Explain the Raspberry Pi infrastructure cluster.' },
        { completion: 'explain project wasm', usage: 'explain project wasm', description: 'Explain the Zig WebAssembly runtime.' },
      ];

      return explainTargets
        .filter((entry) => entry.completion.startsWith(`explain ${fragment}`))
        .map((project) => ({
          ...project,
          commandName: 'explain',
        }));
    }

    if (normalized.startsWith('man ')) {
      const fragment = normalized.replace(/^man\s+/, '');
      return this.commands
        .filter((command) => command.name.startsWith(fragment))
        .slice(0, 8)
        .map((command) => ({
          completion: `man ${command.name}`,
          usage: `man ${command.name}`,
          description: command.description,
          commandName: command.name,
        }));
    }

    if (normalized.startsWith('cat ')) {
      const fragment = normalized.replace(/^cat\s+/, '');
      return FILE_PATHS.filter((path) => path.startsWith(fragment)).map((path) => ({
        completion: `cat ${path}`,
        usage: `cat ${path}`,
        description: 'Read this file from the portfolio OS.',
        commandName: 'cat',
      }));
    }

    if (normalized.startsWith('ls ')) {
      const fragment = normalized.replace(/^ls\s+/, '');
      return DIRECTORY_PATHS.filter((path) => path.startsWith(fragment)).map((path) => ({
        completion: `ls ${path}`,
        usage: `ls ${path}`,
        description: 'List this directory in the portfolio OS.',
        commandName: 'ls',
      }));
    }

    if (normalized.startsWith('theme')) {
      return ['theme red', 'theme amber', 'theme frost', 'theme ivory', 'theme auto']
        .filter((entry) => entry.startsWith(normalized))
        .map((entry) => ({
          completion: entry,
          usage: entry,
          description:
            entry === 'theme auto'
              ? 'Return palette control to the active view.'
              : `Pin the ${entry.replace('theme ', '')} palette.`,
          commandName: 'theme',
        }));
    }

    if (normalized.includes(' ')) {
      return [];
    }

    return this.commands
      .filter(
        (command) =>
          command.name.startsWith(normalized) || command.aliases.some((alias) => alias.startsWith(normalized)),
      )
      .slice(0, 6)
      .map((command) => ({
        completion: this.completionForCommand(command.name),
        usage: command.usage,
        description: command.description,
        commandName: command.name,
      }));
  }

  private renderAutocomplete(): void {
    if (!this.suggestions.length) {
      this.hideAutocomplete();
      return;
    }

    this.autocompletePanel.hidden = false;
    this.autocompleteList.innerHTML = this.suggestions
      .map((suggestion, index) => {
        const activeClass = index === this.suggestionIndex ? ' is-active' : '';

        return `
          <button
            class="autocomplete-option${activeClass}"
            type="button"
            data-suggestion-value="${suggestion.completion}"
          >
            <div class="autocomplete-copy">
              <p class="autocomplete-name">/${suggestion.completion}</p>
              <p class="autocomplete-desc">${suggestion.description}</p>
            </div>
            <span class="autocomplete-meta">${suggestion.usage}</span>
            ${
              suggestion.commandName
                ? `<span class="autocomplete-info" data-man-command="${suggestion.commandName}" title="Show man entry">i</span>`
                : ''
            }
          </button>
        `;
      })
      .join('');
  }

  private argumentSuggestions(commandName: string, args: string[], trailingSpace: boolean): Suggestion[] {
    if (commandName === 'cat') {
      const fragment = trailingSpace ? '' : args.at(-1) ?? '';
      return FILE_PATHS.filter((path) => path.startsWith(fragment)).map((path) => ({
        completion: `cat ${path}`,
        usage: `cat ${path}`,
        description: 'Read this file from the portfolio OS.',
        commandName: 'cat',
      }));
    }

    if (commandName === 'touch' || commandName === 'rm') {
      const fragment = trailingSpace ? '' : args.at(-1) ?? '';
      return [...FILE_PATHS, '/guest/', '/home/']
        .filter((path) => path.startsWith(fragment))
        .map((path) => ({
          completion: `${commandName} ${path}`,
          usage: `${commandName} <path>`,
          description: commandName === 'touch' ? 'Create this file path.' : 'Remove this writable file path.',
          commandName,
        }));
    }

    if (commandName === 'ls') {
      const fragment = trailingSpace ? '' : args.at(-1) ?? '';
      return DIRECTORY_PATHS.filter((path) => path.startsWith(fragment)).map((path) => ({
        completion: `ls ${path}`,
        usage: `ls ${path}`,
        description: 'List this directory in the portfolio OS.',
        commandName: 'ls',
      }));
    }

    if (commandName === 'skills') {
      return ['skills --category', 'skills --applications']
        .filter((entry) => entry.startsWith(`skills ${args.join(' ')}`.trim()))
        .map((entry) => ({
          completion: entry,
          usage: entry,
          description: entry.endsWith('--applications')
            ? 'Show skills by applied system category.'
            : 'Show skills grouped by resume categories.',
          commandName: 'skills',
        }));
    }

    if (commandName === 'explain' && args[0] === 'command') {
      const fragment = trailingSpace ? '' : args.at(-1) ?? '';
      return this.commands
        .filter((command) => command.name.startsWith(fragment))
        .map((command) => ({
          completion: `explain command ${command.name}`,
          usage: `explain command ${command.name}`,
          description: command.description,
          commandName: 'explain',
        }));
    }

    if (commandName === 'explain' && args[0] === 'project') {
      const fragment = trailingSpace ? '' : args.at(-1) ?? '';
      return [
        { key: 'market', description: 'Marketplace Aggregator on AWS at moe.pecunies.com.' },
        { key: 'pi', description: 'Raspberry Pi infrastructure cluster.' },
        { key: 'wasm', description: 'WebAssembly Runtime in Zig.' },
        { key: 'down', description: 'down.nvim markdown note-taking plugin.' },
      ]
        .filter((entry) => entry.key.startsWith(fragment))
        .map((entry) => ({
          completion: `explain project ${entry.key}`,
          usage: `explain project ${entry.key}`,
          description: entry.description,
          commandName: 'explain',
        }));
    }

    const hints = ARG_HINTS[commandName];

    if (!hints || (!trailingSpace && args.length === 0)) {
      return [];
    }

    const index = trailingSpace ? args.length : Math.max(0, args.length - 1);
    const hint = hints[index] ?? hints.at(-1);

    if (!hint) {
      return [];
    }

    const prefix = [commandName, ...args.slice(0, trailingSpace ? args.length : Math.max(0, args.length - 1))]
      .filter(Boolean)
      .join(' ');
    const completion = prefix ? `${prefix} ` : `${commandName} `;

    return [
      {
        completion,
        usage: `${hint.token}: ${hint.description}`,
        description: 'Argument help for the current parameter.',
        commandName,
      },
    ];
  }

  private hideAutocomplete(): void {
    this.suggestions = [];
    this.autocompletePanel.hidden = true;
    this.autocompleteList.innerHTML = '';
  }

  private selectedCompletion(): string | null {
    return this.suggestions[this.suggestionIndex]?.completion ?? null;
  }

  private completionForCommand(commandName: string): string {
    return ARG_COMMANDS.has(commandName) ? `${commandName} ` : commandName;
  }

  private acceptSuggestion(completion: string): void {
    this.inputElement.value = completion;
    this.inputElement.focus();
    this.inputElement.setSelectionRange(completion.length, completion.length);
    this.updateAutocomplete();
  }

  private shouldRunCommandInChat(input: string): boolean {
    const normalized = input.trim();

    if (normalized.startsWith('/')) {
      return true;
    }

    const { name } = this.parseCommand(normalized);
    return name === 'exit' || name === 'clear';
  }

  private shouldHandleAsGameInput(input: string): boolean {
    const normalized = input.trim().replace(/^\//, '').toLowerCase();

    if (!this.gameMode) {
      return false;
    }

    if (['q', 'quit', 'n', 'new'].includes(normalized)) {
      return true;
    }

    if (this.pendingScore && !this.resolveCommand(this.parseCommand(normalized).name)) {
      return true;
    }

    if (this.gameMode === '2048') {
      return ['w', 'a', 's', 'd', 'up', 'down', 'left', 'right'].includes(normalized);
    }

    if (this.gameMode === 'chess') {
      return /^[a-h][1-8][a-h][1-8]$/.test(normalized);
    }

    if (this.gameMode === 'minesweeper') {
      return /^(open|flag)\s+[a-h][1-8]$/.test(normalized);
    }

    return false;
  }

  private clearTerminal(): void {
    this.lines = [];
    this.activeView = null;
    this.chatMode = false;
    this.gameMode = null;
    this.pendingPrompt = null;
    this.pendingScore = null;
    this.viewElement.innerHTML = '';
    this.promptScramble.textContent = '';
    this.statusScramble.textContent = '';
    this.routeIndicator.textContent = '~';
    this.themeIndicator.textContent = 'palette:auto';
    this.promptLabel.textContent = 'chris@pecunies:~$';
    this.restoreWindow();
  }

  private applyWindowAction(action: 'shutdown' | 'minimize' | 'maximize'): void {
    if (action === 'shutdown') {
      this.shellElement.classList.add('is-shutdown');
      this.shellElement.classList.remove('is-minimized');
      this.dockElement.hidden = false;
      return;
    }

    if (action === 'minimize') {
      this.shellElement.classList.add('is-minimized');
      this.shellElement.classList.remove('is-shutdown');
      this.dockElement.hidden = false;
      return;
    }

    this.shellElement.classList.toggle('is-maximized');
    this.shellElement.classList.remove('is-minimized', 'is-shutdown');
    this.dockElement.hidden = true;
  }

  private restoreWindow(): void {
    this.shellElement.classList.remove('is-minimized', 'is-shutdown');
    this.dockElement.hidden = true;
    this.inputElement.focus();
  }

  private downloadResume(format: 'pdf' | 'markdown'): void {
    const href = format === 'markdown' ? resumeData.pdf.markdownHref : resumeData.pdf.href;
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = format === 'markdown' ? 'chris-pecunies-resume.md' : 'chris-pecunies-resume.pdf';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  private copyIfClipboardCommand(command: string): void {
    const normalized = command.replace(/^\//, '').trim();

    if (!normalized.startsWith('cp ')) {
      return;
    }

    const text = normalized.slice(3);
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  private async recordMetric(route: string): Promise<void> {
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          route,
        }),
      });
    } catch {
      // Analytics are best-effort and should not affect navigation.
    }
  }

  private async loadPosts(): Promise<void> {
    try {
      const response = await fetch('/api/posts');
      const payload = (await response.json()) as {
        posts?: Array<{
          title: string;
          slug: string;
          path: string;
          markdown: string;
          comments?: Array<{ name: string; message: string; at: string }>;
        }>;
      };

      if (!response.ok || !payload.posts?.length) {
        return;
      }

      this.lines.push({
        id: this.makeId(),
        kind: 'view',
        html: this.renderPosts(payload.posts),
        text: payload.posts.map((post) => `${post.title}\n${post.markdown}`).join('\n\n'),
      });
      this.renderLog();
    } catch {
      // Static post index remains available if the dynamic reader fails.
    }
  }

  private renderPosts(
    posts: Array<{
      title: string;
      slug: string;
      path: string;
      markdown: string;
      comments?: Array<{ name: string; message: string; at: string }>;
    }>,
  ): string {
    return `
      <div class="terminal-view is-live">
        <section class="output-block">
          <h2 class="output-heading">Published markdown</h2>
          <div class="output-records">
            ${posts
              .map(
                (post) => `
                  <article class="output-record">
                    <div class="record-topline">
                      <p>
                        <strong>${this.escapeHtml(post.title)}</strong>
                        <span>${this.escapeHtml(post.path)}</span>
                      </p>
                      <div class="record-meta">
                        <span>comment ${this.escapeHtml(post.slug)} &lt;name&gt; &lt;message&gt;</span>
                      </div>
                    </div>
                    <p class="record-summary">${this.escapeHtml(this.markdownPreview(post.markdown))}</p>
                    ${
                      post.comments?.length
                        ? `<div class="output-copy">${post.comments
                            .map(
                              (comment) =>
                                `<p><strong>${this.escapeHtml(comment.name)}</strong>: ${this.escapeHtml(comment.message)}</p>`,
                            )
                            .join('')}</div>`
                        : '<p class="record-summary">No comments yet.</p>'
                    }
                  </article>
                `,
              )
              .join('')}
          </div>
        </section>
      </div>
    `;
  }

  private markdownPreview(markdown: string): string {
    return markdown
      .replace(/^#\s+.+$/m, '')
      .replace(/[#*_`]/g, '')
      .trim()
      .slice(0, 420);
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private async sendChat(message: string): Promise<void> {
    if (this.chatPending) {
      this.lines.push(this.responseLine('A chat response is already running.', 'warn'));
      this.renderLog();
      return;
    }

    this.chatPending = true;
    this.lines.push(this.commandLine(message));
    const pendingId = this.makeId();
    this.lines.push({
      id: pendingId,
      kind: 'response',
      text: 'thinking...',
      tone: 'info',
    });
    this.renderLog();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          message,
          history: this.lines
            .filter((line) => line.id !== pendingId)
            .slice(-12)
            .map((line) => ({
              kind: line.kind,
              text: this.lineText(line),
            })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { answer?: string; error?: string } | null;
      const text = response.ok
        ? payload?.answer ?? 'No answer returned.'
        : payload?.error ?? `Chat request failed with status ${response.status}.`;

      this.replaceLine(pendingId, text, response.ok ? 'success' : 'warn');
    } catch {
      this.replaceLine(pendingId, 'Chat request failed before reaching the Cloudflare AI worker.', 'warn');
    } finally {
      this.chatPending = false;
      this.renderLog();
      this.inputElement.focus();
    }
  }

  private async sendOsCommand(command: string): Promise<void> {
    const pendingId = this.makeId();
    this.lines.push({
      id: pendingId,
      kind: 'response',
      text: '...',
      tone: 'info',
    });
    this.renderLog();

    try {
      const response = await fetch('/api/os', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          command,
          visibleContext: this.visibleContext(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as OsResponse | null;
      const output = response.ok
        ? payload?.output ?? 'OK'
        : payload?.error ?? `OS command failed with status ${response.status}.`;

      if (payload?.mode === 'chat') {
        this.chatMode = true;
        this.promptLabel.textContent = 'chat>';
        this.routeIndicator.textContent = '~/chat';
        this.themeIndicator.textContent = 'workers-ai';
        this.applyTheme(this.manualTheme ?? 'red');
      }

      if (output.startsWith('[sudo]') || output.startsWith('Password:')) {
        this.sensitiveNextInput = true;
      }

      this.replaceLine(pendingId, output, response.ok ? 'success' : 'warn');
    } catch {
      this.replaceLine(pendingId, 'OS command failed before reaching the Cloudflare worker.', 'warn');
    } finally {
      this.renderLog();
      this.inputElement.focus();
    }
  }

  private async recordCommand(command: string): Promise<void> {
    try {
      await fetch('/api/os', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          command,
          recordOnly: true,
          visibleContext: this.visibleContext(),
        }),
      });
    } catch {
      // Persistence is best-effort; the terminal should keep working offline.
    }
  }

  private visibleContext(): string {
    return [this.viewElement.textContent ?? '', ...this.lines.map((line) => this.lineText(line))]
      .join('\n')
      .slice(-6000);
  }

  private lineText(line: SessionLine): string {
    if (line.kind === 'view') {
      return line.text;
    }

    return line.text;
  }

  private viewText(view: ViewDefinition): string {
    const sections = view.sections
      .map((section) => {
        if (section.type === 'paragraphs') {
          return `${section.heading}\n${section.body.join('\n')}`;
        }

        if (section.type === 'note') {
          return `${section.heading}\n${section.lines.join('\n')}`;
        }

        if (section.type === 'timeline') {
          return `${section.heading}\n${section.items
            .map((item) => `${item.period} ${item.role} ${item.company}: ${item.summary}`)
            .join('\n')}`;
        }

        if (section.type === 'projects') {
          return `${section.heading}\n${section.items
            .map((item) => `${item.name}: ${item.summary}`)
            .join('\n')}`;
        }

        if (section.type === 'tag-groups') {
          return `${section.heading}\n${section.groups
            .map((group) => `${group.title}: ${group.items.join(', ')}`)
            .join('\n')}`;
        }

        if (section.type === 'contact') {
          return `${section.heading}\n${section.items.map((item) => `${item.label}: ${item.value}`).join('\n')}`;
        }

        if (section.type === 'education') {
          return `${section.heading}\n${section.item.school}: ${section.item.degree}`;
        }

        if (section.type === 'command-list') {
          return `${section.heading}\n${section.items.map((item) => item.usage).join('\n')}`;
        }

        if (section.type === 'pdf') {
          return `${section.heading}\n${section.summary}`;
        }

        return '';
      })
      .join('\n\n');

    return `${view.title}\n${view.description}\n${sections}`;
  }

  private replaceLine(id: string, text: string, tone: LogTone): void {
    this.lines = this.lines.map((line) =>
      line.id === id
        ? {
            id,
            kind: 'response',
            text,
            tone,
          }
        : line,
    );
  }

  private pushHistory(command: string): void {
    if (this.history.at(-1) !== command) {
      this.history.push(command);
    }

    if (this.history.length > 40) {
      this.history.shift();
    }

    window.localStorage.setItem('pecunies-terminal-command-history', JSON.stringify(this.history));
  }

  private restorePersistedHistory(): void {
    try {
      const history = JSON.parse(window.localStorage.getItem('pecunies-terminal-command-history') ?? '[]') as string[];
      this.history = Array.isArray(history) ? history.filter((entry) => typeof entry === 'string').slice(-40) : [];
    } catch {
      this.history = [];
    }
  }

  private restoreHistory(direction: -1 | 1): void {
    if (!this.history.length) {
      return;
    }

    if (this.historyIndex === null) {
      this.historyIndex = direction === -1 ? this.history.length - 1 : 0;
    } else {
      this.historyIndex = Math.min(
        this.history.length - 1,
        Math.max(0, this.historyIndex + direction),
      );
    }

    const command = this.history[this.historyIndex];

    if (!command) {
      return;
    }

    this.inputElement.value = command;
    this.inputElement.setSelectionRange(command.length, command.length);
  }

  private startGame(game: GameKind): void {
    this.gameMode = game;
    this.pendingScore = null;
    this.minesGameOver = false;

    if (game === 'chess') {
      this.chessMoves = 0;
      this.chessBoard = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
      ];
      return;
    }

    if (game === 'minesweeper') {
      this.startMinesweeper();
      return;
    }

    this.gameScore = 0;
    this.gameBoard = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0));
    this.spawnTile();
    this.spawnTile();
  }

  private handleGameInput(input: string): void {
    const command = input.trim().toLowerCase();

    if (this.pendingScore) {
      const pending = this.pendingScore;
      this.pendingScore = null;
      void this.saveScore(pending.game, pending.score, input.trim() || 'anonymous');
      this.lines.push(this.responseLine(`Saved ${pending.game} score ${pending.score} for ${input.trim() || 'anonymous'}.`, 'success'));
      return;
    }

    if (command === 'q' || command === 'quit') {
      this.gameMode = null;
      this.promptLabel.textContent = 'chris@pecunies:~$';
      this.lines.push(this.responseLine('Game closed.', 'info'));
      return;
    }

    if (command === 'n' || command === 'new') {
      const game = this.gameMode ?? '2048';
      this.startGame(game);
      this.lines.push(this.responseLine(this.renderGame(), 'info'));
      return;
    }

    if (this.gameMode === 'chess') {
      this.handleChessInput(command);
      return;
    }

    if (this.gameMode === 'minesweeper') {
      this.handleMinesInput(command);
      return;
    }

    const moved = this.moveGame(command);

    if (!moved) {
      this.lines.push(this.responseLine('Use w/a/s/d, n for new, or q to quit.', 'warn'));
      return;
    }

    this.spawnTile();
    const won = this.gameBoard.some((row) => row.some((cell) => cell >= 2048));
    const stuck = !this.canMoveGame();
    const suffix = won ? '\n\n2048 reached.' : stuck ? '\n\nNo moves left. Press n for a new board.' : '';
    this.lines.push(this.responseLine(`${this.renderGame()}${suffix}`, won ? 'success' : stuck ? 'warn' : 'info'));

    if (won || stuck) {
      this.pendingScore = { game: '2048', score: this.gameScore };
      this.lines.push(this.responseLine('Enter a name to save this score, or run another command to exit the game.', 'info'));
    }
  }

  private moveGame(direction: string): boolean {
    const before = JSON.stringify(this.gameBoard);
    const transpose = (board: number[][]) => board[0]?.map((_, index) => board.map((row) => row[index] ?? 0)) ?? [];
    const reverseRows = (board: number[][]) => board.map((row) => [...row].reverse());
    const mergeLeft = (row: number[]) => {
      const values = row.filter(Boolean);
      const next: number[] = [];

      for (let index = 0; index < values.length; index += 1) {
        if (values[index] === values[index + 1]) {
          const merged = (values[index] ?? 0) * 2;
          this.gameScore += merged;
          next.push(merged);
          index += 1;
        } else {
          next.push(values[index] ?? 0);
        }
      }

      while (next.length < 4) {
        next.push(0);
      }

      return next;
    };

    if (direction === 'a' || direction === 'left') {
      this.gameBoard = this.gameBoard.map(mergeLeft);
    } else if (direction === 'd' || direction === 'right') {
      this.gameBoard = reverseRows(reverseRows(this.gameBoard).map(mergeLeft));
    } else if (direction === 'w' || direction === 'up') {
      this.gameBoard = transpose(transpose(this.gameBoard).map(mergeLeft));
    } else if (direction === 's' || direction === 'down') {
      this.gameBoard = transpose(reverseRows(reverseRows(transpose(this.gameBoard)).map(mergeLeft)));
    }

    return before !== JSON.stringify(this.gameBoard);
  }

  private canMoveGame(): boolean {
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        const cell = this.gameBoard[y]?.[x] ?? 0;

        if (!cell || cell === this.gameBoard[y]?.[x + 1] || cell === this.gameBoard[y + 1]?.[x]) {
          return true;
        }
      }
    }

    return false;
  }

  private spawnTile(): void {
    const empty: Array<[number, number]> = [];

    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        if (!this.gameBoard[y]?.[x]) {
          empty.push([y, x]);
        }
      }
    }

    const slot = empty[Math.floor(Math.random() * empty.length)];

    if (!slot) {
      return;
    }

    const [y, x] = slot;
    this.gameBoard[y]![x] = Math.random() > 0.88 ? 4 : 2;
  }

  private renderGame(): string {
    if (this.gameMode === 'chess') {
      return this.renderChess();
    }

    if (this.gameMode === 'minesweeper') {
      return this.renderMinesweeper();
    }

    const divider = '+------+------+------+------+';
    const rows = this.gameBoard.map((row) => {
      const cells = row.map((cell) => String(cell || '.').padStart(4, ' ')).join(' | ');
      return `| ${cells} |`;
    });

    return [`score: ${this.gameScore}`, divider, ...rows.flatMap((row) => [row, divider]), 'w/a/s/d move | n new | q quit'].join('\n');
  }

  private handleChessInput(command: string): void {
    const match = /^([a-h])([1-8])([a-h])([1-8])$/.exec(command);

    if (!match) {
      this.lines.push(this.responseLine('Use coordinate moves like e2e4, n for new, or q to quit.', 'warn'));
      return;
    }

    const [, fromFile, fromRank, toFile, toRank] = match;
    const from = this.squareToIndex(fromFile!, fromRank!);
    const to = this.squareToIndex(toFile!, toRank!);
    const piece = this.chessBoard[from.row]?.[from.col] ?? '.';

    if (piece === '.') {
      this.lines.push(this.responseLine(`No piece on ${fromFile}${fromRank}.`, 'warn'));
      return;
    }

    this.chessBoard[to.row]![to.col] = piece;
    this.chessBoard[from.row]![from.col] = '.';
    this.chessMoves += 1;
    this.lines.push(this.responseLine(this.renderChess(), 'info'));
  }

  private renderChess(): string {
    const rows = this.chessBoard.map((row, index) => `${8 - index}  ${row.join(' ')}`);
    return [`moves: ${this.chessMoves}`, '   a b c d e f g h', ...rows, '', 'move: e2e4 | n new | q quit'].join('\n');
  }

  private squareToIndex(file: string, rank: string): { row: number; col: number } {
    return {
      row: 8 - Number(rank),
      col: file.charCodeAt(0) - 97,
    };
  }

  private startMinesweeper(): void {
    const size = 8;
    this.minesOpenCount = 0;
    this.minesBoard = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({ mine: false, open: false, flag: false, count: 0 })),
    );

    let mines = 0;

    while (mines < 10) {
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      const cell = this.minesBoard[row]![col]!;

      if (!cell.mine) {
        cell.mine = true;
        mines += 1;
      }
    }

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        this.minesBoard[row]![col]!.count = this.countAdjacentMines(row, col);
      }
    }
  }

  private handleMinesInput(command: string): void {
    if (this.minesGameOver) {
      this.lines.push(this.responseLine('Press n for a new board or q to quit.', 'warn'));
      return;
    }

    const match = /^(open|flag)\s+([a-h])([1-8])$/.exec(command);

    if (!match) {
      this.lines.push(this.responseLine('Use open A1, flag B2, n for new, or q to quit.', 'warn'));
      return;
    }

    const [, action, file, rank] = match;
    const { row, col } = this.squareToIndex(file!, rank!);
    const cell = this.minesBoard[row]?.[col];

    if (!cell) {
      this.lines.push(this.responseLine('Square is outside the board.', 'warn'));
      return;
    }

    if (action === 'flag') {
      cell.flag = !cell.flag;
      this.lines.push(this.responseLine(this.renderMinesweeper(), 'info'));
      return;
    }

    if (cell.flag) {
      this.lines.push(this.responseLine('Square is flagged. Unflag it before opening.', 'warn'));
      return;
    }

    cell.open = true;

    if (cell.mine) {
      this.minesGameOver = true;
      this.pendingScore = { game: 'minesweeper', score: this.minesOpenCount };
      this.lines.push(this.responseLine(`${this.renderMinesweeper(true)}\n\nMine hit. Enter a name to save score ${this.minesOpenCount}.`, 'warn'));
      return;
    }

    this.minesOpenCount += 1;
    const safeSquares = 64 - 10;

    if (this.minesOpenCount >= safeSquares) {
      this.minesGameOver = true;
      this.pendingScore = { game: 'minesweeper', score: this.minesOpenCount };
      this.lines.push(this.responseLine(`${this.renderMinesweeper(true)}\n\nBoard cleared. Enter a name to save the win.`, 'success'));
      return;
    }

    this.lines.push(this.responseLine(this.renderMinesweeper(), 'info'));
  }

  private renderMinesweeper(reveal = false): string {
    const rows = this.minesBoard.map((row, rowIndex) => {
      const cells = row
        .map((cell) => {
          if (reveal && cell.mine) {
            return '*';
          }

          if (cell.flag) {
            return 'F';
          }

          if (!cell.open) {
            return '.';
          }

          return cell.count ? String(cell.count) : ' ';
        })
        .join(' ');

      return `${8 - rowIndex}  ${cells}`;
    });

    return [`open: ${this.minesOpenCount}/54`, '   A B C D E F G H', ...rows, '', 'open A1 | flag B2 | n new | q quit'].join('\n');
  }

  private countAdjacentMines(row: number, col: number): number {
    let count = 0;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dy === 0 && dx === 0) {
          continue;
        }

        if (this.minesBoard[row + dy]?.[col + dx]?.mine) {
          count += 1;
        }
      }
    }

    return count;
  }

  private async saveScore(game: GameKind, score: number, name: string): Promise<void> {
    try {
      await fetch('/api/os', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          command: `score ${game} ${score} ${name}`,
          visibleContext: this.visibleContext(),
        }),
      });
    } catch {
      // Scores are best-effort; gameplay should not depend on persistence.
    }
  }

  private readRoute(): string {
    return window.location.hash.replace(/^#\/?/, '').trim();
  }

  private writeRoute(route: string): void {
    if (!route) {
      this.suppressHashChange = true;
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      window.setTimeout(() => {
        this.suppressHashChange = false;
      }, 0);
      return;
    }

    const next = `#/${route}`;

    if (window.location.hash === next) {
      return;
    }

    this.suppressHashChange = true;
    window.location.hash = next;
    window.setTimeout(() => {
      this.suppressHashChange = false;
    }, 0);
  }

  private scrambleText(element: HTMLElement, nextText: string): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.textContent = nextText;
      return;
    }

    const previous = this.scrambleFrames.get(element);

    if (previous) {
      window.cancelAnimationFrame(previous);
    }

    const chars = '<>[]{}/*+?#$%&=';
    const current = element.textContent ?? '';
    const length = Math.max(current.length, nextText.length);
    const queue = Array.from({ length }, (_, index) => ({
      from: current[index] ?? ' ',
      to: nextText[index] ?? ' ',
      start: Math.floor(Math.random() * 8),
      end: 8 + Math.floor(Math.random() * 14),
      char: '',
    }));

    let frame = 0;

    const tick = () => {
      let output = '';
      let complete = 0;

      for (const item of queue) {
        if (frame >= item.end) {
          complete += 1;
          output += item.to;
          continue;
        }

        if (frame >= item.start) {
          if (!item.char || Math.random() < 0.26) {
            item.char = chars[Math.floor(Math.random() * chars.length)] ?? '#';
          }

          output += item.char;
          continue;
        }

        output += item.from;
      }

      element.textContent = output;

      if (complete === queue.length) {
        element.textContent = nextText;
        return;
      }

      frame += 1;
      const nextFrame = window.requestAnimationFrame(tick);
      this.scrambleFrames.set(element, nextFrame);
    };

    tick();
  }

  private commandLine(text: string): SessionLine {
    return {
      id: this.makeId(),
      kind: 'command',
      text,
    };
  }

  private responseLine(text: string, tone: LogTone): SessionLine {
    return {
      id: this.makeId(),
      kind: 'response',
      text,
      tone,
    };
  }

  private makeId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getSessionId(): string {
    const key = 'pecunies-terminal-session';
    const existing = window.localStorage.getItem(key);

    if (existing) {
      return existing;
    }

    const next =
      window.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, next);
    return next;
  }

  private requireElement<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);

    if (!element) {
      throw new Error(`Expected to find ${selector}.`);
    }

    return element;
  }

  private setupPointerDepth(): void {
    if (window.matchMedia('(pointer: coarse)').matches) {
      return;
    }

    window.addEventListener('pointermove', (event) => {
      const driftX = (event.clientX / window.innerWidth - 0.5) * 84;
      const driftY = (event.clientY / window.innerHeight - 0.5) * 64;
      document.documentElement.style.setProperty('--pointer-drift-x', `${driftX}px`);
      document.documentElement.style.setProperty('--pointer-drift-y', `${driftY}px`);
    });

    const resetShell = () => {
      this.shellElement.style.setProperty('--shell-tilt-x', '0deg');
      this.shellElement.style.setProperty('--shell-tilt-y', '0deg');
      this.shellElement.style.setProperty('--shell-glow-x', '50%');
      this.shellElement.style.setProperty('--shell-glow-y', '50%');
    };

    resetShell();

    this.shellElement.addEventListener('pointermove', (event) => {
      const bounds = this.shellElement.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;

      this.shellElement.style.setProperty('--shell-tilt-x', `${(0.5 - y) * 4}deg`);
      this.shellElement.style.setProperty('--shell-tilt-y', `${(x - 0.5) * 5.5}deg`);
      this.shellElement.style.setProperty('--shell-glow-x', `${x * 100}%`);
      this.shellElement.style.setProperty('--shell-glow-y', `${y * 100}%`);
    });

    this.shellElement.addEventListener('pointerleave', resetShell);

    this.root.addEventListener('pointermove', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const card = target.closest<HTMLElement>('.terminal-stat, .output-record, .command-card, .pdf-thumb, .action-chip');

      if (!card) {
        return;
      }

      const bounds = card.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * 100;
      const y = ((event.clientY - bounds.top) / bounds.height) * 100;
      card.style.setProperty('--card-glow-x', `${x}%`);
      card.style.setProperty('--card-glow-y', `${y}%`);
    });
  }
}
