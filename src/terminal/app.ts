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
};

type Suggestion = {
  completion: string;
  usage: string;
  description: string;
};

type OsResponse = {
  output?: string;
  error?: string;
  mode?: 'chat';
 };

const ARG_COMMANDS = new Set(['ask', 'cat', 'curl', 'explain', 'man', 'ping', 'stock', 'weather']);
const FILE_PATHS = [
  '/',
  '/resume',
  '/resume/summary.txt',
  '/resume/experience.txt',
  '/resume/skills.txt',
  '/projects',
  '/projects/marketplace-aggregator.txt',
  '/projects/webassembly-runtime.txt',
  '/contact.txt',
  '/system/man.txt',
];

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
  private gameMode = false;
  private gameBoard: number[][] = [];
  private gameScore = 0;
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

    for (const command of this.commands) {
      if (command.route) {
        this.routeMap.set(command.route, command);
      }
    }

    this.formElement.addEventListener('submit', (event) => {
      event.preventDefault();

      const raw = this.inputElement.value.trim();
      const shouldUseCompletion = !this.chatMode || raw.startsWith('/');
      const submitted = raw ? (shouldUseCompletion ? this.selectedCompletion() ?? raw : raw) : '';

      if (!submitted) {
        return;
      }

      this.pushHistory(submitted);
      if (this.chatMode && !this.shouldRunCommandInChat(submitted)) {
        void this.sendChat(submitted);
      } else {
        this.execute(submitted);
      }
      this.inputElement.value = '';
      this.historyIndex = null;
      this.hideAutocomplete();
    });

    this.inputElement.addEventListener('input', () => {
      this.updateAutocomplete();
    });

    this.inputElement.addEventListener('focus', () => {
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
      this.inputElement.value = '';
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
    const normalized = rawInput.trim();

    if (!normalized) {
      return;
    }

    if (this.gameMode && !this.shouldRunCommandInGame(normalized)) {
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

    const { name, args } = this.parseCommand(normalized);
    const command = this.resolveCommand(name);

    if (echo) {
      this.lines.push(this.commandLine(normalized));
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

    const outcome = command.execute(this.commandContext(), args, normalized);
    if (outcome.kind === 'os') {
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
      this.gameMode = false;
      this.promptLabel.textContent = 'chat>';
      this.routeIndicator.textContent = '~/chat';
      this.themeIndicator.textContent = 'workers-ai';
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? 'success'));

      if (syncHash) {
        this.writeRoute(command.route ?? 'chat');
      }

      return;
    }

    if (outcome.kind === 'exit') {
      this.chatMode = false;
      this.gameMode = false;
      this.promptLabel.textContent = 'chris@pecunies:~$';
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? 'info'));
      return;
    }

    if (outcome.kind === 'game') {
      this.chatMode = false;
      this.startGame();
      this.promptLabel.textContent = '2048>';
      this.routeIndicator.textContent = '~/2048';
      this.themeIndicator.textContent = 'tui';
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? 'success'));
      this.lines.push(this.responseLine(this.renderGame(), 'info'));
      return;
    }

    if (outcome.kind === 'system') {
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? 'info'));

      if (this.activeView) {
        this.applyTheme(this.effectiveTheme(this.activeView));
      }

      return;
    }

    if (outcome.kind === 'os') {
      void this.sendOsCommand(outcome.command);
      return;
    }

    this.activeView = outcome.view;
    this.chatMode = false;
    this.gameMode = false;
    this.promptLabel.textContent = 'chris@pecunies:~$';
    this.lines.push(this.responseLine(outcome.view.logline, outcome.tone ?? 'success'));
    this.viewElement.innerHTML = renderView(outcome.view);
    this.outputElement.dataset.pinTop = 'true';
    this.routeIndicator.textContent = `~/${outcome.view.route}`;
    this.scrambleText(this.promptScramble, outcome.view.prompt);
    this.scrambleText(this.statusScramble, outcome.view.description);
    this.applyTheme(this.effectiveTheme(outcome.view));
    this.pulseView();

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
    const normalized = rawValue.replace(/^\//, '').replace(/^\.\//, '').trim().toLowerCase();
    const explicitCommand = rawValue.trim().startsWith('/');

    if (this.chatMode && normalized && !explicitCommand) {
      return [];
    }

    if (!normalized) {
      return this.featuredCommands.slice(0, 6).map((command) => ({
        completion: this.completionForCommand(command.name),
        usage: command.usage,
        description: command.description,
      }));
    }

    if (normalized === 'ask') {
      return [
        {
          completion: 'ask ',
          usage: 'ask <question>',
          description: 'Complete ask, then type a question for Workers AI.',
        },
      ];
    }

    if (normalized === 'explain') {
      return [
        {
          completion: 'explain ',
          usage: 'explain <project>',
          description: 'Complete explain, then choose a project.',
        },
      ];
    }

    if (normalized.startsWith('explain ')) {
      const fragment = normalized.replace(/^explain\s+/, '');
      return resumeData.projects
        .filter((project) => project.slug.startsWith(fragment) || project.name.toLowerCase().includes(fragment))
        .map((project) => ({
          completion: `explain ${project.slug}`,
          usage: `explain ${project.slug}`,
          description: project.summary,
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
        }));
    }

    if (normalized.startsWith('cat ')) {
      const fragment = normalized.replace(/^cat\s+/, '');
      return FILE_PATHS.filter((path) => path.startsWith(fragment)).map((path) => ({
        completion: `cat ${path}`,
        usage: `cat ${path}`,
        description: 'Read this file from the portfolio OS.',
      }));
    }

    if (normalized.startsWith('theme')) {
      return ['theme amber', 'theme frost', 'theme ivory', 'theme auto']
        .filter((entry) => entry.startsWith(normalized))
        .map((entry) => ({
          completion: entry,
          usage: entry,
          description:
            entry === 'theme auto'
              ? 'Return palette control to the active view.'
              : `Pin the ${entry.replace('theme ', '')} palette.`,
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
          </button>
        `;
      })
      .join('');
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

  private shouldRunCommandInGame(input: string): boolean {
    const normalized = input.trim().replace(/^\//, '').toLowerCase();
    return normalized === 'clear' || normalized === 'exit';
  }

  private clearTerminal(): void {
    this.lines = [];
    this.activeView = null;
    this.chatMode = false;
    this.gameMode = false;
    this.viewElement.innerHTML = '';
    this.promptScramble.textContent = '';
    this.statusScramble.textContent = '';
    this.routeIndicator.textContent = '~';
    this.themeIndicator.textContent = 'palette:auto';
    this.promptLabel.textContent = 'chris@pecunies:~$';
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
              text: line.text,
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
    return [this.viewElement.textContent ?? '', ...this.lines.map((line) => line.text)]
      .join('\n')
      .slice(-6000);
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

  private startGame(): void {
    this.gameMode = true;
    this.gameScore = 0;
    this.gameBoard = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0));
    this.spawnTile();
    this.spawnTile();
  }

  private handleGameInput(input: string): void {
    const command = input.trim().toLowerCase();

    if (command === 'q' || command === 'quit') {
      this.gameMode = false;
      this.promptLabel.textContent = 'chris@pecunies:~$';
      this.lines.push(this.responseLine('2048 closed.', 'info'));
      return;
    }

    if (command === 'n' || command === 'new') {
      this.startGame();
      this.lines.push(this.responseLine(this.renderGame(), 'info'));
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
    const divider = '+------+------+------+------+';
    const rows = this.gameBoard.map((row) => {
      const cells = row.map((cell) => String(cell || '.').padStart(4, ' ')).join(' | ');
      return `| ${cells} |`;
    });

    return [`score: ${this.gameScore}`, divider, ...rows.flatMap((row) => [row, divider]), 'w/a/s/d move | n new | q quit'].join('\n');
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
  }
}
