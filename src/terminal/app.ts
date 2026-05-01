import { resumeData } from "../data/resume";
import type { AmbientFieldHandle } from "../wasm";
import {
  bumpCommandFrequency,
  fuzzyScore,
  rankByFuzzyAndFrequency,
  readCommandFrequency,
} from "./fuzzy-rank";
import {
  COMMAND_TAGS,
  findTagsMatching,
  getTagDescription,
  listTagSummaries,
} from "../data/content-tags";
import {
  fetchAutocompleteSuggestions,
  type AutocompleteSuggestion,
  API_BASE,
  upsertSignal,
  deleteSignal,
} from "../api";
import {
  buildGenericUsageSuggestions,
  commandSynopsisNeedsArgs,
  extractHintFlagTokens,
  rankArgHintRows,
} from "./usage-autocomplete";
import { renderMarkdownToHtml, renderPostMarkdownToHtml } from "./markdown";
import { terminalThemes, type ThemeName } from "./palette";
import {
  DEFAULT_AI_MODEL,
  isValidWorkersAiModelId,
  WORKERS_AI_TEXT_MODELS,
} from "./ai-models";
import {
  createJobQuestState,
  formatJobQuestScene,
  jobQuestScore,
  jobQuestWouldHandleAsGameInput,
  processJobQuestInput,
  type JobQuestState,
} from "./jobquest-game";
import { renderLog, renderShell, renderView } from "./render";
import type {
  CommandContext,
  CommandDefinition,
  CommandOutcome,
  LogTone,
  SessionLine,
  ViewDefinition,
} from "./types";

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
  displayName?: string;
};

type OsResponse = {
  output?: string;
  error?: string;
  mode?: "chat";
  config?: Record<string, unknown>;
  cwd?: string;
};
type ChatStreamEvent =
  | {
      type: "meta";
      model?: string;
      traceLabel?: string;
    }
  | {
      type: "trace";
      text?: string;
    }
  | {
      type: "answer";
      delta?: string;
    }
  | {
      type: "error";
      error?: string;
    }
  | {
      type: "done";
      answer?: string;
      model?: string;
      traceLabel?: string;
    };
type ChatErrorResponse = {
  model?: string;
  error?: string;
};

type GameKind = "2048" | "chess" | "minesweeper" | "jobquest";

type MinesCell = {
  mine: boolean;
  open: boolean;
  flag: boolean;
  count: number;
};

const FILE_PATHS = [
  "/",
  "/README.md",
  "/TODO.md",
  "/CHANGELOG.md",
  "/app",
  "/bin/clpsh",
  "/bin/minesweeper",
  "/bin/2048",
  "/bin/chess",
  "/bin/jobquest",
  "/bin/edit",
  "/home/guest/.clpshrc",
  "/etc/edit/editrc",
  "/guest",
  "/home",
  "/home/guest",
  "/home/guest/projects",
  "/home/guest/skills",
  "/posts",
  "/posts/2026/04/29/terminal-portfolio-changelog.md",
  "/resume",
  "/resume/resume.md",
  "/resume/skills.md",
  "/resume/projects.md",
  "/projects",
  "/projects/marketplace-aggregator.md",
  "/projects/pi-cluster.md",
  "/projects/webassembly-runtime.md",
  "/projects/down-nvim.md",
  "/contact.md",
  "/system/man.txt",
  "/var/log/system.log",
  "/var/log/system_public.log",
  "/var/log/ai.log",
];
const DIRECTORY_PATHS = [
  "/",
  "/app",
  "/bin",
  "/etc",
  "/etc/clpsh",
  "/etc/edit",
  "/etc/themes",
  "/guest",
  "/home",
  "/home/guest",
  "/home/guest/projects",
  "/home/guest/skills",
  "/opt",
  "/posts",
  "/resume",
  "/projects",
  "/root",
  "/system",
  "/tmp",
  "/usr",
  "/var",
  "/var/log",
];
const ARG_HINTS: Record<
  string,
  Array<{ token: string; description: string }>
> = {
  ask: [
    {
      token: "--model=<model>",
      description: "optional Workers AI model override",
    },
    {
      token: "--system=<prompt>",
      description: "optional prompt injection for this request",
    },
    { token: "<question>", description: "question to answer with Workers AI" },
  ],
  book: [
    {
      token: "<your email>",
      description: "where the booking confirmation should go",
    },
    { token: "<date>", description: "requested date, for example 2026-05-18" },
    { token: "<time>", description: "requested local time, for example 14:30" },
    { token: "<duration>", description: "meeting length, for example 30m" },
    { token: "<message>", description: "short context for the meeting" },
  ],
  email: [
    { token: "<your email>", description: "your email" },
    { token: "<subject>", description: "subject line" },
    { token: "<message>", description: "message body" },
  ],
  explain: [
    {
      token: "--model=<model>",
      description: "optional Workers AI model override",
    },
    {
      token: "--system=<prompt>",
      description: "optional prompt injection for this request",
    },
    {
      token: "<project|skill|work|education|command>",
      description: "category to explain",
    },
    {
      token: "<name>",
      description: "specific target, for example market, pi, wasm, or ask",
    },
  ],
  chat: [
    {
      token: "--model=<model>",
      description: "optional Workers AI model for chat",
    },
    {
      token: "--system=<prompt>",
      description: "optional session prompt injection",
    },
  ],
  trace: [{ token: "<website>", description: "site to trace" }],
  weather: [
    {
      token: "<location>",
      description: "optional city; defaults to Seattle, WA",
    },
  ],
  stock: [{ token: "<ticker>", description: "market ticker" }],
  cp: [{ token: "<text>", description: "text copied to clipboard" }],
  echo: [{ token: "<text>", description: "text to print" }],
  find: [{ token: "<query>", description: "file or directory search term" }],
  grep: [{ token: "<query>", description: "text to search for in files" }],
  touch: [
    {
      token: "<path>",
      description: "file to create, for example /guest/note.md",
    },
  ],
  rm: [{ token: "<path>", description: "file to remove" }],
  post: [{ token: "open <slug>", description: "open a post from the index" }],
  new: [
    { token: "post", description: "subcommand for new markdown under /posts/" },
    { token: "--title=", description: "post title (required)" },
    { token: "--tags=", description: "comma-separated tags" },
    { token: "--description=", description: "optional summary" },
    { token: "<body>", description: "markdown body after flags" },
  ],
  sudo: [
    { token: "<command>", description: "command to run after password prompt" },
  ],
  su: [
    {
      token: "<password>",
      description: "optional password to become root for 5 minutes",
    },
  ],
  source: [
    { token: "<path>", description: "shell script or rc file to source" },
  ],
  rag: [
    {
      token: "<add|list|search|clear>",
      description: "manage persistent session context notes",
    },
    { token: "<context>", description: "context text injected into AI calls" },
  ],
  comment: [
    {
      token: "<post>",
      description: "post slug, for example terminal-portfolio-changelog",
    },
    { token: "<name>", description: "display name" },
    { token: "<message>", description: "comment text" },
  ],
  reply: [
    {
      token: "<comment-id>",
      description: "numeric comment id from a post page",
    },
    { token: "<message>", description: "reply text" },
  ],
  theme: [
    {
      token: "<set|list|random>",
      description: "theme subcommand or direct name",
    },
    {
      token: "<name>",
      description:
        "red, amber, frost, ivory, green, magenta, blue, purple, auto",
    },
  ],
  config: [
    { token: "<set|get|list|reset>", description: "config subcommand" },
    {
      token: "<key>",
      description: "theme, syntax_scheme, font_size, font, dark, name, email",
    },
    { token: "<value>", description: "value for the config key" },
  ],
  note: [
    { token: "<add|list|clear>", description: "note subcommand" },
    { token: "<text>", description: "note content (for add)" },
  ],
  alias: [
    { token: "<name>", description: "alias name" },
    { token: "<value>", description: "aliased command" },
  ],
  dig: [{ token: "<hostname>", description: "host to look up" }],
  edit: [{ token: "<path>", description: "file to edit" }],
  mkdir: [{ token: "<path>", description: "directory to create" }],
  tail: [{ token: "<path>", description: "file to read last lines from" }],
  less: [{ token: "<path>", description: "file to view with pagination" }],
};

type ShellFrame = { left: number; top: number; width: number; height: number };

const MIN_SHELL_W = 360;
const MIN_SHELL_H = 320;
const SHELL_FRAME_STORAGE = "pecunies.terminalFrame";
const SHELL_PROFILE_STORAGE = "pecunies.shellProfile";
/** Cap autocomplete rows so the panel never looks like a “153 results” dump. */
const MAX_AUTOCOMPLETE_RESULTS = 14;
/** Root `rem` baseline; persisted as `font_size` in session config (see `zoom in` / `config`). */
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 28;
const FONT_SIZE_DEFAULT = 14;
const FONT_SIZE_STEP = 1;

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
  private readonly themePopover: HTMLElement;
  private readonly promptScramble: HTMLElement;
  private readonly statusScramble: HTMLElement;
  private readonly autocompletePanel: HTMLElement;
  private readonly autocompleteList: HTMLElement;
  private readonly promptLabel: HTMLElement;
  private readonly promptIdentityButton: HTMLButtonElement;
  private readonly identityPopover: HTMLElement;
  private readonly identityDisplayNameInput: HTMLInputElement;
  private readonly identityEnvironmentSelect: HTMLSelectElement;
  private readonly identityModelSelect: HTMLSelectElement;
  private readonly identityEmailInput: HTMLInputElement;
  private readonly identityThemeSelect: HTMLSelectElement;
  private readonly identityDarkModeInput: HTMLInputElement;
  private readonly identityAiToolsInput: HTMLInputElement;
  private readonly identitySkillUseInput: HTMLInputElement;
  private readonly identitySystemPromptInput: HTMLTextAreaElement;
  private readonly identitySaveButton: HTMLButtonElement;
  private readonly identityCancelButton: HTMLButtonElement;
  private readonly dockElement: HTMLButtonElement;
  private readonly siteShellElement: HTMLElement;
  private readonly backButton: HTMLButtonElement;

  private readonly entityHoverPopover: HTMLElement;
  private readonly sudoEditModal: HTMLElement;
  private readonly sudoModalInput: HTMLInputElement;
  private readonly sudoModalError: HTMLElement;
  private contentOverrides = new Map<string, string>();
  private tagUsageCache = new Map<
    string,
    {
      count: number;
      desc: string;
      uses: Array<{ label: string; type: string; command: string }>;
    }
  >();
  private pendingEditKey: string | null = null;
  private pendingEditBtn: HTMLElement | null = null;
  private sudoUnlocked = false;
  private sudoPassword = "";
  private pendingSudoResolve: ((password: string | null) => void) | null = null;
  private ehpHideTimer: ReturnType<typeof setTimeout> | null = null;
  private ehpShowTimer: ReturnType<typeof setTimeout> | null = null;
  private ehpAnchor: HTMLElement | null = null;
  private fieldHandle: AmbientFieldHandle | null = null;
  private manualTheme: ThemeName | null = null;
  private apiTagCache: AutocompleteSuggestion[] = [];
  private apiTagCacheStale = true;
  private activeView: ViewDefinition | null = null;
  private lines: SessionLine[] = [];
  private suppressHashChange = false;
  private isNavigatingBack = false;
  private scrambleFrames = new WeakMap<HTMLElement, number>();
  private suggestions: Suggestion[] = [];
  private suggestionIndex = 0;
  private history: string[] = [];
  private historyIndex: number | null = null;
  private chatMode = false;
  private chatPending = false;
  private gameMode: GameKind | null = null;
  private debugMode = true;
  private pendingPrompt: "ask" | null = null;
  private sensitiveNextInput = false;
  private gameBoard: number[][] = [];
  private gameScore = 0;
  private chessBoard: string[][] = [];
  private chessMoves = 0;
  private minesBoard: MinesCell[][] = [];
  private minesOpenCount = 0;
  private minesGameOver = false;
  private jobQuestState: JobQuestState | null = null;
  private pendingScore: { game: GameKind; score: number } | null = null;
  private readonly sessionId: string;
  private preMaximizeFrame: ShellFrame | null = null;
  private shellWindowingActive = false;
  private shellBindingsDone = false;
  private shellAliases: Record<string, string> = {};
  private identityDisplayName = "guest";
  private identityEnvironment = "pecunies";
  private osCurrentDir = "/home/guest";
  private identityEmail = "";
  private aiModel = DEFAULT_AI_MODEL;
  private systemPromptInjection = "";
  /** When true, `/api/chat` uses Workers AI native tools (`runWithTools`). */
  private aiToolsEnabled = false;
  private skillUseEnabled = false;
  private darkMode = true;
  private syntaxScheme: "default" | "contrast" | "pastel" = "default";
  private suppressNextFocusAutocomplete = false;
  private typingIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private viewHistory: string[] = [];
  private lastRenderedLineCount = 0;
  private terminalFontSizePx = FONT_SIZE_DEFAULT;
  private readonly chatQuoteFab: HTMLButtonElement;
  private chatQuoteFabRaf = 0;
  private chatQuoteSelection = "";

  constructor({ root, commands, featuredCommands }: TerminalAppOptions) {
    this.root = root;
    this.commands = commands;
    this.featuredCommands = featuredCommands;
    this.sessionId = this.getSessionId();
    this.root.innerHTML = renderShell({ featuredCommands });

    this.shellElement = this.requireElement<HTMLElement>("#terminal-shell");
    this.siteShellElement = this.requireElement<HTMLElement>(".site-shell");
    this.outputElement = this.requireElement<HTMLElement>(".terminal-output");
    this.logElement = this.requireElement<HTMLOListElement>("#terminal-log");
    this.viewElement = this.requireElement<HTMLElement>("#active-view");
    this.inputElement =
      this.requireElement<HTMLInputElement>("#terminal-input");
    this.formElement = this.requireElement<HTMLFormElement>("#terminal-form");
    this.routeIndicator = this.requireElement<HTMLElement>("#route-indicator");
    this.themeIndicator = this.requireElement<HTMLElement>("#theme-indicator");
    this.themePopover = this.requireElement<HTMLElement>("#theme-popover");
    this.promptScramble = this.requireElement<HTMLElement>("#prompt-scramble");
    this.statusScramble = this.requireElement<HTMLElement>("#status-scramble");
    this.autocompletePanel = this.requireElement<HTMLElement>(
      "#autocomplete-panel",
    );
    this.autocompleteList =
      this.requireElement<HTMLElement>("#autocomplete-list");
    this.promptLabel = this.requireElement<HTMLElement>(
      "#terminal-prompt-label",
    );
    this.promptIdentityButton = this.requireElement<HTMLButtonElement>(
      "#prompt-identity-button",
    );
    this.identityPopover =
      this.requireElement<HTMLElement>("#identity-popover");
    this.identityDisplayNameInput = this.requireElement<HTMLInputElement>(
      "#identity-display-name",
    );
    this.identityEnvironmentSelect = this.requireElement<HTMLSelectElement>(
      "#identity-environment",
    );
    this.identityModelSelect =
      this.requireElement<HTMLSelectElement>("#identity-model");
    this.identityEmailInput =
      this.requireElement<HTMLInputElement>("#identity-email");
    this.identityThemeSelect =
      this.requireElement<HTMLSelectElement>("#identity-theme");
    this.identityDarkModeInput = this.requireElement<HTMLInputElement>(
      "#identity-dark-mode",
    );
    this.identityAiToolsInput =
      this.requireElement<HTMLInputElement>("#identity-ai-tools");
    this.identitySkillUseInput = this.requireElement<HTMLInputElement>(
      "#identity-skill-use",
    );
    this.identitySystemPromptInput = this.requireElement<HTMLTextAreaElement>(
      "#identity-system-prompt",
    );
    this.identitySaveButton =
      this.requireElement<HTMLButtonElement>("#identity-save");
    this.identityCancelButton =
      this.requireElement<HTMLButtonElement>("#identity-cancel");
    this.dockElement = this.requireElement<HTMLButtonElement>("#terminal-dock");
    this.backButton = this.requireElement<HTMLButtonElement>(
      "#terminal-back-button",
    );
    this.entityHoverPopover = this.requireElement<HTMLElement>(
      "#entity-hover-popover",
    );
    this.sudoEditModal = this.requireElement<HTMLElement>("#sudo-edit-modal");
    this.sudoModalInput =
      this.requireElement<HTMLInputElement>("#sudo-modal-input");
    this.sudoModalError = this.requireElement<HTMLElement>("#sudo-modal-error");
    this.buildTagUsageMap();
    void this.loadContentOverrides();

    this.chatQuoteFab = document.createElement("button");
    this.chatQuoteFab.type = "button";
    this.chatQuoteFab.className = "chat-quote-fab";
    this.chatQuoteFab.hidden = true;
    this.chatQuoteFab.setAttribute("aria-label", "Quote selection into reply");
    const chatQuoteFabReply = document.createElement("span");
    chatQuoteFabReply.className = "chat-quote-fab-reply";
    chatQuoteFabReply.setAttribute("aria-hidden", "true");
    chatQuoteFabReply.textContent = "↩";
    const chatQuoteFabCheck = document.createElement("span");
    chatQuoteFabCheck.className = "chat-quote-fab-check";
    chatQuoteFabCheck.setAttribute("aria-hidden", "true");
    chatQuoteFabCheck.textContent = "✓";
    this.chatQuoteFab.append(chatQuoteFabReply, chatQuoteFabCheck);
    document.body.appendChild(this.chatQuoteFab);
    this.chatQuoteFab.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.applyChatQuoteFromFab();
    });
    this.chatQuoteFab.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    for (const command of this.commands) {
      if (command.route) {
        this.routeMap.set(command.route, command);
      }
    }
    this.restorePersistedHistory();
    this.initCrtFromStorage();
    this.loadShellProfile();
    this.setShellPrompt();
    this.startParallaxLoop();
    this.setupInputCaretClasses();

    this.formElement.addEventListener("submit", (event) => {
      event.preventDefault();

      const raw = this.inputElement.value.trim();
      let submitted = raw;

      if (this.pendingPrompt && raw && !raw.startsWith("/")) {
        submitted = `${this.pendingPrompt} ${raw}`;
        this.pendingPrompt = null;
        this.setShellPrompt();
      }

      if (!submitted) {
        return;
      }

      this.shellElement.classList.add("terminal-submit-pulse");
      window.setTimeout(
        () => this.shellElement.classList.remove("terminal-submit-pulse"),
        520,
      );
      this.siteShellElement.classList.add("site-shell-nudge");
      window.setTimeout(
        () => this.siteShellElement.classList.remove("site-shell-nudge"),
        380,
      );

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
      this.inputElement.value = "";
      this.historyIndex = null;
      this.hideAutocomplete();
    });

    this.inputElement.addEventListener("input", () => {
      this.updateAutocomplete();
    });

    this.inputElement.addEventListener("focus", () => {
      if (this.suppressNextFocusAutocomplete) {
        this.suppressNextFocusAutocomplete = false;
        return;
      }
      if (!this.inputElement.value.trim()) {
        this.hideAutocomplete();
        return;
      }
      this.updateAutocomplete();
    });

    this.promptIdentityButton.addEventListener("click", () => {
      this.toggleIdentityPopover();
    });
    this.themeIndicator.addEventListener("click", () => {
      this.toggleThemePopover();
    });
    this.identityCancelButton.addEventListener("click", () => {
      this.closeIdentityPopover();
    });
    this.identitySaveButton.addEventListener("click", () => {
      void this.saveIdentityFromPopover();
    });
    this.identityThemeSelect.addEventListener("change", () => {
      const nextThemeRaw = this.identityThemeSelect.value.trim().toLowerCase();
      const nextTheme =
        nextThemeRaw === "auto"
          ? null
          : nextThemeRaw in terminalThemes
            ? (nextThemeRaw as ThemeName)
            : this.manualTheme;
      this.manualTheme = nextTheme;
      this.persistShellProfile();
      void this.setConfigQuiet("theme", nextTheme ?? "auto");
      if (this.activeView) {
        this.applyTheme(this.effectiveTheme(this.activeView));
      } else {
        this.applyTheme(this.manualTheme ?? "orange");
      }
    });
    this.identityModelSelect.addEventListener("change", () => {
      const v = this.identityModelSelect.value;
      this.aiModel = isValidWorkersAiModelId(v) ? v : DEFAULT_AI_MODEL;
      this.persistShellProfile();
      void this.setConfigQuiet("ai_model", this.aiModel);
    });
    this.identitySystemPromptInput.addEventListener("input", () => {
      this.systemPromptInjection = this.identitySystemPromptInput.value
        .trim()
        .slice(0, 1200);
      this.persistShellProfile();
    });
    this.identitySystemPromptInput.addEventListener("change", () => {
      this.systemPromptInjection = this.identitySystemPromptInput.value
        .trim()
        .slice(0, 1200);
      this.persistShellProfile();
      void this.setConfigQuiet("system_prompt", this.systemPromptInjection);
    });
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        !this.identityPopover.hidden &&
        !this.identityPopover.contains(target) &&
        !this.promptIdentityButton.contains(target)
      ) {
        this.closeIdentityPopover();
      }
      if (
        !this.themePopover.hidden &&
        !this.themePopover.contains(target) &&
        !this.themeIndicator.contains(target)
      ) {
        this.closeThemePopover();
      }
    });

    /* Keep focus on the input while scrolling or clicking the autocomplete list (avoids blur-close race). */
    this.autocompletePanel.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    this.inputElement.addEventListener("blur", () => {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active && this.autocompletePanel.contains(active)) {
          return;
        }
        this.hideAutocomplete();
      });
    });

    this.inputElement.addEventListener("keydown", (event) => {
      if (!this.suggestions.length) {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          this.restoreHistory(-1);
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          this.restoreHistory(1);
          return;
        }

        if (event.key === "Escape") {
          this.hideAutocomplete();
        }

        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.suggestionIndex =
          (this.suggestionIndex + 1) % this.suggestions.length;
        this.renderAutocomplete();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.suggestionIndex =
          (this.suggestionIndex - 1 + this.suggestions.length) %
          this.suggestions.length;
        this.renderAutocomplete();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const completion = this.selectedCompletion();

        if (!completion) {
          return;
        }

        this.inputElement.value = completion;
        this.inputElement.setSelectionRange(
          completion.length,
          completion.length,
        );
        this.updateAutocomplete();
        return;
      }

      if (event.key === "Escape") {
        this.hideAutocomplete();
      }
    });

    this.shellElement.addEventListener("click", (event) => {
      const target = event.target;

      if (
        target instanceof HTMLElement &&
        target.closest(
          "button, a, input, select, textarea, iframe, [data-command], [data-suggestion-value]",
        )
      ) {
        return;
      }

      this.hideAutocomplete();
      this.suppressNextFocusAutocomplete = true;
      this.inputElement.focus();
    });

    this.root.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const windowAction = target.closest<HTMLElement>("[data-window-action]")
        ?.dataset.windowAction;
      const navAction =
        target.closest<HTMLElement>("[data-nav-action]")?.dataset.navAction;

      if (navAction === "back") {
        void this.goBackToPreviousView();
        return;
      }

      if (
        windowAction === "shutdown" ||
        windowAction === "minimize" ||
        windowAction === "maximize"
      ) {
        this.execute(windowAction);
        return;
      }

      if (target.closest("#terminal-dock")) {
        this.toggleDockWindow();
        return;
      }

      const manCommand =
        target.closest<HTMLElement>("[data-man-command]")?.dataset.manCommand;

      if (manCommand) {
        this.execute(`man ${manCommand}`);
        this.inputElement.value = manCommand;
        this.inputElement.setSelectionRange(
          manCommand.length,
          manCommand.length,
        );
        this.inputElement.focus();
        this.hideAutocomplete();
        return;
      }

      const suggestion = target.closest<HTMLElement>("[data-suggestion-value]")
        ?.dataset.suggestionValue;

      if (suggestion) {
        this.acceptSuggestion(suggestion);
        this.hideAutocomplete();
        return;
      }

      const copyButton = target.closest<HTMLButtonElement>(
        "[data-copy-pretty-id]",
      );
      const copyPrettyId = copyButton?.dataset.copyPrettyId;
      if (copyPrettyId) {
        const line = this.lines.find(
          (entry) =>
            entry.id === copyPrettyId && entry.kind === "pretty-response",
        );
        if (line?.text) {
          void navigator.clipboard?.writeText(line.text).catch(() => undefined);
        }
        if (copyButton) {
          copyButton.classList.add("is-copied");
          copyButton.setAttribute("aria-label", "Copied");
          window.setTimeout(() => {
            copyButton.classList.remove("is-copied");
            copyButton.setAttribute("aria-label", "Copy response");
          }, 1400);
        }
        return;
      }

      const codeCopyButton =
        target.closest<HTMLButtonElement>("[data-copy-code]");
      if (codeCopyButton) {
        const codeBlock = codeCopyButton.closest<HTMLElement>(".md-code-block");
        const code = codeBlock?.querySelector<HTMLElement>("code");
        const codeText = code?.textContent;
        if (codeText) {
          void navigator.clipboard?.writeText(codeText).catch(() => undefined);
          codeCopyButton.classList.add("is-copied");
          codeCopyButton.setAttribute("aria-label", "Copied");
          window.setTimeout(() => {
            codeCopyButton.classList.remove("is-copied");
            codeCopyButton.setAttribute("aria-label", "Copy code");
          }, 1200);
        }
        return;
      }

      if (target.closest(".edit-btn, .edit-save-actions")) {
        return;
      }

      const themeChoice = target.closest<HTMLElement>("[data-theme-choice]")
        ?.dataset.themeChoice;
      if (themeChoice) {
        this.closeThemePopover();
        this.execute(
          themeChoice === "auto" ? "theme auto" : `theme set ${themeChoice}`,
        );
        this.hideAutocomplete();
        return;
      }

      const configAction = target.closest<HTMLElement>("[data-config-action]")
        ?.dataset.configAction;
      if (configAction === "save") {
        void this.saveConfigEditorValues();
        return;
      }
      if (configAction === "reset") {
        void this.resetConfigEditorValues();
        return;
      }

      const signalEditBtn = target.closest<HTMLButtonElement>("[data-signal-edit]");
      if (signalEditBtn) {
        const signalId = signalEditBtn.dataset.signalEdit;
        if (signalId) {
          void this.handleSignalEdit(signalId);
        }
        return;
      }

      const signalRemoveBtn = target.closest<HTMLButtonElement>("[data-signal-remove]");
      if (signalRemoveBtn) {
        const signalId = signalRemoveBtn.dataset.signalRemove;
        if (signalId) {
          void this.handleSignalRemove(signalId);
        }
        return;
      }

      const command =
        target.closest<HTMLElement>("[data-command]")?.dataset.command;
      const prepopulate = target.closest<HTMLElement>(
        "[data-prepopulate-command]",
      )?.dataset.prepopulateCommand;

      if (!command && !prepopulate) {
        return;
      }

      if (command) {
        this.execute(command);
      }
      this.inputElement.value = prepopulate ?? "";
      if (prepopulate) {
        this.inputElement.setSelectionRange(
          prepopulate.length,
          prepopulate.length,
        );
        this.inputElement.focus();
      }
      this.hideAutocomplete();
    });

    window.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        this.inputElement.focus();
        this.inputElement.select();
      }
    });

    document.addEventListener("selectionchange", () => {
      this.scheduleChatQuoteFabUpdate();
    });
    this.outputElement.addEventListener("scroll", () => {
      this.scheduleChatQuoteFabUpdate();
    });

    window.addEventListener("hashchange", () => {
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

    // ── Entity hover popover ─────────────────────────────────────────────
    const entityHoverSelector =
      "[data-command-preview], [data-entity-tag], [data-entity-type][data-entity-slug], [data-entity-skill], [data-entity-link], a[href]";
    this.root.addEventListener("pointerover", (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      const chip = event.target.closest<HTMLElement>(entityHoverSelector);
      if (!chip) return;
      if (this.ehpHideTimer) {
        clearTimeout(this.ehpHideTimer);
        this.ehpHideTimer = null;
      }
      if (this.ehpShowTimer) clearTimeout(this.ehpShowTimer);
      this.ehpAnchor = chip;
      this.ehpShowTimer = window.setTimeout(() => {
        if (this.ehpAnchor === chip) this.showEntityPopover(chip);
      }, 220);
    });
    this.root.addEventListener("pointerout", (event) => {
      const rel = event.relatedTarget;
      if (
        rel instanceof HTMLElement &&
        (rel.closest("#entity-hover-popover") ||
          rel.closest(entityHoverSelector))
      )
        return;
      this.ehpAnchor = null;
      if (this.ehpShowTimer) {
        clearTimeout(this.ehpShowTimer);
        this.ehpShowTimer = null;
      }
      if (this.ehpHideTimer) clearTimeout(this.ehpHideTimer);
      this.ehpHideTimer = window.setTimeout(
        () => this.hideEntityPopover(),
        180,
      );
    });
    this.entityHoverPopover.addEventListener("pointerenter", () => {
      if (this.ehpHideTimer) {
        clearTimeout(this.ehpHideTimer);
        this.ehpHideTimer = null;
      }
    });
    this.entityHoverPopover.addEventListener("pointerleave", () => {
      this.ehpAnchor = null;
      this.ehpHideTimer = window.setTimeout(
        () => this.hideEntityPopover(),
        180,
      );
    });
    this.entityHoverPopover.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest(".ehp-dismiss")) {
        this.removePopoverItemFromContext();
        return;
      }
      if (event.target.closest(".ehp-navigate")) {
        const command = this.entityHoverPopover.dataset.currentCommand ?? "";
        this.hideEntityPopover();
        if (command) this.execute(command);
        return;
      }
      if (event.target.closest(".ehp-remove")) {
        const slug = this.entityHoverPopover.dataset.currentTag ?? "";
        this.hideEntityPopover();
        if (slug) this.removeTagFromContext(slug);
        return;
      }
    });

    // ── In-place editing ─────────────────────────────────────────────────
    this.root.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      const editBtn = event.target.closest<HTMLElement>(
        ".edit-btn[data-edit-key]",
      );
      if (editBtn) {
        const key = editBtn.dataset.editKey ?? "";
        this.showSudoModal(key, editBtn);
        return;
      }
      const addTagBtn = event.target.closest<HTMLElement>(
        ".add-tag-btn[data-add-tag-context]",
      );
      if (addTagBtn) {
        this.showAddTagInput(addTagBtn);
        return;
      }
      const addEntityBtn = event.target.closest<HTMLElement>(
        ".add-skill-btn[data-add-entity-type], .add-quick-link-btn[data-add-entity-type]",
      );
      if (addEntityBtn) {
        this.showAddEntityInput(addEntityBtn);
        return;
      }
    });

    // ── Sudo modal buttons ────────────────────────────────────────────────
    this.sudoEditModal.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (
        event.target.closest("#sudo-cancel-btn") ||
        event.target.closest(".sudo-modal-backdrop")
      ) {
        this.hideSudoModal();
        return;
      }
      if (event.target.closest("#sudo-confirm-btn")) {
        void this.verifySudoAndEdit();
        return;
      }
    });
    this.sudoModalInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        void this.verifySudoAndEdit();
      }
      if (event.key === "Escape") {
        this.hideSudoModal();
      }
    });

    this.setupPointerDepth();
    this.setupShellWindowing();
    this.updateDockState();
    this.updateBackButtonState();
    void this.fetchConfigState();
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

    this.execute("home", {
      echo: false,
      syncHash: true,
      focus: false,
    });
  }

  private removePopoverItemFromContext(): void {
    const currentTag = this.entityHoverPopover.dataset.currentTag ?? "";
    const currentType = this.entityHoverPopover.dataset.currentType ?? "";
    const currentSlug = this.entityHoverPopover.dataset.currentSlug ?? "";
    this.hideEntityPopover();

    if (currentTag) {
      this.removeTagFromContext(currentTag);
      return;
    }

    if (!currentType || !currentSlug) {
      return;
    }

    void this.deleteEntityFromContext(currentType, currentSlug);
  }

  private async deleteEntityFromContext(
    type: string,
    slug: string,
  ): Promise<void> {
    const sudoPassword = await this.ensureSudoPassword();
    if (!sudoPassword) return;
    try {
      const { deleteEntity } = await import("../api");
      await deleteEntity(type as never, slug, sudoPassword);
      this.apiTagCacheStale = true;

      this.outputElement
        .querySelectorAll<HTMLElement>(
          `[data-entity-type="${CSS.escape(type)}"][data-entity-slug="${CSS.escape(slug)}"]`,
        )
        .forEach((el) => {
          el.closest(".editable-wrap")?.remove() ?? el.remove();
        });
    } catch {
      return;
    }
  }

  attachFieldHandle(handle: AmbientFieldHandle): void {
    this.fieldHandle = handle;

    if (this.activeView) {
      this.applyTheme(this.effectiveTheme(this.activeView));
    }
  }

  // ── Tag usage map ───────────────────────────────────────────────────────
  private buildTagUsageMap(): void {
    // Seed from COMMAND_TAGS (command ↔ tag relationships)
    for (const [cmdName, tags] of Object.entries(COMMAND_TAGS) as [
      string,
      string[],
    ][]) {
      for (const tag of tags) {
        if (!this.tagUsageCache.has(tag)) {
          this.tagUsageCache.set(tag, { count: 0, desc: "", uses: [] });
        }
        const entry = this.tagUsageCache.get(tag)!;
        entry.count++;
        entry.uses.push({
          label: `/${cmdName}`,
          type: "command",
          command: cmdName,
        });
      }
    }
  }

  // ── Entity hover popover ────────────────────────────────────────────────
  private linkSlug(value: string): string {
    return (
      String(value || "link")
        .toLowerCase()
        .replace(/https?:\/\//, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "link"
    );
  }

  private showEntityPopover(chip: HTMLElement): void {
    const commandPreview = chip.dataset.commandPreview ?? "";
    if (commandPreview) {
      this.renderCommandPreviewPopover(chip, commandPreview);
      return;
    }

    const tagSlug = chip.dataset.entityTag ?? "";
    const href =
      chip instanceof HTMLAnchorElement
        ? (chip.getAttribute("href") ?? "")
        : "";
    const entityType =
      chip.dataset.entityType ??
      (chip.dataset.entitySkill
        ? "skill"
        : chip.dataset.entityLink || href
          ? "link"
          : "");
    const entitySlug =
      chip.dataset.entitySlug ??
      chip.dataset.entitySkill ??
      chip.dataset.entityLink ??
      (href ? this.linkSlug(chip.textContent?.trim() || href) : "");

    if (href && entityType === "link") {
      if (!chip.dataset.entityTitle)
        chip.dataset.entityTitle = chip.textContent?.trim() || href;
      if (!chip.dataset.entityUrl) chip.dataset.entityUrl = href;
    }

    if (tagSlug) {
      this.renderTagPopover(chip, tagSlug);
      return;
    }

    if (entityType && entitySlug) {
      this.renderCatalogEntityPopover(chip, entityType, entitySlug);
    }
  }

  private positionEntityPopover(anchor: HTMLElement): void {
    const pop = this.entityHoverPopover;
    const rect = anchor.getBoundingClientRect();
    const popW = 300;
    const popH = 220;
    let top = rect.bottom + 6;
    let left = rect.left;
    if (top + popH > window.innerHeight - 12) top = rect.top - popH - 6;
    if (left + popW > window.innerWidth - 12)
      left = window.innerWidth - popW - 12;
    if (left < 8) left = 8;
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    pop.hidden = false;
  }

  private renderCommandPreviewPopover(
    chip: HTMLElement,
    commandText: string,
  ): void {
    const name =
      commandText.replace(/^\//, "").split(/\s+/)[0]?.toLowerCase() ?? "";
    const command = this.resolveCommand(name);
    const pop = this.entityHoverPopover;
    pop.dataset.currentTag = "";
    pop.dataset.currentType = "command";
    pop.dataset.currentSlug = name;
    pop.dataset.currentCommand = commandText;
    pop.dataset.currentHref = "";

    const q = (sel: string) => pop.querySelector<HTMLElement>(sel);
    const typeBadge = q(".ehp-type-badge");
    const nameEl = q(".ehp-name");
    const descEl = q(".ehp-desc");
    const countEl = q(".ehp-count");
    const usesList = q(".ehp-uses");
    const nav = q(".ehp-navigate");
    const remove = q(".ehp-remove");
    if (typeBadge) typeBadge.textContent = "command";
    if (nameEl) nameEl.textContent = commandText;
    if (descEl) descEl.textContent = command?.description ?? "Command preview.";
    if (countEl) countEl.textContent = command?.usage ?? `/${name}`;
    if (usesList) {
      usesList.innerHTML = command
        ? `<li><span class="ehp-use-type">group</span>${this.escapeHtml(command.group)}</li><li><span class="ehp-use-type">click</span>stage command in input</li><li><span class="ehp-use-type">ⓘ</span>open man page</li>`
        : `<li><span class="ehp-use-type">click</span>stage command in input</li>`;
    }
    if (nav) nav.hidden = true;
    if (remove) remove.hidden = true;
    this.positionEntityPopover(chip);
  }

  private renderTagPopover(chip: HTMLElement, slug: string): void {
    const usage = this.tagUsageCache.get(slug);
    const pop = this.entityHoverPopover;
    pop.dataset.currentTag = slug;
    pop.dataset.currentType = "tag";
    pop.dataset.currentCommand = `tags ${slug}`;
    pop.dataset.currentContext = chip.dataset.entityContext ?? "";

    const q = (sel: string) => pop.querySelector<HTMLElement>(sel);
    const typeBadge = q(".ehp-type-badge");
    const nameEl = q(".ehp-name");
    const descEl = q(".ehp-desc");
    const countEl = q(".ehp-count");
    const usesList = q(".ehp-uses");
    const nav = q(".ehp-navigate");

    if (typeBadge) typeBadge.textContent = "tag";
    if (nameEl) nameEl.textContent = `#${slug}`;
    if (descEl) descEl.textContent = usage?.desc || "Loading tag usage…";
    if (countEl)
      countEl.textContent = usage
        ? `${usage.count} use${usage.count !== 1 ? "s" : ""}`
        : "loading uses…";
    if (nav) nav.hidden = true;
    if (usesList) {
      usesList.innerHTML = usage?.uses?.length
        ? usage.uses
            .slice(0, 8)
            .map(
              (u) =>
                `<li data-command="${this.escapeAttribute(u.command)}" data-entity-type="${this.escapeAttribute(u.type)}"><span class="ehp-use-type">${this.escapeHtml(u.type)}</span>${this.escapeHtml(u.label)}</li>`,
            )
            .join("")
        : "<li>Fetching live API uses…</li>";
    }
    this.positionEntityPopover(chip);
    void this.enrichTagUsage(slug);
  }

  private renderCatalogEntityPopover(
    chip: HTMLElement,
    type: string,
    slug: string,
  ): void {
    const pop = this.entityHoverPopover;
    pop.dataset.currentTag = "";
    pop.dataset.currentType = type;
    pop.dataset.currentSlug = slug;
    pop.dataset.currentCommand =
      type === "link" && chip.dataset.entityUrl ? "" : `${type} ${slug}`;
    pop.dataset.currentHref = chip.dataset.entityUrl ?? "";

    const q = (sel: string) => pop.querySelector<HTMLElement>(sel);
    const typeBadge = q(".ehp-type-badge");
    const nameEl = q(".ehp-name");
    const descEl = q(".ehp-desc");
    const countEl = q(".ehp-count");
    const usesList = q(".ehp-uses");
    const nav = q(".ehp-navigate");
    const remove = q(".ehp-remove");

    const fallbackTitle = chip.dataset.entityTitle || slug;
    const fallbackYears = chip.dataset.entityYears || "";
    const fallbackUrl = chip.dataset.entityUrl || "";
    if (typeBadge) typeBadge.textContent = type;
    if (nameEl) nameEl.textContent = fallbackTitle;
    if (descEl)
      descEl.textContent =
        type === "skill"
          ? "Skill details loading…"
          : type === "link"
            ? "Quick link details loading…"
            : "Loading entity details…";
    if (countEl) countEl.textContent = fallbackYears;
    if (usesList)
      usesList.innerHTML = fallbackUrl
        ? `<li><span class="ehp-use-type">url</span>${this.escapeHtml(fallbackUrl)}</li>`
        : "<li>Fetching from API…</li>";
    if (nav) nav.hidden = true;
    if (remove) remove.hidden = true;
    this.positionEntityPopover(chip);

    void this.enrichCatalogEntityPopover(type, slug);
  }

  private hideEntityPopover(): void {
    this.entityHoverPopover.hidden = true;
    this.entityHoverPopover.dataset.currentTag = "";
    this.entityHoverPopover.dataset.currentType = "";
    this.entityHoverPopover.dataset.currentSlug = "";
    this.entityHoverPopover.dataset.currentCommand = "";
    this.entityHoverPopover.dataset.currentHref = "";
    this.entityHoverPopover.dataset.currentContext = "";
    const remove =
      this.entityHoverPopover.querySelector<HTMLElement>(".ehp-remove");
    if (remove) remove.hidden = false;
  }

  private async enrichTagUsage(slug: string): Promise<void> {
    try {
      const { fetchTagUsage } = await import("../api");
      const data = await fetchTagUsage(slug);
      const entry = this.tagUsageCache.get(slug) ?? {
        count: 0,
        desc: "",
        uses: [],
      };
      entry.count = data.count;
      entry.desc = data.description ?? "";
      entry.uses = data.uses ?? entry.uses;
      this.tagUsageCache.set(slug, entry);
      // Refresh popover if still showing this tag
      if (
        this.entityHoverPopover.dataset.currentTag === slug &&
        !this.entityHoverPopover.hidden
      ) {
        const chip =
          this.ehpAnchor ??
          document.querySelector<HTMLElement>(
            `[data-entity-tag="${CSS.escape(slug)}"]`,
          );
        if (chip) this.renderTagPopover(chip, slug);
      }
    } catch {
      /* ignore */
    }
  }

  private async enrichCatalogEntityPopover(
    type: string,
    slug: string,
  ): Promise<void> {
    try {
      const { fetchEntity } = await import("../api");
      const result = await fetchEntity(type as never, slug);
      if (
        !result ||
        this.entityHoverPopover.dataset.currentType !== type ||
        this.entityHoverPopover.dataset.currentSlug !== slug
      )
        return;
      const item = result.item;
      const q = (sel: string) =>
        this.entityHoverPopover.querySelector<HTMLElement>(sel);
      const nameEl = q(".ehp-name");
      const descEl = q(".ehp-desc");
      const countEl = q(".ehp-count");
      const usesList = q(".ehp-uses");
      if (nameEl) nameEl.textContent = item.title || item.slug;
      if (descEl)
        descEl.textContent =
          item.description || item.summary || "No description.";
      const bits = [
        item.category,
        item.status,
        item.yearsOfExperience ? `${item.yearsOfExperience}y experience` : "",
      ].filter(Boolean);
      if (countEl) countEl.textContent = bits.join(" · ");
      const rows = [
        ...(item.metadata?.url
          ? [{ type: "url", label: item.metadata.url }]
          : []),
        ...(item.tags ?? [])
          .slice(0, 6)
          .map((tag) => ({ type: "tag", label: `#${tag}` })),
        ...result.usedBy
          .slice(0, 4)
          .map((use) => ({ type: use.type, label: use.title })),
      ];
      if (usesList) {
        usesList.innerHTML = rows.length
          ? rows
              .map(
                (row) =>
                  `<li><span class="ehp-use-type">${this.escapeHtml(row.type)}</span>${this.escapeHtml(row.label)}</li>`,
              )
              .join("")
          : "<li>No linked uses yet.</li>";
      }
    } catch {
      const q = (sel: string) =>
        this.entityHoverPopover.querySelector<HTMLElement>(sel);
      const usesList = q(".ehp-uses");
      if (usesList && usesList.textContent?.includes("Fetching"))
        usesList.innerHTML = "<li>No persisted API entity yet.</li>";
    }
  }

  private async ensureSudoPassword(): Promise<string | null> {
    if (this.sudoUnlocked && this.sudoPassword) return this.sudoPassword;

    // Use the custom modal instead of native prompt
    return new Promise((resolve) => {
      this.sudoModalInput.value = "";
      this.sudoModalInput.autocomplete = "off";
      this.sudoModalError.hidden = true;
      this.sudoEditModal.hidden = false;
      this.pendingSudoResolve = resolve;
      window.setTimeout(() => this.sudoModalInput.focus(), 30);
    });
  }

  private parseEntityContext(
    context: string,
  ): { type: string; slug: string } | null {
    const [type, ...rest] = context.split(":");
    const slug = rest.join(":");
    if (!type || !slug) return null;
    return { type, slug };
  }

  private async persistTagMutation(
    context: string,
    tag: string,
    add: boolean,
  ): Promise<boolean> {
    const parsed = this.parseEntityContext(context);
    if (!parsed) return false;
    try {
      const { mutateTag } = await import("../api");
      await mutateTag({
        type: parsed.type as never,
        slug: parsed.slug,
        tag,
        add,
      });
      this.apiTagCacheStale = true;
      return true;
    } catch {
      return false;
    }
  }

  private removeTagFromContext(slug: string): void {
    const context =
      this.entityHoverPopover.dataset.currentContext ??
      this.ehpAnchor?.dataset.entityContext ??
      "";
    if (!context) return;

    const type = this.entityHoverPopover.dataset.currentType ?? "";

    // For catalog entities (skills, links, etc.), we need to remove from the view's tags array
    if (type && type !== "tag") {
      void this.persistEntityRemoval(context, type, slug).then((ok) => {
        if (!ok) return;
        this.outputElement
          .querySelectorAll<HTMLElement>(
            `[data-entity-slug="${CSS.escape(slug)}"][data-entity-type="${CSS.escape(type)}"][data-entity-context="${CSS.escape(context)}"]`,
          )
          .forEach((el) => {
            el.closest(".editable-wrap")?.remove() ?? el.remove();
          });
      });
      return;
    }

    // For tags, use the existing tag mutation logic
    void this.persistTagMutation(context, slug, false).then((ok) => {
      if (!ok) return;
      this.outputElement
        .querySelectorAll<HTMLElement>(
          `[data-entity-tag="${CSS.escape(slug)}"][data-entity-context="${CSS.escape(context)}"]`,
        )
        .forEach((el) => {
          el.closest(".editable-wrap")?.remove() ?? el.remove();
        });
    });
  }

  private persistEntityRemoval(
    context: string,
    entityType: string,
    entitySlug: string,
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const parsed = this.parseEntityContext(context);
      if (!parsed) {
        resolve(false);
        return;
      }

      try {
        const { fetchEntity, upsertEntity } = await import("../api");
        const entity = await fetchEntity(parsed.type as never, parsed.slug);
        if (!entity) {
          resolve(false);
          return;
        }

        // Remove the entity from the view's tags array
        const updatedTags = (entity.item.tags || []).filter(
          (tag: string) => {
            // For skills/links, they're stored as tags like "skill:slug" or just the entity type
            if (tag === entitySlug) return false;
            if (tag === `${entityType}:${entitySlug}`) return false;
            return true;
          }
        );

        const sudoPassword = await this.ensureSudoPassword();
        if (!sudoPassword) {
          resolve(false);
          return;
        }

        await upsertEntity(
          { ...entity.item, tags: updatedTags },
          sudoPassword
        );
        this.apiTagCacheStale = true;

        // Refresh the view to show updated data
        const currentRoute = this.currentView?.route;
        if (currentRoute) {
          void this.navigate(currentRoute);
        }

        resolve(true);
      } catch {
        resolve(false);
      }
    });
  }

  // ── Add tag inline input ────────────────────────────────────────────────
  private showAddTagInput(btn: HTMLElement): void {
    const wrap = document.createElement("span");
    wrap.className = "add-tag-input-wrap";
    const input = document.createElement("input");
    input.className = "add-tag-input";
    input.type = "text";
    input.placeholder = "#tag";
    input.autocomplete = "off";
    wrap.appendChild(input);
    btn.replaceWith(wrap);
    input.focus();

    const commit = () => {
      const val = input.value.replace(/^#/, "").trim().toLowerCase();
      const context = btn.dataset.addTagContext ?? "";
      if (!val) {
        wrap.replaceWith(btn);
        return;
      }
      void this.persistTagMutation(context, val, true).then((ok) => {
        wrap.replaceWith(btn);
        if (!ok) return;
        const tagRow = btn.closest(".view-tag-row");
        if (tagRow) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "content-tag";
          chip.dataset.command = `tags ${val}`;
          chip.dataset.entityTag = val;
          chip.dataset.entityContext = context;
          chip.textContent = `#${val}`;
          tagRow.insertBefore(chip, btn);
        }
      });
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        wrap.replaceWith(btn);
      }
    });
  }

  private showAddEntityInput(btn: HTMLElement): void {
    const type = btn.dataset.addEntityType ?? "link";
    const wrap = document.createElement("span");
    wrap.className = "add-entity-input-wrap";
    const input = document.createElement("input");
    input.className = "add-entity-input";
    input.type = "text";
    input.placeholder =
      type === "skill" ? "Skill - 2 years" : "Label | https://…";
    input.autocomplete = "off";
    wrap.appendChild(input);
    btn.replaceWith(wrap);
    input.focus();

    const slugify = (value: string) =>
      value
        .toLowerCase()
        .replace(/https?:\/\//, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `${type}-${Date.now().toString(36)}`;
    const commit = () => {
      const raw = input.value.trim();
      if (!raw) {
        wrap.replaceWith(btn);
        return;
      }
      void this.persistNewEntity(type, raw, slugify).then((entity) => {
        wrap.replaceWith(btn);
        if (!entity) return;
        if (type === "skill") {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.dataset.command = `skill ${entity.slug}`;
          chip.dataset.entityType = "skill";
          chip.dataset.entitySlug = entity.slug;
          chip.dataset.entityTitle = entity.title;
          chip.textContent = entity.title;
          btn.parentElement?.insertBefore(chip, btn);
        } else {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "action-chip";
          chip.dataset.command = `link ${entity.slug}`;
          chip.dataset.entityType = "link";
          chip.dataset.entitySlug = entity.slug;
          chip.dataset.entityTitle = entity.title;
          if (entity.metadata?.url)
            chip.dataset.entityUrl = entity.metadata.url;
          chip.textContent = entity.title;
          btn.parentElement?.insertBefore(chip, btn);
        }
      });
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") wrap.replaceWith(btn);
    });
  }

  private async persistNewEntity(
    type: string,
    raw: string,
    slugify: (value: string) => string,
  ): Promise<any | null> {
    const [labelRaw, urlRaw] = raw.split("|").map((part) => part.trim());
    const title = labelRaw || raw;
    const yearsMatch =
      type === "skill" ? raw.match(/-\s*([0-9.]+)\+?\s+years?/i) : null;
    const cleanTitle =
      type === "skill"
        ? title.replace(/\s+-\s+[0-9.]+\+?\s+years?$/i, "").trim()
        : title;

    const sudoPassword = await this.ensureSudoPassword();
    if (!sudoPassword) return null;

    try {
      const { upsertEntity } = await import("../api");
      const entity = {
        type: type as never,
        slug: slugify(cleanTitle),
        title: cleanTitle,
        category: type === "skill" ? "custom" : "quick-link",
        description:
          type === "skill"
            ? `${cleanTitle} skill.`
            : `Quick link for ${cleanTitle}.`,
        tags: type === "skill" ? ["skills"] : ["links", "quick-link"],
        yearsOfExperience: yearsMatch ? Number(yearsMatch[1]) : undefined,
        metadata:
          type === "link" && urlRaw
            ? { url: urlRaw, source: "quick-link" }
            : {},
      };
      return await upsertEntity(entity, sudoPassword);
    } catch {
      return null;
    }
  }

  // ── In-place editing ────────────────────────────────────────────────────
  private setEditBtnState(
    btn: HTMLElement | null,
    state: "spinner" | "ok" | "error" | "idle",
  ): void {
    if (!btn) return;
    const icons: Record<string, string> = {
      spinner: "⟳",
      ok: "✓",
      error: "✗",
      idle: "✎",
    };
    btn.textContent = icons[state] ?? "✎";
    btn.classList.toggle("edit-btn--ok", state === "ok");
    btn.classList.toggle("edit-btn--error", state === "error");
    btn.classList.toggle("edit-btn--spinning", state === "spinner");
  }

  private showSudoModal(key: string, btn?: HTMLElement): void {
    this.pendingEditKey = key;
    this.pendingEditBtn = btn ?? null;
    this.sudoModalInput.value = "";
    this.sudoModalInput.autocomplete = "off";
    this.sudoModalError.hidden = true;
    this.sudoEditModal.hidden = false;
    this.setEditBtnState(this.pendingEditBtn, "spinner");
    window.setTimeout(() => this.sudoModalInput.focus(), 30);
  }

  private hideSudoModal(): void {
    this.sudoEditModal.hidden = true;
    this.setEditBtnState(this.pendingEditBtn, "idle");
    this.pendingEditKey = null;
    this.pendingEditBtn = null;
    this.sudoModalInput.value = "";
  }

  private async verifySudoAndEdit(): Promise<void> {
    if (this.sudoUnlocked) {
      const key = this.pendingEditKey;
      const btn = this.pendingEditBtn;
      this.hideSudoModal();
      if (key) this.enableEditing(key);
      this.setEditBtnState(btn, "ok");
      window.setTimeout(() => this.setEditBtnState(btn, "idle"), 1200);
      return;
    }
    const password = this.sudoModalInput.value;
    if (!password) return;
    try {
      const { verifySudoPassword } = await import("../api");
      const result = await verifySudoPassword(password);
      if (result.ok) {
        this.sudoUnlocked = true;
        this.sudoPassword = password;
        const key = this.pendingEditKey;
        const btn = this.pendingEditBtn;
        this.hideSudoModal();
        if (key) this.enableEditing(key);
        this.setEditBtnState(btn, "ok");
        window.setTimeout(() => this.setEditBtnState(btn, "idle"), 1200);
      } else {
        this.setEditBtnState(this.pendingEditBtn, "error");
        window.setTimeout(
          () => this.setEditBtnState(this.pendingEditBtn, "spinner"),
          700,
        );
        this.sudoModalError.textContent = "Incorrect password.";
        this.sudoModalError.hidden = false;
        this.sudoModalInput.value = "";
        this.sudoModalInput.focus();
      }
    } catch {
      this.setEditBtnState(this.pendingEditBtn, "error");
      this.sudoModalError.textContent = "Authentication error.";
      this.sudoModalError.hidden = false;
    }
  }

  private enableEditing(key: string): void {
    const target = document.querySelector<HTMLElement>(
      `[data-edit-key="${CSS.escape(key)}"]`,
    );
    if (!target) return;
    const original = target.textContent ?? "";
    target.contentEditable = "plaintext-only";
    target.focus();

    // Overlay save/cancel actions without changing text flow.
    const actions = document.createElement("span");
    actions.className = "edit-save-actions";
    const saveBtn = document.createElement("button");
    saveBtn.className = "edit-save-btn";
    saveBtn.textContent = "Save";
    saveBtn.type = "button";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "edit-cancel-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.type = "button";
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    (target.closest(".editable-wrap") ?? target).appendChild(actions);

    const finish = (save: boolean) => {
      const newVal = target.textContent ?? "";
      target.contentEditable = "inherit";
      actions.remove();
      if (save && newVal !== original) {
        this.contentOverrides.set(key, newVal);
        void this.persistContentOverride(key, newVal);
      } else if (!save) {
        target.textContent = original;
      }
    };

    saveBtn.addEventListener("click", () => finish(true));
    cancelBtn.addEventListener("click", () => finish(false));
    target.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        }
        if (e.key === "Escape") finish(false);
      },
      { once: true },
    );
  }

  // ── Content overrides (persisted via API) ───────────────────────────────
  private async loadContentOverrides(): Promise<void> {
    try {
      const { fetchContentOverrides } = await import("../api");
      const overrides = await fetchContentOverrides();
      for (const [k, v] of Object.entries(overrides)) {
        this.contentOverrides.set(k, v);
      }
      this.applyContentOverrides();
    } catch {
      /* ignore — no overrides yet */
    }
  }

  private applyContentOverrides(): void {
    for (const [key, value] of this.contentOverrides) {
      const el = document.querySelector<HTMLElement>(
        `[data-edit-key="${CSS.escape(key)}"]`,
      );
      if (el && !el.isContentEditable) el.textContent = value;
    }
  }

  private async persistContentOverride(
    key: string,
    value: string,
  ): Promise<void> {
    try {
      const { saveContentOverride } = await import("../api");
      await saveContentOverride(key, value);
    } catch {
      /* ignore */
    }
  }

  private async execute(
    rawInput: string,
    options: ExecuteOptions = {},
  ): Promise<void> {
    const echo = options.echo ?? true;
    const syncHash = options.syncHash ?? true;
    const focus = options.focus ?? true;
    const recordHistory = options.recordHistory ?? echo;
    const normalized = rawInput.trim();

    if (!normalized) {
      return;
    }

    this.setTitlebarFromCommand(normalized);

    if (normalized === "!!") {
      const lastCommand = this.history.at(-1);
      if (!lastCommand) {
        if (echo) {
          this.lines.push(this.commandLine("!!"));
        }
        this.lines.push(this.responseLine("!!: event not found", "warn"));
        this.renderLog();
        if (focus) {
          this.inputElement.focus();
        }
        return;
      }

      if (echo) {
        this.lines.push(this.commandLine("!!"));
        this.lines.push(this.responseLine(lastCommand, "info"));
      }

      await this.execute(lastCommand, {
        echo: false,
        syncHash,
        focus,
        recordHistory,
      });
      return;
    }

    /* Pending sudo/su password: send raw line to the worker (handlePendingAuth); do not resolve as a shell command. */
    if (this.sensitiveNextInput) {
      void this.sendOsCommand(normalized);
      if (focus) {
        this.inputElement.focus();
      }
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
      this.setShellPrompt();
      this.lines.push(
        this.responseLine(
          "Game session closed; running terminal command.",
          "info",
        ),
      );
    }

    const bootTok = normalized.toLowerCase();
    if (bootTok === "boot" || bootTok === "reboot" || bootTok === "init") {
      if (echo) {
        this.lines.push(this.commandLine(normalized));
      }
      if (recordHistory) {
        this.pushHistory(normalized);
      }
      void this.recordCommand(normalized);
      void this.runBootSequence(bootTok as "boot" | "reboot" | "init");
      return;
    }

    const shorthandExpanded =
      normalized === ".." ? "cd .." : normalized === "." ? "pwd" : normalized;
    const historyExpanded = this.expandHistoryShorthands(shorthandExpanded);
    const expandedLine = this.expandShellAliases(historyExpanded);
    const { name, args } = this.parseCommand(expandedLine);

    if (name === "chat" && args.length > 0) {
      const firstPrompt = this.applyAiCliFlags(args).join(" ").trim();
      if (echo) this.lines.push(this.commandLine(normalized));
      if (recordHistory) {
        this.pushHistory(normalized);
      }
      void this.recordCommand(normalized);
      this.applyOutcome(
        {
          kind: "chat",
          text: "Chat mode active. Ask about Chris, his work history, or projects. Use /model and /context for Workers AI settings; /exit to leave.",
          tone: "success",
        },
        this.resolveCommand("chat") ?? this.commands[0]!,
        syncHash,
      );
      this.renderLog();
      if (firstPrompt) {
        await this.sendChat(firstPrompt);
      }
      if (focus) {
        this.inputElement.focus();
      }
      return;
    }

    if (
      name === "config" &&
      (!args.length || args[0]?.toLowerCase() === "edit")
    ) {
      if (echo) {
        this.lines.push(this.commandLine(normalized));
      }
      if (recordHistory) {
        this.pushHistory(normalized);
      }
      void this.recordCommand(normalized);
      await this.openConfigView(syncHash);
      this.renderLog();
      if (focus) {
        this.inputElement.focus();
      }
      return;
    }

    /* Handle debug locally — toggles the debugMode field and skips or enables verbose logging. */
    if (name === "debug") {
      if (echo) {
        this.lines.push(this.commandLine(normalized));
      }
      if (recordHistory) {
        this.pushHistory(normalized);
      }
      const action = args[0]?.toLowerCase();
      this.debugMode = action === "off" ? false : true;
      this.lines.push(
        this.responseLine(
          `Debug logging ${this.debugMode ? "enabled" : "disabled"}.`,
          "info",
        ),
      );
      void this.recordCommand(normalized);
      this.renderLog();
      if (focus) {
        this.inputElement.focus();
      }
      return;
    }

    /* Font zoom: `zoom` alone remains the maximize alias; subcommands adjust root rem via `font_size`. */
    if (name === "zoom" && args.length > 0) {
      const sub = args[0]?.toLowerCase();
      if (sub === "in" || sub === "out" || sub === "reset") {
        if (echo) {
          this.lines.push(this.commandLine(normalized));
        }
        if (recordHistory) {
          this.pushHistory(normalized);
        }
        void this.recordCommand(normalized);
        const cur = this.terminalFontSizePx;
        let next = cur;
        let note: string | null = null;
        if (sub === "in") {
          if (cur >= FONT_SIZE_MAX)
            note = `Already at maximum (${FONT_SIZE_MAX}px).`;
          else next = cur + FONT_SIZE_STEP;
        } else if (sub === "out") {
          if (cur <= FONT_SIZE_MIN)
            note = `Already at minimum (${FONT_SIZE_MIN}px).`;
          else next = cur - FONT_SIZE_STEP;
        } else {
          next = FONT_SIZE_DEFAULT;
        }
        if (note) this.lines.push(this.responseLine(note, "info"));
        else {
          void this.setTerminalFontSizeAndPersist(next);
          this.lines.push(
            this.responseLine(
              sub === "reset"
                ? `Font size reset to ${FONT_SIZE_DEFAULT}px.`
                : `Font size ${next}px.`,
              "success",
            ),
          );
        }
        this.renderLog();
        if (focus) {
          this.inputElement.focus();
        }
        return;
      }
      if (echo) {
        this.lines.push(this.commandLine(normalized));
      }
      if (recordHistory) {
        this.pushHistory(normalized);
      }
      void this.recordCommand(normalized);
      this.lines.push(
        this.responseLine(
          "Usage: zoom in | zoom out | zoom reset — or type zoom alone to toggle fullscreen (maximize).",
          "warn",
        ),
      );
      this.renderLog();
      if (focus) {
        this.inputElement.focus();
      }
      return;
    }

    const command = this.resolveCommand(name);

    if (!command) {
      if (echo) {
        this.lines.push(this.commandLine(normalized));
      }
      if (recordHistory) {
        this.pushHistory(normalized);
      }
      /* Pipelines and other OS-only lines still run on the worker if they use | */
      if (normalized.includes("|")) {
        void this.sendOsCommand(normalized);
        if (focus) {
          this.inputElement.focus();
        }
        return;
      }

      if (this.splitShellArgs(expandedLine).length >= 2) {
        void this.recordCommand(normalized);
        void this.sendOsCommand(`ask ${expandedLine}`);
        if (focus) {
          this.inputElement.focus();
        }
        return;
      }

      void this.recordCommand(normalized);
      const suggestion = this.closestCommands(name);
      const suffix = suggestion.length
        ? ` Try ${suggestion.join(", ")}.`
        : " Try help.";
      this.lines.push(
        this.responseLine(`Unknown command "${name}".${suffix}`, "warn"),
      );
      this.renderLog();

      if (focus) {
        this.inputElement.focus();
      }

      return;
    }

    if (name === "ask" && !args.length) {
      if (echo) {
        this.lines.push(this.commandLine(normalized));
      }
      if (recordHistory) {
        this.pushHistory(normalized);
      }
      this.pendingPrompt = "ask";
      this.promptLabel.textContent = "ask?>";
      this.lines.push(this.responseLine("Question:", "info"));
      this.renderLog();

      if (focus) {
        this.inputElement.focus();
      }

      return;
    }

    if ((name === "ask" || name === "explain") && args.length) {
      this.applyAiCliFlags(args);
    }

    const outcome = await Promise.resolve(
      command.execute(this.commandContext(), args, normalized),
    );
    bumpCommandFrequency(name);
    if (outcome.kind === "os") {
      if (echo) {
        this.lines.push(this.commandLine(normalized));
      }
      if (recordHistory) {
        this.pushHistory(normalized);
      }
      this.copyIfClipboardCommand(outcome.command);
      void this.sendOsCommand(outcome.command);
      return;
    }

    const fullPage =
      (outcome.kind === "view" && command.fullPageView) ||
      outcome.kind === "markdown-view";
    if (fullPage) {
      this.clearTerminal();
      this.outputElement.dataset.pinTop = "true";
    }

    if (echo) {
      this.lines.push(this.commandLine(normalized));
    }
    if (recordHistory) {
      this.pushHistory(normalized);
    }

    void this.recordCommand(normalized);
    this.applyOutcome(outcome, command, syncHash);
    this.renderLog();

    if (focus) {
      this.inputElement.focus();
    }
  }

  private applyOutcome(
    outcome: CommandOutcome,
    command: CommandDefinition,
    syncHash: boolean,
  ): void {
    if (outcome.kind === "markdown-view") {
      this.chatMode = false;
      this.gameMode = null;
      this.setShellPrompt();
      this.lines.push({
        id: this.makeId(),
        kind: "pretty-response",
        html: outcome.html,
        text: outcome.text,
      });
      this.triggerViewSwitchFeedback("post");
      this.highlightNavLink(null);
      return;
    }

    if (outcome.kind === "clear") {
      this.clearTerminal();
      this.renderLog();
      this.inputElement.focus();
      this.writeRoute("");
      return;
    }

    if (outcome.kind === "chat") {
      this.chatMode = true;
      this.gameMode = null;
      this.promptLabel.textContent = "chat>";
      this.triggerViewSwitchFeedback("chat");
      this.themeIndicator.textContent = "workers-ai";
      this.highlightNavLink("chat");
      this.lines.push(
        this.responseLine(outcome.text, outcome.tone ?? "success"),
      );

      if (syncHash) {
        this.writeRoute(command.route ?? "chat");
      }

      return;
    }

    if (outcome.kind === "exit") {
      this.chatMode = false;
      this.gameMode = null;
      this.setShellPrompt();
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? "info"));
      if (this.activeView)
        this.applyTheme(this.effectiveTheme(this.activeView));
      else this.applyTheme(this.manualTheme ?? "orange");
      return;
    }

    if (outcome.kind === "game") {
      this.chatMode = false;
      this.startGame(outcome.game);
      this.promptLabel.textContent = `${outcome.game}>`;
      this.routeIndicator.textContent = outcome.game;
      this.themeIndicator.textContent = "tui";
      this.highlightNavLink(null);
      this.lines.push(
        this.responseLine(outcome.text, outcome.tone ?? "success"),
      );
      this.lines.push(this.responseLine(this.renderGame(), "info"));
      void this.sendOsCommand(`leaderboard ${outcome.game}`);
      return;
    }

    if (outcome.kind === "url") {
      window.open(outcome.url, "_blank", "noopener");
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? "info"));
      return;
    }

    if (outcome.kind === "system") {
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? "info"));

      if (this.activeView) {
        this.applyTheme(this.effectiveTheme(this.activeView));
      }

      return;
    }

    if (outcome.kind === "window") {
      this.lines.push(
        this.responseLine(
          outcome.text ?? outcome.action,
          outcome.tone ?? "info",
        ),
      );
      this.applyWindowAction(outcome.action);
      return;
    }

    if (outcome.kind === "download") {
      this.lines.push(
        this.responseLine(
          outcome.text ?? "Downloading resume.",
          outcome.tone ?? "success",
        ),
      );
      this.downloadResume(outcome.format);
      return;
    }

    if (outcome.kind === "os") {
      this.copyIfClipboardCommand(outcome.command);
      void this.sendOsCommand(outcome.command);
      return;
    }

    const previousRoute = this.activeView?.route ?? "";
    const nextRoute = outcome.view.route ?? "";
    if (!this.isNavigatingBack && previousRoute !== nextRoute) {
      this.viewHistory.push(previousRoute);
    }
    this.activeView = outcome.view;
    this.chatMode = false;
    this.gameMode = null;
    this.setShellPrompt();
    const viewHtml = renderView(outcome.view);
    this.lines.push({
      id: this.makeId(),
      kind: "view",
      html: viewHtml,
      text: this.viewText(outcome.view),
    });
    // Apply any persisted content overrides after the new view is in the lines buffer
    window.setTimeout(() => this.applyContentOverrides(), 0);
    this.triggerViewSwitchFeedback(outcome.view.route || "home");
    this.highlightNavLink(outcome.view.id);
    this.scrambleText(this.promptScramble, outcome.view.prompt);
    this.scrambleText(this.statusScramble, outcome.view.description);
    this.applyTheme(this.effectiveTheme(outcome.view));
    void this.recordMetric(outcome.view.route);
    this.pulseView();
    if (outcome.view.id === "posts") {
      void this.loadPosts();
    }

    if (syncHash) {
      this.writeRoute(command.route ?? outcome.view.route);
    }
    this.updateBackButtonState();
  }

  private applyTheme(themeName: ThemeName): void {
    const theme = terminalThemes[themeName];

    document.documentElement.style.setProperty("--bg", theme.depth);
    document.documentElement.style.setProperty("--panel", theme.panel);
    document.documentElement.style.setProperty(
      "--panel-strong",
      theme.panelStrong,
    );
    document.documentElement.style.setProperty("--line", theme.line);
    document.documentElement.style.setProperty(
      "--line-strong",
      theme.lineStrong,
    );
    document.documentElement.style.setProperty("--accent", theme.accent);
    document.documentElement.style.setProperty(
      "--accent-strong",
      theme.accentStrong,
    );
    document.documentElement.style.setProperty(
      "--accent-soft",
      theme.accentSoft,
    );
    document.documentElement.style.setProperty("--glow", theme.glow);
    document.documentElement.style.setProperty(
      "--bg-accent-a",
      theme.backgroundA,
    );
    document.documentElement.style.setProperty(
      "--bg-accent-b",
      theme.backgroundB,
    );
    document.documentElement.style.setProperty(
      "--bg-gradient-hue",
      `${theme.gradientHue}deg`,
    );
    document.documentElement.style.setProperty("--ink", theme.text);
    document.documentElement.style.setProperty("--ink-dim", theme.textDim);
    document.documentElement.style.setProperty("--muted", theme.muted);
    document.documentElement.style.setProperty("--accent-dim", theme.accentDim);
    this.themeIndicator.textContent = "theme";
    this.themeIndicator.setAttribute("data-theme-current", themeName);
    this.fieldHandle?.setMode(theme.mode);
    this.fieldHandle?.burst();
  }

  private effectiveTheme(view: ViewDefinition): ThemeName {
    return this.manualTheme ?? view.theme;
  }

  private initCrtFromStorage(): void {
    try {
      const v = localStorage.getItem("pecunies.crt");
      this.applyCrtMode(v !== "off");
    } catch {
      this.applyCrtMode(true);
    }
  }

  private applyOsConfig(config: Record<string, unknown>): void {
    if ("theme" in config) {
      const rawTheme = String(config.theme || "")
        .trim()
        .toLowerCase();
      if (rawTheme === "auto") this.manualTheme = null;
      else if (rawTheme in terminalThemes)
        this.manualTheme = rawTheme as ThemeName;
      if (this.activeView)
        this.applyTheme(this.effectiveTheme(this.activeView));
      else this.applyTheme(this.manualTheme ?? "orange");
    }
    if ("dark" in config) {
      const raw = config.dark;
      this.applyDarkMode(
        !(raw === false || raw === "false" || raw === "off" || raw === "light"),
      );
    }
    if ("crt" in config) {
      const raw = config.crt;
      let on = true;
      if (raw === false || raw === "false" || raw === "off") on = false;
      else if (raw === true || raw === "true" || raw === "on") on = true;
      else if (typeof raw === "string")
        on = raw.toLowerCase() !== "off" && raw.toLowerCase() !== "false";
      this.applyCrtMode(on);
    }
    if ("name" in config)
      this.identityDisplayName = this.normalizeIdentityPart(
        config.name,
        "guest",
      );
    if ("environment" in config)
      this.identityEnvironment = this.normalizeIdentityPart(
        config.environment,
        "pecunies",
      );
    if ("ai_model" in config) {
      const rawModel = String(config.ai_model || "").trim();
      this.aiModel = isValidWorkersAiModelId(rawModel)
        ? rawModel
        : DEFAULT_AI_MODEL;
    }
    if ("email" in config)
      this.identityEmail = String(config.email ?? "")
        .trim()
        .slice(0, 120);
    if ("system_prompt" in config)
      this.systemPromptInjection = String(config.system_prompt ?? "").slice(
        0,
        1200,
      );
    if ("ai_tools" in config) {
      const raw = config.ai_tools;
      this.aiToolsEnabled =
        raw === true ||
        String(raw).toLowerCase() === "true" ||
        String(raw) === "1";
    }
    if ("skill_use" in config) {
      const raw = config.skill_use;
      this.skillUseEnabled =
        raw === true ||
        String(raw).toLowerCase() === "true" ||
        String(raw) === "1";
    }
    if ("syntax_scheme" in config) {
      const raw = String(config.syntax_scheme ?? "")
        .trim()
        .toLowerCase();
      this.applySyntaxScheme(
        raw === "contrast" || raw === "pastel" ? raw : "default",
      );
    }
    if ("font_size" in config) {
      const raw = Number(config.font_size);
      if (Number.isFinite(raw)) this.applyTerminalFontSize(raw);
    }
    this.persistShellProfile();
    this.updatePromptIdentityUi();
  }

  private applyTerminalFontSize(px: number): void {
    const clamped = Math.min(
      FONT_SIZE_MAX,
      Math.max(FONT_SIZE_MIN, Math.round(px)),
    );
    this.terminalFontSizePx = clamped;
    document.documentElement.style.fontSize = `${clamped}px`;
  }

  private async setTerminalFontSizeAndPersist(px: number): Promise<void> {
    const clamped = Math.min(
      FONT_SIZE_MAX,
      Math.max(FONT_SIZE_MIN, Math.round(px)),
    );
    this.applyTerminalFontSize(clamped);
    await this.setConfigQuiet("font_size", String(clamped));
  }

  private applySyntaxScheme(scheme: "default" | "contrast" | "pastel"): void {
    this.syntaxScheme = scheme;
    document.documentElement.setAttribute("data-syntax-scheme", scheme);
  }

  private normalizeIdentityPart(value: unknown, fallback: string): string {
    const next = String(value ?? "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    return next.slice(0, 24) || fallback;
  }

  /** Simulated OS home directory; must stay aligned with `sanitizeUsername` in `functions/api/os.js`. */
  private osUserHomeDir(): string {
    return `/home/${this.normalizeIdentityPart(this.identityDisplayName, "guest")}`;
  }

  private osHomePathSuggestions(): string[] {
    const h = this.osUserHomeDir();
    return [
      h,
      `${h}/.clpshrc`,
      `${h}/.clpsh_history`,
      `${h}/projects`,
      `${h}/skills`,
    ];
  }

  private currentIdentityPrompt(): string {
    const home = this.osUserHomeDir();
    const raw = (this.osCurrentDir || home).trim() || home;
    const normalized = raw.startsWith("/") ? raw : `/${raw}`;
    const displayPath =
      normalized === home
        ? "~"
        : normalized.startsWith(`${home}/`)
          ? `~${normalized.slice(home.length)}`
          : normalized;
    return `${this.identityDisplayName}@${this.identityEnvironment}:${displayPath}$`;
  }

  private setShellPrompt(): void {
    this.promptLabel.textContent = this.currentIdentityPrompt();
    this.updatePromptIdentityUi();
  }

  private ensureIdentityModelOption(model: string): void {
    if (!isValidWorkersAiModelId(model)) return;
    const sel = this.identityModelSelect;
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i]?.value === model) return;
    }
    const opt = document.createElement("option");
    opt.value = model;
    opt.textContent = model;
    sel.appendChild(opt);
  }

  private updatePromptIdentityUi(): void {
    this.promptIdentityButton.textContent = this.currentIdentityPrompt();
    this.identityDisplayNameInput.value = this.identityDisplayName;
    this.identityEnvironmentSelect.value = this.identityEnvironment;
    this.ensureIdentityModelOption(this.aiModel);
    this.identityModelSelect.value = this.aiModel;
    this.identityEmailInput.value = this.identityEmail;
    this.identityThemeSelect.value = this.manualTheme ?? "auto";
    this.identityDarkModeInput.checked = this.darkMode;
    this.identityAiToolsInput.checked = this.aiToolsEnabled;
    this.identitySkillUseInput.checked = this.skillUseEnabled;
    this.identitySystemPromptInput.value = this.systemPromptInjection;
  }

  private toggleIdentityPopover(): void {
    if (this.identityPopover.hidden) {
      this.identityPopover.hidden = false;
      this.promptIdentityButton.setAttribute("aria-expanded", "true");
      this.identityDisplayNameInput.value = this.identityDisplayName;
      this.identityEnvironmentSelect.value = this.identityEnvironment;
      this.ensureIdentityModelOption(this.aiModel);
      this.identityModelSelect.value = this.aiModel;
      this.identityEmailInput.value = this.identityEmail;
      this.identityThemeSelect.value = this.manualTheme ?? "auto";
      this.identityDarkModeInput.checked = this.darkMode;
      this.identityAiToolsInput.checked = this.aiToolsEnabled;
      this.identitySkillUseInput.checked = this.skillUseEnabled;
      this.identitySystemPromptInput.value = this.systemPromptInjection;
      this.closeThemePopover();
      this.identityDisplayNameInput.focus();
      this.identityDisplayNameInput.select();
      return;
    }
    this.closeIdentityPopover();
  }

  private closeIdentityPopover(): void {
    this.identityPopover.hidden = true;
    this.promptIdentityButton.setAttribute("aria-expanded", "false");
  }

  private toggleThemePopover(): void {
    if (this.themePopover.hidden) {
      this.themePopover.hidden = false;
      this.themeIndicator.setAttribute("aria-expanded", "true");
      this.closeIdentityPopover();
      return;
    }
    this.closeThemePopover();
  }

  private closeThemePopover(): void {
    this.themePopover.hidden = true;
    this.themeIndicator.setAttribute("aria-expanded", "false");
  }

  private async saveIdentityFromPopover(): Promise<void> {
    const nextName = this.normalizeIdentityPart(
      this.identityDisplayNameInput.value,
      this.identityDisplayName,
    );
    const nextEnvironment = this.normalizeIdentityPart(
      this.identityEnvironmentSelect.value || "pecunies",
      this.identityEnvironment,
    );
    this.identityDisplayName = nextName;
    this.identityEnvironment = nextEnvironment;
    this.aiModel = isValidWorkersAiModelId(this.identityModelSelect.value)
      ? this.identityModelSelect.value
      : DEFAULT_AI_MODEL;
    this.identityEmail = this.identityEmailInput.value.trim().slice(0, 120);
    const nextThemeRaw = this.identityThemeSelect.value.trim().toLowerCase();
    const nextTheme =
      nextThemeRaw === "auto"
        ? null
        : nextThemeRaw in terminalThemes
          ? (nextThemeRaw as ThemeName)
          : null;
    this.manualTheme = nextTheme;
    this.darkMode = this.identityDarkModeInput.checked;
    this.aiToolsEnabled = this.identityAiToolsInput.checked;
    this.skillUseEnabled = this.identitySkillUseInput.checked;
    this.systemPromptInjection = this.identitySystemPromptInput.value
      .trim()
      .slice(0, 1200);
    this.applyDarkMode(this.darkMode);
    this.applyTheme(
      this.manualTheme ?? (this.activeView ? this.activeView.theme : "orange"),
    );
    this.setShellPrompt();
    this.closeIdentityPopover();
    await this.setConfigQuiet("name", nextName);
    await this.setConfigQuiet("environment", nextEnvironment);
    await this.setConfigQuiet("ai_model", this.aiModel);
    await this.setConfigQuiet("email", this.identityEmail);
    await this.setConfigQuiet("theme", nextTheme ?? "auto");
    await this.setConfigQuiet("dark", String(this.darkMode));
    await this.setConfigQuiet("ai_tools", String(this.aiToolsEnabled));
    await this.setConfigQuiet("skill_use", String(this.skillUseEnabled));
    await this.setConfigQuiet("system_prompt", this.systemPromptInjection);
    this.persistShellProfile();
  }

  private parseConfigOutput(output: string): Record<string, unknown> {
    const parsed: Record<string, unknown> = {};
    const lines = output.split("\n");
    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      const rawValue = line.slice(idx + 1).trim();
      if (!key) continue;
      try {
        parsed[key] = JSON.parse(rawValue);
      } catch {
        parsed[key] = rawValue;
      }
    }
    return parsed;
  }

  private configEditorHtml(config: Record<string, unknown>): string {
    const theme = String(config.theme ?? "auto");
    const fontSize = Number(config.font_size ?? FONT_SIZE_DEFAULT);
    const font = String(config.font ?? "monospace");
    const dark = Boolean(config.dark ?? true);
    const name = String(config.name ?? "guest");
    const environment = String(config.environment ?? "pecunies");
    const email = String(config.email ?? "");
    const crt = Boolean(config.crt ?? true);
    const aiModel = String(config.ai_model ?? this.aiModel);
    const systemPrompt = String(config.system_prompt ?? "");
    const syntaxSchemeRaw = String(
      config.syntax_scheme ?? this.syntaxScheme,
    ).toLowerCase();
    const syntaxScheme =
      syntaxSchemeRaw === "contrast" || syntaxSchemeRaw === "pastel"
        ? syntaxSchemeRaw
        : "default";
    const aiTools =
      config.ai_tools === true ||
      String(config.ai_tools ?? "")
        .toLowerCase()
        .trim() === "true";
    const skillUse =
      config.skill_use === true ||
      String(config.skill_use ?? "")
        .toLowerCase()
        .trim() === "true";
    const themeOptions = ["auto", ...Object.keys(terminalThemes)]
      .map(
        (t) =>
          `<option value="${this.escapeAttribute(t)}"${t === theme ? " selected" : ""}>${this.escapeHtml(t)}</option>`,
      )
      .join("");
    const modelOptions = WORKERS_AI_TEXT_MODELS.map(
      (m) =>
        `<option value="${this.escapeAttribute(m)}"${m === aiModel ? " selected" : ""}>${this.escapeHtml(m)}</option>`,
    ).join("");
    return `
      <div class="terminal-view is-live config-editor-view">
        <header class="terminal-view-head">
          <div class="terminal-view-meta"><span class="terminal-kicker">Session</span><code>./terminal --config</code></div>
          <h1 class="terminal-title">Configuration</h1>
          <p class="terminal-copy">Edit and persist terminal session configuration values.</p>
        </header>
        <section class="output-block">
          <div class="config-editor-grid">
            <label class="config-editor-field"><span>theme</span><select data-config-field="theme">${themeOptions}</select></label>
            <label class="config-editor-field"><span>font_size</span><input data-config-field="font_size" type="number" min="10" max="28" value="${this.escapeAttribute(String(fontSize))}" /></label>
            <label class="config-editor-field"><span>font</span><input data-config-field="font" type="text" value="${this.escapeAttribute(font)}" /></label>
            <label class="config-editor-field"><span>name</span><input data-config-field="name" type="text" value="${this.escapeAttribute(name)}" /></label>
            <label class="config-editor-field"><span>environment</span><input data-config-field="environment" type="text" value="${this.escapeAttribute(environment)}" /></label>
            <label class="config-editor-field"><span>email</span><input data-config-field="email" type="email" value="${this.escapeAttribute(email)}" /></label>
            <label class="config-editor-field"><span>ai_model</span><select data-config-field="ai_model">${modelOptions}</select></label>
            <label class="config-editor-field"><span>syntax_scheme</span><select data-config-field="syntax_scheme"><option value="default"${syntaxScheme === "default" ? " selected" : ""}>default</option><option value="contrast"${syntaxScheme === "contrast" ? " selected" : ""}>contrast</option><option value="pastel"${syntaxScheme === "pastel" ? " selected" : ""}>pastel</option></select></label>
            <label class="config-editor-toggle"><input data-config-field="dark" type="checkbox"${dark ? " checked" : ""} /><span>dark</span></label>
            <label class="config-editor-toggle"><input data-config-field="crt" type="checkbox"${crt ? " checked" : ""} /><span>crt</span></label>
            <label class="config-editor-toggle"><input data-config-field="ai_tools" type="checkbox"${aiTools ? " checked" : ""} /><span>ai_tools (chat tools)</span></label>
            <label class="config-editor-toggle"><input data-config-field="skill_use" type="checkbox"${skillUse ? " checked" : ""} /><span>skill_use (AI skills)</span></label>
          </div>
          <label class="config-editor-field config-editor-field-wide">
            <span>system_prompt</span>
            <textarea data-config-field="system_prompt" rows="4">${this.escapeHtml(systemPrompt)}</textarea>
          </label>
          <div class="config-editor-actions">
            <button type="button" class="ghost-button" data-config-action="reset">Reset defaults</button>
            <button type="button" class="submit-button" data-config-action="save">Save</button>
          </div>
        </section>
      </div>
    `;
  }

  private async fetchConfigState(): Promise<Record<string, unknown>> {
    try {
      const response = await fetch("/api/os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          command: "config list",
          visibleContext: this.visibleContext(),
        }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as OsResponse | null;
      if (payload?.config && typeof payload.config === "object") {
        this.applyOsConfig(payload.config as Record<string, unknown>);
      }
      if (typeof payload?.cwd === "string" && payload.cwd.trim()) {
        this.osCurrentDir = payload.cwd.trim();
        if (!this.chatMode && !this.gameMode) this.setShellPrompt();
      }
      if (!response.ok) return {};
      return this.parseConfigOutput(payload?.output ?? "");
    } catch {
      return {};
    }
  }

  private async openConfigView(syncHash: boolean): Promise<void> {
    const config = await this.fetchConfigState();
    this.chatMode = false;
    this.gameMode = null;
    this.pendingPrompt = null;
    this.setShellPrompt();
    this.routeIndicator.textContent = "config";
    this.highlightNavLink(null);
    this.lines.push(
      this.responseLine("Loaded: configuration editor", "success"),
    );
    this.lines.push({
      id: this.makeId(),
      kind: "view",
      html: this.configEditorHtml(config),
      text: "Configuration editor",
    });
    if (syncHash) {
      this.writeRoute("config");
    }
  }

  private readConfigEditorField(field: string): string {
    const element = this.root.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(`[data-config-field="${field}"]`);
    return element?.value?.trim() ?? "";
  }

  private readConfigEditorToggle(field: string): boolean {
    const element = this.root.querySelector<HTMLInputElement>(
      `[data-config-field="${field}"]`,
    );
    return Boolean(element?.checked);
  }

  private async saveConfigEditorValues(): Promise<void> {
    const updates: Array<[string, string]> = [
      ["theme", this.readConfigEditorField("theme") || "auto"],
      [
        "font_size",
        this.readConfigEditorField("font_size") || String(FONT_SIZE_DEFAULT),
      ],
      ["font", this.readConfigEditorField("font") || "monospace"],
      ["name", this.readConfigEditorField("name") || "guest"],
      ["environment", this.readConfigEditorField("environment") || "pecunies"],
      ["email", this.readConfigEditorField("email") || ""],
      ["ai_model", this.readConfigEditorField("ai_model") || DEFAULT_AI_MODEL],
      [
        "syntax_scheme",
        this.readConfigEditorField("syntax_scheme") || "default",
      ],
      ["system_prompt", this.readConfigEditorField("system_prompt") || ""],
      ["dark", this.readConfigEditorToggle("dark") ? "true" : "false"],
      ["crt", this.readConfigEditorToggle("crt") ? "true" : "false"],
      ["ai_tools", this.readConfigEditorToggle("ai_tools") ? "true" : "false"],
      [
        "skill_use",
        this.readConfigEditorToggle("skill_use") ? "true" : "false",
      ],
    ];

    for (const [key, value] of updates) {
      await this.sendOsCommand(`config set ${key} ${this.shellQuote(value)}`);
    }
    if (updates[0]?.[1] === "auto") {
      await this.execute("theme auto");
    } else {
      await this.execute(`theme set ${updates[0]![1]}`);
    }
    const config = await this.fetchConfigState();
    this.lines.push({
      id: this.makeId(),
      kind: "view",
      html: this.configEditorHtml(config),
      text: "Configuration editor",
    });
    this.renderLog();
  }

  private async resetConfigEditorValues(): Promise<void> {
    await this.sendOsCommand("config reset");
    await this.execute("theme auto");
    const config = await this.fetchConfigState();
    this.lines.push({
      id: this.makeId(),
      kind: "view",
      html: this.configEditorHtml(config),
      text: "Configuration editor",
    });
    this.renderLog();
  }

  private applyCrtMode(on: boolean): void {
    document.documentElement.classList.toggle("crt-on", on);
    document.documentElement.classList.toggle("crt-off", !on);
    try {
      localStorage.setItem("pecunies.crt", on ? "on" : "off");
    } catch {
      /* ignore */
    }
  }

  private applyDarkMode(on: boolean): void {
    this.darkMode = on;
    document.documentElement.classList.toggle("dark-mode", on);
    document.documentElement.classList.toggle("light-mode", !on);
    try {
      localStorage.setItem("pecunies.dark", on ? "true" : "false");
    } catch {
      /* ignore */
    }
    this.updatePromptIdentityUi();
  }

  private async setConfigQuiet(key: string, value: string): Promise<void> {
    try {
      const response = await fetch("/api/os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          command: `config set ${key} ${this.shellQuote(value)}`,
          visibleContext: this.visibleContext(),
        }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as OsResponse | null;
      if (payload?.config && typeof payload.config === "object")
        this.applyOsConfig(payload.config as Record<string, unknown>);
      this.persistShellProfile();
    } catch {
      /* Config persistence is best-effort. */
    }
  }

  private shellQuote(value: string): string {
    return JSON.stringify(String(value ?? ""));
  }

  private loadShellProfile(): void {
    try {
      const raw = localStorage.getItem(SHELL_PROFILE_STORAGE);
      if (!raw) {
        this.shellAliases = {};
        this.manualTheme = "orange";
        this.applySyntaxScheme("default");
        this.applyDarkMode(localStorage.getItem("pecunies.dark") !== "false");
        this.persistShellProfile();
        return;
      }
      const p = JSON.parse(raw) as {
        aliases?: Record<string, string>;
        env?: Record<string, string>;
        aiModel?: string;
        systemPrompt?: string;
        darkMode?: boolean;
        aiTools?: boolean;
        skillUse?: boolean;
      };
      this.shellAliases = { ...(p.aliases ?? {}) };
      if (this.shellAliases.ls === "timeline") delete this.shellAliases.ls;
      const t = p.env?.THEME?.toLowerCase();
      const syntaxRaw = String(p.env?.SYNTAX_SCHEME ?? "").toLowerCase();
      if (p.aiModel && isValidWorkersAiModelId(p.aiModel))
        this.aiModel = p.aiModel;
      if (typeof p.systemPrompt === "string")
        this.systemPromptInjection = p.systemPrompt.slice(0, 1200);
      if (typeof p.aiTools === "boolean") this.aiToolsEnabled = p.aiTools;
      if (typeof p.skillUse === "boolean") this.skillUseEnabled = p.skillUse;
      this.applyDarkMode(
        typeof p.darkMode === "boolean"
          ? p.darkMode
          : localStorage.getItem("pecunies.dark") !== "false",
      );
      if (t && t in terminalThemes) this.manualTheme = t as ThemeName;
      else if (t === "auto") this.manualTheme = null;
      else this.manualTheme = "orange";
      this.applySyntaxScheme(
        syntaxRaw === "contrast" || syntaxRaw === "pastel"
          ? syntaxRaw
          : "default",
      );
      if (this.activeView)
        this.applyTheme(this.effectiveTheme(this.activeView));
      else this.applyTheme(this.manualTheme ?? "orange");
    } catch {
      this.shellAliases = {};
      this.manualTheme = "orange";
      this.applySyntaxScheme("default");
      this.applyDarkMode(true);
      this.applyTheme("orange");
    }
  }

  private persistShellProfile(): void {
    try {
      localStorage.setItem(
        SHELL_PROFILE_STORAGE,
        JSON.stringify({
          aliases: this.shellAliases,
          env: {
            THEME: this.manualTheme ?? "auto",
            SYNTAX_SCHEME: this.syntaxScheme,
          },
          aiModel: this.aiModel,
          systemPrompt: this.systemPromptInjection,
          darkMode: this.darkMode,
          aiTools: this.aiToolsEnabled,
          skillUse: this.skillUseEnabled,
        }),
      );
    } catch {
      /* ignore */
    }
  }

  private expandShellAliases(line: string): string {
    const trimmed = line.trim();
    if (!trimmed) return line;
    const [first, ...rest] = trimmed.split(/\s+/);
    const mapped = this.shellAliases[first.toLowerCase()];
    if (!mapped) return line;
    return [mapped, ...rest].join(" ").trim();
  }

  /** `$_` → last arg of prior command; `$@` → all args (after `..` / `.` + alias expansion on that line). Prefix `\\` to take literally. */
  private expandHistoryShorthands(line: string): string {
    if (!line.includes("$_") && !line.includes("$@")) return line;
    const prev = this.history.at(-1);
    let lastArg = "";
    let allArgsJoined = "";
    if (prev) {
      const prevBase = prev === ".." ? "cd .." : prev === "." ? "pwd" : prev;
      const prevExpanded = this.expandShellAliases(prevBase);
      const tokens = this.splitShellArgs(prevExpanded);
      if (tokens.length) {
        lastArg = tokens[tokens.length - 1] ?? "";
        allArgsJoined = tokens.length > 1 ? tokens.slice(1).join(" ") : "";
      }
    }
    return line
      .replace(/(?<!\\)\$@/g, allArgsJoined)
      .replace(/(?<!\\)\$_/g, lastArg);
  }

  private async runBootSequence(
    kind: "boot" | "reboot" | "init",
  ): Promise<void> {
    const delay = kind === "init" ? 34 : 52;
    const lines = [
      "Phoenix-UEFI 04.03 — Pecunies portable firmware",
      "POST: memory training … OK | NVMe … OK",
      "",
      "[    0.000000] PecuKernel 6.12.0-portfolio #1 SMP PREEMPT",
      kind === "reboot"
        ? "[    0.004102] soft reboot — draining worker queues"
        : "[    0.004102] boot: quiet loglevel=portfolio",
      "[    0.018881] Mounting root at / (overlayfs + KV)",
      "[    0.034204] modprobe virtio-terminal … ok",
      "[    0.051112] modprobe workers-ai-bridge … ok",
      `[    0.066430] pecunies-fs: mounting ${this.osUserHomeDir()}/{projects,skills}`,
      "[    0.081902] systemd[1]: graphical-session.target — active",
      "[    0.095441] pecunies-ui: launching glass terminal",
      "",
      "login: guest    session ok",
      "— UI ready —",
    ];
    for (const text of lines) {
      this.lines.push(this.responseLine(text, "info"));
      this.renderLog();
      await new Promise((r) =>
        window.setTimeout(r, text === "" ? Math.floor(delay / 2) : delay),
      );
    }
    this.execute("resume", { echo: false, syncHash: true, focus: true });
  }

  private startParallaxLoop(): void {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let lastFrame = 0;
    const step = (t: number): void => {
      if (document.hidden) {
        window.requestAnimationFrame(step);
        return;
      }
      if (lastFrame && t - lastFrame < 33) {
        window.requestAnimationFrame(step);
        return;
      }
      lastFrame = t;
      const px = Math.sin(t * 0.00004) * 5 + Math.sin(t * 0.000017) * 2;
      const py = Math.cos(t * 0.000035) * 3;
      const gx = Math.sin(t * 0.000012) * 3;
      const gy = Math.cos(t * 0.00001) * 2;
      document.documentElement.style.setProperty(
        "--parallax-canvas-x",
        `${px}px`,
      );
      document.documentElement.style.setProperty(
        "--parallax-canvas-y",
        `${py}px`,
      );
      document.documentElement.style.setProperty(
        "--parallax-grid-x",
        `${gx}px`,
      );
      document.documentElement.style.setProperty(
        "--parallax-grid-y",
        `${gy}px`,
      );
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

  private setupInputCaretClasses(): void {
    const onType = (): void => {
      this.formElement.classList.add("is-typing");
      if (this.typingIdleTimer !== null) {
        window.clearTimeout(this.typingIdleTimer);
      }
      this.typingIdleTimer = window.setTimeout(() => {
        this.formElement.classList.remove("is-typing");
        this.typingIdleTimer = null;
      }, 420);
    };
    this.inputElement.addEventListener("keydown", onType);
    this.inputElement.addEventListener("input", onType);
    this.inputElement.addEventListener("blur", () => {
      this.formElement.classList.remove("is-typing");
    });
  }

  private renderLog(): void {
    const pinTop = this.outputElement.dataset.pinTop === "true";
    const anchorLineId =
      !pinTop && this.lines.length > this.lastRenderedLineCount
        ? (this.lines[this.lastRenderedLineCount]?.id ?? null)
        : null;
    this.logElement.innerHTML = renderLog(this.lines);
    if (pinTop) this.outputElement.scrollTop = 0;
    else if (anchorLineId) {
      const anchor = this.logElement.querySelector<HTMLElement>(
        `[data-line-id="${anchorLineId}"]`,
      );
      this.outputElement.scrollTop = anchor
        ? Math.max(0, anchor.offsetTop - 6)
        : this.outputElement.scrollHeight;
    } else this.outputElement.scrollTop = this.outputElement.scrollHeight;
    this.lastRenderedLineCount = this.lines.length;
    delete this.outputElement.dataset.pinTop;
    this.hideChatQuoteFab();
  }

  private scheduleChatQuoteFabUpdate(): void {
    if (!this.chatMode) {
      this.hideChatQuoteFab();
      return;
    }
    if (this.chatQuoteFabRaf !== 0) return;
    this.chatQuoteFabRaf = window.requestAnimationFrame(() => {
      this.chatQuoteFabRaf = 0;
      this.syncChatQuoteFab();
    });
  }

  private hideChatQuoteFab(): void {
    this.chatQuoteSelection = "";
    this.chatQuoteFab.hidden = true;
    this.chatQuoteFab.classList.remove("is-done");
    this.chatQuoteFab.setAttribute("aria-label", "Quote selection into reply");
    this.chatQuoteFab.style.top = "";
    this.chatQuoteFab.style.left = "";
  }

  private syncChatQuoteFab(): void {
    if (!this.chatMode) {
      this.hideChatQuoteFab();
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount < 1 || sel.isCollapsed) {
      this.hideChatQuoteFab();
      return;
    }
    const text = sel
      .toString()
      .replace(/\u00a0/g, " ")
      .replace(/\r\n/g, "\n")
      .trim();
    if (!text) {
      this.hideChatQuoteFab();
      return;
    }
    const anchor = sel.anchorNode;
    const focusNode = sel.focusNode;
    if (!anchor || !focusNode) {
      this.hideChatQuoteFab();
      return;
    }
    const startEl =
      anchor.nodeType === Node.TEXT_NODE
        ? anchor.parentElement
        : (anchor as Element);
    const endEl =
      focusNode.nodeType === Node.TEXT_NODE
        ? focusNode.parentElement
        : (focusNode as Element);
    if (!startEl || !endEl) {
      this.hideChatQuoteFab();
      return;
    }
    if (
      this.inputElement.contains(startEl) ||
      this.inputElement.contains(endEl)
    ) {
      this.hideChatQuoteFab();
      return;
    }
    const zoneStart = startEl.closest("[data-chat-quote-source]");
    const zoneEnd = endEl.closest("[data-chat-quote-source]");
    if (!zoneStart || zoneStart !== zoneEnd) {
      this.hideChatQuoteFab();
      return;
    }
    const pretty = zoneStart.querySelector(".pretty-output");
    if (!pretty || !pretty.contains(startEl) || !pretty.contains(endEl)) {
      this.hideChatQuoteFab();
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.hideChatQuoteFab();
      return;
    }

    this.chatQuoteSelection = text;
    const fabW = 36;
    const fabH = 32;
    let top = rect.bottom + 6;
    let left = rect.right - fabW - 4;
    const margin = 8;
    top = Math.max(margin, Math.min(top, window.innerHeight - fabH - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - fabW - margin));
    this.chatQuoteFab.style.top = `${top}px`;
    this.chatQuoteFab.style.left = `${left}px`;
    this.chatQuoteFab.hidden = false;
  }

  private insertQuotedReplyAtCaret(selected: string): void {
    const normalized = selected.replace(/\r\n/g, "\n").trim();
    if (!normalized) return;
    const lines = normalized.split("\n");
    const quoteBlock = `${lines.map((line) => `> ${line}`).join("\n")}\n\n`;
    const el = this.inputElement;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const v = el.value;
    el.value = `${v.slice(0, start)}${quoteBlock}${v.slice(end)}`;
    const caret = start + quoteBlock.length;
    el.setSelectionRange(caret, caret);
    el.focus();
  }

  private applyChatQuoteFromFab(): void {
    const raw = this.chatQuoteSelection;
    if (!raw) return;
    this.insertQuotedReplyAtCaret(raw);
    this.chatQuoteFab.classList.add("is-done");
    this.chatQuoteFab.setAttribute("aria-label", "Quoted");
    window.getSelection()?.removeAllRanges();
    window.setTimeout(() => {
      this.hideChatQuoteFab();
    }, 700);
  }

  private pulseView(): void {
    this.viewElement.classList.remove("is-live");
    window.requestAnimationFrame(() => {
      this.viewElement.classList.add("is-live");
    });
  }

  private triggerViewSwitchFeedback(routeLabel: string): void {
    this.shellElement.classList.add("terminal-submit-pulse");
    window.setTimeout(
      () => this.shellElement.classList.remove("terminal-submit-pulse"),
      420,
    );
    this.siteShellElement.classList.add("site-shell-nudge");
    window.setTimeout(
      () => this.siteShellElement.classList.remove("site-shell-nudge"),
      300,
    );
    document.body.classList.add("view-switching");
    window.setTimeout(
      () => document.body.classList.remove("view-switching"),
      360,
    );
    this.scrambleText(this.routeIndicator, routeLabel);
    this.fieldHandle?.burst();
  }

  private setTitlebarFromCommand(commandText: string): void {
    const label = commandText.replace(/\s+/g, " ").trim().slice(0, 44);
    this.routeIndicator.textContent = label;
  }

  private commandContext(): CommandContext {
    return {
      commands: this.commands,
      resume: resumeData,
      getTheme: () => this.manualTheme,
      setTheme: (theme) => {
        this.manualTheme = theme;
        this.persistShellProfile();
        void this.setConfigQuiet("theme", theme ?? "auto");

        if (this.activeView) {
          this.applyTheme(this.effectiveTheme(this.activeView));
        } else {
          this.applyTheme(this.manualTheme ?? "orange");
        }
      },
      getDarkMode: () => this.darkMode,
      setDarkMode: (dark) => {
        this.applyDarkMode(dark);
        this.persistShellProfile();
        void this.setConfigQuiet("dark", String(dark));
      },
      getAiModel: () => this.aiModel,
      setAiModel: (model) => {
        const m = model.trim();
        if (!isValidWorkersAiModelId(m)) return false;
        this.aiModel = m;
        this.persistShellProfile();
        void this.setConfigQuiet("ai_model", m);
        this.updatePromptIdentityUi();
        return true;
      },
      getSystemPrompt: () => this.systemPromptInjection,
      setSystemPrompt: (text) => {
        this.systemPromptInjection = text.trim().slice(0, 1200);
        this.persistShellProfile();
        void this.setConfigQuiet("system_prompt", this.systemPromptInjection);
        this.updatePromptIdentityUi();
      },
    };
  }

  private highlightNavLink(route: string | null): void {
    this.root.querySelectorAll(".nav-link").forEach((el) => {
      el.classList.remove("is-active");
    });
    if (!route) return;
    const navLink = this.root.querySelector(`.nav-link[data-nav="${route}"]`);
    if (navLink) navLink.classList.add("is-active");
  }

  private parseCommand(rawInput: string): { name: string; args: string[] } {
    // Expand ~ to /home in paths (avoid lookbehind for compat)
    const tildeExpanded = rawInput.replace(/(^|\s)~(?=\/|\s|$)/g, "$1/home");
    const normalized = tildeExpanded
      .replace(/^\//, "")
      .replace(/^\.\//, "")
      .trim();
    const [name = "", ...args] = this.splitShellArgs(normalized);
    return { name: name.toLowerCase(), args };
  }

  private splitShellArgs(input: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let quote: '"' | "'" | null = null;
    let escape = false;

    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i] ?? "";
      if (escape) {
        current += ch;
        escape = false;
        continue;
      }
      if (ch === "\\" && quote !== "'") {
        escape = true;
        continue;
      }
      if (quote) {
        if (ch === quote) quote = null;
        else current += ch;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (/\s/.test(ch)) {
        if (current) {
          tokens.push(current);
          current = "";
        }
        continue;
      }
      current += ch;
    }
    if (current) tokens.push(current);
    return tokens;
  }

  private applyAiCliFlags(args: string[]): string[] {
    const remaining: string[] = [];
    for (const arg of args) {
      if (arg.startsWith("--model=")) {
        const model = arg.slice("--model=".length).trim();
        if (isValidWorkersAiModelId(model)) {
          this.aiModel = model;
          this.persistShellProfile();
          void this.setConfigQuiet("ai_model", model);
        }
        continue;
      }
      if (arg.startsWith("--system=")) {
        this.systemPromptInjection = arg
          .slice("--system=".length)
          .trim()
          .slice(0, 1200);
        this.persistShellProfile();
        void this.setConfigQuiet("system_prompt", this.systemPromptInjection);
        continue;
      }
      remaining.push(arg);
    }
    this.updatePromptIdentityUi();
    return remaining;
  }

  private resolveCommand(name: string): CommandDefinition | undefined {
    return this.commands.find(
      (command) => command.name === name || command.aliases.includes(name),
    );
  }

  private closestCommands(fragment: string): string[] {
    if (!fragment) return ["help"];

    return this.commands
      .filter(
        (command) =>
          command.name.startsWith(fragment) ||
          command.aliases.some((alias) => alias.startsWith(fragment)),
      )
      .slice(0, 3)
      .map((command) => command.name);
  }

  private updateAutocomplete(): void {
    if (document.activeElement !== this.inputElement) {
      this.hideAutocomplete();
      return;
    }
    this.suggestions = this.buildSuggestions(this.inputElement.value);
    this.suggestionIndex = 0;
    this.renderAutocomplete();
  }

  private buildSuggestions(rawValue: string): Suggestion[] {
    const tagSuggestions = this.tagAutocompleteSuggestions(rawValue);
    if (tagSuggestions.length) {
      return tagSuggestions;
    }

    const commandLine = rawValue.replace(/^\//, "").replace(/^\.\//, "");
    const normalized = commandLine.trim().toLowerCase();
    const explicitCommand = rawValue.trim().startsWith("/");
    const trailingSpace = /\s$/.test(commandLine);
    const [currentName = "", ...argTokens] = commandLine
      .trimStart()
      .split(/\s+/);
    const activeCommand = currentName.toLowerCase();

    if (this.chatMode && normalized && !explicitCommand) return [];

    if (!normalized) {
      const freq = readCommandFrequency();
      const ranked = rankByFuzzyAndFrequency(
        "",
        this.featuredCommands.map((command) => ({
          key: command.name,
          command,
        })),
        MAX_AUTOCOMPLETE_RESULTS,
        freq,
      );
      return ranked.map((x) => ({
        completion: this.completionForCommand(x.command.name),
        usage: x.command.usage,
        description: x.command.description,
        commandName: x.command.name,
      }));
    }

    const argSuggestions = this.argumentSuggestions(
      activeCommand,
      argTokens,
      trailingSpace,
    );

    if (argSuggestions.length)
      return argSuggestions.slice(0, MAX_AUTOCOMPLETE_RESULTS);

    if (normalized === "ask")
      return [
        {
          completion: "ask ",
          usage: "ask <question>",
          description: "Complete ask, then type a question for Workers AI.",
          commandName: "ask",
        },
      ];

    if (normalized === "explain")
      return [
        {
          completion: "explain ",
          usage: "explain <project>",
          description: "Complete explain, then choose a project.",
          commandName: "explain",
        },
      ];

    if (normalized.startsWith("explain ")) {
      const explainTargets = [
        {
          completion: "explain project ",
          usage: "explain project <market|pi|wasm|down>",
          description: "Explain a project with Workers AI.",
        },
        {
          completion: "explain command ",
          usage: "explain command <command>",
          description: "Explain a terminal command.",
        },
        {
          completion: "explain skill ",
          usage: "explain skill <skill>",
          description: "Explain a skill from the resume.",
        },
        {
          completion: "explain work ",
          usage: "explain work <role>",
          description: "Explain a work-history entry.",
        },
        {
          completion: "explain education",
          usage: "explain education",
          description: "Explain the education entry.",
        },
        {
          completion: "explain post ",
          usage: "explain post <slug>",
          description: "Explain a blog post.",
        },
        {
          completion: "explain link ",
          usage: "explain link <name>",
          description: "Explain a contact link.",
        },
        {
          completion: "explain last",
          usage: "explain last",
          description: "Explain the previous command and output.",
        },
        ...resumeData.projects.map((project) => ({
          completion: `explain project ${project.slug}`,
          usage: `explain project ${project.slug}`,
          description: project.summary,
        })),
        {
          completion: "explain project market",
          usage: "explain project market",
          description: "Explain Moe marketplace aggregation.",
        },
        {
          completion: "explain project pi",
          usage: "explain project pi",
          description: "Explain the Raspberry Pi infrastructure cluster.",
        },
        {
          completion: "explain project wasm",
          usage: "explain project wasm",
          description: "Explain the Zig WebAssembly runtime.",
        },
        {
          completion: "explain project down",
          usage: "explain project down",
          description: "Explain the down.nvim Neovim plugin.",
        },
      ];

      const freq = readCommandFrequency();
      const items = explainTargets.map((entry) => ({
        key: entry.completion,
        entry,
      }));
      const ranked = rankByFuzzyAndFrequency(
        normalized,
        items,
        MAX_AUTOCOMPLETE_RESULTS,
        freq,
      );
      return ranked.map((x) => ({
        ...x.entry,
        commandName: "explain" as const,
      }));
    }

    if (normalized.startsWith("man ")) {
      const fragment = normalized.replace(/^man\s+/, "");
      const freq = readCommandFrequency();
      const items = this.commands.map((command) => ({
        key: command.name,
        command,
      }));
      const ranked = rankByFuzzyAndFrequency(fragment, items, 8, freq);
      return ranked.map((x) => ({
        completion: `man ${x.command.name}`,
        usage: `man ${x.command.name}`,
        description: x.command.description,
        commandName: x.command.name,
      }));
    }

    if (normalized.startsWith("theme")) {
      const paletteSuggestions = (
        Object.keys(terminalThemes) as ThemeName[]
      ).map((name) => `theme ${name}`);
      const entries = [
        ...paletteSuggestions,
        "theme auto",
        "theme list",
        "theme random",
      ];
      const freq = readCommandFrequency();
      const items = entries.map((entry) => ({ key: entry }));
      const ranked = rankByFuzzyAndFrequency(
        normalized,
        items,
        MAX_AUTOCOMPLETE_RESULTS,
        freq,
      );
      return ranked.map((x) => {
        const entry = x.key;
        return {
          completion: entry,
          usage: entry,
          description:
            entry === "theme auto"
              ? "Return palette control to the active view."
              : entry === "theme list" || entry === "theme random"
                ? entry.replace("theme ", "")
                : `Pin the ${entry.replace("theme ", "")} palette.`,
          commandName: "theme",
        };
      });
    }

    if (normalized.includes(" ")) {
      return [];
    }

    const freq = readCommandFrequency();
    const pool = this.commands.flatMap((command) => [
      { key: command.name, command },
      ...command.aliases.map((alias) => ({ key: alias, command })),
    ]);
    const ranked = rankByFuzzyAndFrequency(
      normalized,
      pool,
      MAX_AUTOCOMPLETE_RESULTS,
      freq,
    );
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    for (const x of ranked) {
      const name = x.command.name;
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);
      out.push({
        completion: this.completionForCommand(name),
        usage: x.command.usage,
        description: x.command.description,
        commandName: name,
      });
    }
    return out;
  }

  private rankPathSuggestions(
    fragment: string,
    paths: readonly string[],
    build: (path: string) => Suggestion,
  ): Suggestion[] {
    const f = fragment.trim().toLowerCase();
    const scored = paths
      .map((path) => ({ path, s: fuzzyScore(f, path), item: build(path) }))
      .filter((x) => !f || x.s > 0)
      .sort((a, b) => b.s - a.s || a.path.localeCompare(b.path));
    return scored.slice(0, MAX_AUTOCOMPLETE_RESULTS).map((x) => x.item);
  }

  private renderAutocomplete(): void {
    if (!this.suggestions.length) {
      this.hideAutocomplete();
      return;
    }

    this.inputElement.setAttribute("aria-expanded", "true");
    this.autocompletePanel.hidden = false;
    this.autocompleteList.innerHTML = this.suggestions
      .map((suggestion, index) => {
        const activeClass = index === this.suggestionIndex ? " is-active" : "";

        return `
          <button
            class="autocomplete-option${activeClass}"
            type="button"
            data-suggestion-value="${suggestion.completion}"
          >
            <div class="autocomplete-copy">
              <p class="autocomplete-name">${this.escapeHtml(suggestion.displayName ?? `/${suggestion.completion}`)}</p>
              <p class="autocomplete-desc">${suggestion.description}</p>
            </div>
            <span class="autocomplete-meta">${suggestion.usage}</span>
            ${
              suggestion.commandName
                ? `<span class="autocomplete-info" data-man-command="${suggestion.commandName}" title="Show man entry">i</span>`
                : ""
            }
          </button>
        `;
      })
      .join("");
  }

  private argumentSuggestions(
    commandName: string,
    args: string[],
    trailingSpace: boolean,
  ): Suggestion[] {
    if (commandName === "zoom") {
      if (!args.length) {
        return [
          {
            completion: "zoom in ",
            usage: "zoom in",
            description: "Increase UI font size (persists as font_size).",
            commandName: "zoom",
          },
          {
            completion: "zoom out ",
            usage: "zoom out",
            description: "Decrease UI font size.",
            commandName: "zoom",
          },
          {
            completion: "zoom reset ",
            usage: "zoom reset",
            description: `Reset font size to ${FONT_SIZE_DEFAULT}px.`,
            commandName: "zoom",
          },
        ];
      }
      const sub = args[0]?.toLowerCase() ?? "";
      const opts = ["in", "out", "reset"].filter((o) => o.startsWith(sub));
      return opts.map((o) => ({
        completion: `zoom ${o} `,
        usage: `zoom ${o}`,
        description:
          o === "in"
            ? "Larger text."
            : o === "out"
              ? "Smaller text."
              : "Default text size.",
        commandName: "zoom",
      }));
    }

    if (commandName === "theme") {
      return [];
    }

    if (commandName === "model") {
      const freq = readCommandFrequency();
      const fragment = trailingSpace ? "" : (args[args.length - 1] ?? "");
      const base = trailingSpace
        ? `model ${args.join(" ")}`.trim()
        : `model ${args.slice(0, -1).join(" ")}`.trim();
      const ranked = rankByFuzzyAndFrequency(
        fragment,
        [...WORKERS_AI_TEXT_MODELS].map((key) => ({ key })),
        MAX_AUTOCOMPLETE_RESULTS,
        freq,
      );
      return ranked.map((x) => ({
        completion: `${base} ${x.key} `,
        usage: x.key,
        description:
          "Workers AI text model for this session (also in session identity).",
        commandName: "model",
      }));
    }

    if (commandName === "context") {
      const freq = readCommandFrequency();
      if (!args.length && trailingSpace) {
        return [
          {
            completion: "context clear ",
            usage: "context clear",
            description:
              "Clear system prompt injection (session identity field).",
            commandName: "context",
          },
        ];
      }
      if (args.length === 1 && !trailingSpace) {
        const frag = args[0] ?? "";
        const ranked = rankByFuzzyAndFrequency(
          frag,
          [{ key: "clear" }],
          MAX_AUTOCOMPLETE_RESULTS,
          freq,
        );
        if (ranked.length) {
          return ranked.map((x) => ({
            completion: `context ${x.key} `,
            usage: "context clear",
            description: "Clear system prompt injection.",
            commandName: "context",
          }));
        }
      }
      return [];
    }

    if (commandName === "ask" || commandName === "chat") {
      const prefix = `${commandName} ${args.join(" ")}`.trim();
      const options = [
        ...WORKERS_AI_TEXT_MODELS.map(
          (model) => `${commandName} --model=${model}`,
        ),
        `${commandName} --system=`,
      ];
      const freq = readCommandFrequency();
      const ranked = rankByFuzzyAndFrequency(
        prefix,
        options.map((key) => ({ key })),
        MAX_AUTOCOMPLETE_RESULTS,
        freq,
      );
      return ranked.map((x) => ({
        completion: x.key.endsWith("=") ? x.key : `${x.key} `,
        usage: x.key.includes("--model=")
          ? "--model=<model>"
          : "--system=<prompt>",
        description: x.key.includes("--model=")
          ? "Use this Workers AI model."
          : "Append prompt instructions for this request/session.",
        commandName,
      }));
    }

    if (commandName === "cat") {
      const pathArgs = args.filter((a) => a !== "--pretty");
      const fragment = trailingSpace ? "" : (pathArgs.at(-1) ?? "");
      const pathPool = [
        ...new Set([...FILE_PATHS, ...this.osHomePathSuggestions()]),
      ];
      const ranked = this.rankPathSuggestions(fragment, pathPool, (path) => ({
        completion: args.includes("--pretty")
          ? `cat --pretty ${path}`
          : `cat ${path}`,
        usage: `cat ${args.includes("--pretty") ? "--pretty " : ""}${path}`,
        description: "Read this file from the portfolio OS.",
        commandName: "cat",
      }));
      if (!args.includes("--pretty") && (args.length === 0 || fragment === ""))
        return [
          {
            completion: "cat --pretty ",
            usage: "cat --pretty <path>",
            description: "Render markdown with syntax and typography.",
            commandName: "cat",
          },
          ...ranked,
        ];
      return ranked;
    }

    if (commandName === "post") {
      const sub = (args[0] || "").toLowerCase();
      if (!args.length || (sub !== "open" && sub !== "view"))
        return [
          {
            completion: "post open ",
            usage: "post open <slug>",
            description: "Open a full post from the /api/posts index.",
            commandName: "post",
          },
        ];
      const slugFrag =
        sub === "open" || sub === "view"
          ? trailingSpace
            ? ""
            : args.slice(1).join(" ").trim()
          : "";
      const slugPool = FILE_PATHS.filter(
        (p) => p.startsWith("/posts/") && p.endsWith(".md"),
      ).map((p) => p.replace(/^.*\//, "").replace(/\.md$/i, ""));
      return this.rankPathSuggestions(slugFrag, slugPool, (slug) => ({
        completion: `post open ${slug}`,
        usage: `post open ${slug}`,
        description: "Open this post.",
        commandName: "post",
      }));
    }

    if (commandName === "new") {
      if (!args.length || args[0].toLowerCase() !== "post")
        return [
          {
            completion: "new post ",
            usage: "new post --title=… --tags=…",
            description: "Publish under /posts/YYYY/MM/DD/ (requires sudo).",
            commandName: "new",
          },
        ];
      const flagCompletions = [
        'new post --title="',
        "new post --tags=",
        'new post --description="',
      ];
      return flagCompletions.map((c) => ({
        completion: c,
        usage: c,
        description: "Flag or quoted value for new post.",
        commandName: "new",
      }));
    }

    if (commandName === "skills") {
      const opts = ["skills --category", "skills --applications"];
      const prefix = `skills ${args.join(" ")}`.trim();
      const freq = readCommandFrequency();
      const items = opts.map((entry) => ({ key: entry }));
      const ranked = rankByFuzzyAndFrequency(
        prefix,
        items,
        MAX_AUTOCOMPLETE_RESULTS,
        freq,
      );
      return ranked.map((x) => ({
        completion: x.key,
        usage: x.key,
        description: x.key.endsWith("--applications")
          ? "Show skills by applied system category."
          : "Show skills grouped by resume categories.",
        commandName: "skills",
      }));
    }

    if (commandName === "explain" && args[0] === "command") {
      const fragment = trailingSpace ? "" : (args.at(-1) ?? "");
      const freq = readCommandFrequency();
      const items = this.commands.map((command) => ({
        key: command.name,
        command,
      }));
      const ranked = rankByFuzzyAndFrequency(
        fragment,
        items,
        MAX_AUTOCOMPLETE_RESULTS,
        freq,
      );
      return ranked.map((x) => ({
        completion: `explain command ${x.command.name}`,
        usage: `explain command ${x.command.name}`,
        description: x.command.description,
        commandName: "explain",
      }));
    }

    if (commandName === "explain" && args[0] === "project") {
      const fragment = trailingSpace ? "" : (args.at(-1) ?? "");
      const projects = [
        {
          key: "market",
          description: "Marketplace Aggregator on AWS at moe.pecunies.com.",
        },
        { key: "pi", description: "Raspberry Pi infrastructure cluster." },
        { key: "wasm", description: "WebAssembly Runtime in Zig." },
        { key: "down", description: "down.nvim markdown note-taking plugin." },
      ];
      const freq = readCommandFrequency();
      const ranked = rankByFuzzyAndFrequency(
        fragment,
        projects,
        MAX_AUTOCOMPLETE_RESULTS,
        freq,
      );
      return ranked.map((x) => ({
        completion: `explain project ${x.key}`,
        usage: `explain project ${x.key}`,
        description: x.description,
        commandName: "explain",
      }));
    }

    const cmd = this.resolveCommand(commandName);
    const freq = readCommandFrequency();
    const hintRows = ARG_HINTS[commandName];

    if (cmd && commandSynopsisNeedsArgs(cmd.usage)) {
      const generic = buildGenericUsageSuggestions(
        cmd,
        args,
        trailingSpace,
        freq,
        (frag, pool, build) => this.rankPathSuggestions(frag, pool, build),
        FILE_PATHS,
        DIRECTORY_PATHS,
        () => this.osHomePathSuggestions(),
        extractHintFlagTokens(hintRows ?? []),
      );
      if (generic.length) return generic;
    }

    return rankArgHintRows(
      commandName,
      args,
      trailingSpace,
      hintRows ?? [],
      freq,
    );
  }

  private hideAutocomplete(): void {
    this.suggestions = [];
    this.inputElement.setAttribute("aria-expanded", "false");
    this.autocompletePanel.hidden = true;
    this.autocompleteList.innerHTML = "";
  }

  private selectedCompletion(): string | null {
    return this.suggestions[this.suggestionIndex]?.completion ?? null;
  }

  private completionForCommand(commandName: string): string {
    const cmd = this.resolveCommand(commandName);
    if (cmd && commandSynopsisNeedsArgs(cmd.usage)) return `${commandName} `;
    return commandName;
  }

  private acceptSuggestion(completion: string): void {
    this.inputElement.value = completion;
    this.inputElement.focus();
    this.inputElement.setSelectionRange(completion.length, completion.length);
    this.updateAutocomplete();
  }

  private tagAutocompleteSuggestions(rawValue: string): Suggestion[] {
    const caret = this.inputElement.selectionStart ?? rawValue.length;
    const beforeCaret = rawValue.slice(0, caret);
    const afterCaret = rawValue.slice(caret);
    const match = beforeCaret.match(/(^|[\s(])#([a-z0-9._-]*)$/i);
    if (!match) {
      return [];
    }

    const fragment = (match[2] ?? "").toLowerCase();
    const markerStart = beforeCaret.length - match[0].length + match[1].length;

    // Local seed results (always available offline)
    const summaries = listTagSummaries();
    const known = new Map(summaries.map((item) => [item.slug, item.count]));
    const localSlugs = fragment
      ? findTagsMatching(fragment)
      : summaries.map((item) => item.slug);

    // Merge with API cache (fetched in background, deduplicated)
    const apiSeen = new Set<string>(localSlugs);
    const apiExtras: string[] = [];
    for (const s of this.apiTagCache) {
      if (apiSeen.has(s.value)) continue;
      if (
        !fragment ||
        s.value.startsWith(fragment) ||
        s.label.toLowerCase().startsWith(fragment)
      ) {
        apiSeen.add(s.value);
        apiExtras.push(s.value);
        if (s.count !== undefined) known.set(s.value, s.count);
      }
    }

    // Kick off background refresh (once per session or when stale)
    if (this.apiTagCacheStale) {
      this.apiTagCacheStale = false;
      fetchAutocompleteSuggestions("tag", "")
        .then((results) => {
          this.apiTagCache = results;
        })
        .catch(() => {
          /* best-effort */
        });
    }

    const merged = [...localSlugs, ...apiExtras].slice(
      0,
      MAX_AUTOCOMPLETE_RESULTS,
    );
    return merged.map((slug) => {
      const replacement = `#${slug}`;
      const nextValue = `${rawValue.slice(0, markerStart)}${replacement} ${afterCaret.replace(/^[a-z0-9._-]*/i, "")}`;
      const uses = known.get(slug) ?? 0;
      const apiEntry = this.apiTagCache.find((s) => s.value === slug);
      return {
        completion: nextValue,
        displayName: replacement,
        usage: `${uses} ${uses === 1 ? "use" : "uses"}`,
        description: apiEntry?.description ?? getTagDescription(slug),
      };
    });
  }

  private shouldRunCommandInChat(input: string): boolean {
    const normalized = input.trim();

    if (normalized.startsWith("/")) return true;

    if (normalized.includes("|")) return true;

    const { name } = this.parseCommand(normalized);

    if (name === "exit" || name === "clear") return true;

    return Boolean(this.resolveCommand(name));
  }

  private shouldHandleAsGameInput(input: string): boolean {
    const normalized = input.trim().replace(/^\//, "").toLowerCase();

    if (!this.gameMode) return false;

    if (["q", "quit", "n", "new"].includes(normalized)) return true;

    if (
      this.pendingScore &&
      !this.resolveCommand(this.parseCommand(normalized).name)
    )
      return true;

    if (this.gameMode === "2048")
      return ["w", "a", "s", "d", "up", "down", "left", "right"].includes(
        normalized,
      );

    if (this.gameMode === "chess")
      return /^[a-h][1-8][a-h][1-8]$/.test(normalized);

    if (this.gameMode === "minesweeper")
      return /^(open|flag)\s+[a-h][1-8]$/.test(normalized);

    if (this.gameMode === "jobquest" && this.jobQuestState)
      return jobQuestWouldHandleAsGameInput(this.jobQuestState, normalized);

    return false;
  }

  private clearTerminal(): void {
    this.lines = [];
    this.activeView = null;
    this.chatMode = false;
    this.gameMode = null;
    this.jobQuestState = null;
    this.pendingPrompt = null;
    this.pendingScore = null;
    this.viewElement.innerHTML = "";
    this.promptScramble.textContent = "";
    this.statusScramble.textContent = "";
    this.routeIndicator.textContent = "";
    this.applyTheme(this.manualTheme ?? "orange");
    this.setShellPrompt();
    this.highlightNavLink(null);
    this.restoreWindow();
    this.updateBackButtonState();
  }

  private updateBackButtonState(): void {
    this.backButton.setAttribute(
      "aria-disabled",
      this.viewHistory.length === 0 ? "true" : "false",
    );
  }

  private async goBackToPreviousView(): Promise<void> {
    if (!this.viewHistory.length) {
      this.updateBackButtonState();
      return;
    }
    const currentRoute = this.activeView?.route ?? "";
    let targetRoute = this.viewHistory.pop();
    while (targetRoute !== undefined && targetRoute === currentRoute)
      targetRoute = this.viewHistory.pop();
    this.updateBackButtonState();
    const targetCommand = targetRoute
      ? this.routeMap.get(targetRoute)
      : (this.commands.find((command) => command.name === "home") ?? null);
    if (!targetCommand) return;
    this.isNavigatingBack = true;
    try {
      await this.execute(targetCommand.name, {
        echo: false,
        syncHash: true,
        focus: false,
      });
    } finally {
      this.isNavigatingBack = false;
      this.updateBackButtonState();
    }
  }

  private applyWindowAction(
    action: "shutdown" | "minimize" | "maximize",
  ): void {
    if (action === "shutdown") {
      this.shellElement.classList.add("is-shutdown");
      this.shellElement.classList.remove("is-minimized");
      this.updateDockState();
      return;
    }

    if (action === "minimize") {
      this.shellElement.classList.add("is-minimized");
      this.shellElement.classList.remove("is-shutdown");
      this.updateDockState();
      return;
    }

    const shell = this.shellElement;
    const wasMaximized = shell.classList.contains("is-maximized");

    if (wasMaximized) {
      shell.classList.remove("is-maximized");
      if (this.isShellFrameMode()) {
        if (this.preMaximizeFrame) this.applyShellFrame(this.preMaximizeFrame);
        else this.centerShell();
        this.preMaximizeFrame = null;
      }
      shell.classList.remove("is-minimized", "is-shutdown");
      this.updateDockState();
      return;
    }

    if (this.isShellFrameMode() && this.shellWindowingActive)
      this.preMaximizeFrame = this.readFrameFromDom();
    else this.preMaximizeFrame = null;

    shell.classList.add("is-maximized");
    shell.classList.remove("is-minimized", "is-shutdown");
    this.clearShellInlineLayout();
    this.updateDockState();
  }

  private restoreWindow(): void {
    this.shellElement.classList.remove("is-minimized", "is-shutdown");
    this.updateDockState();
    this.inputElement.focus();
  }

  private toggleDockWindow(): void {
    const isHiddenState =
      this.shellElement.classList.contains("is-minimized") ||
      this.shellElement.classList.contains("is-shutdown");

    if (isHiddenState) {
      this.restoreWindow();
      return;
    }

    this.applyWindowAction("minimize");
  }

  private updateDockState(): void {
    const isHiddenState =
      this.shellElement.classList.contains("is-minimized") ||
      this.shellElement.classList.contains("is-shutdown");
    const isMaximized = this.shellElement.classList.contains("is-maximized");
    this.dockElement.hidden = false;
    this.dockElement.classList.toggle("is-active", !isHiddenState);
    this.dockElement.classList.toggle("is-hidden-state", isHiddenState);
    this.dockElement.classList.toggle(
      "is-maximized",
      isMaximized && !isHiddenState,
    );
    this.dockElement.setAttribute(
      "aria-label",
      isHiddenState ? "Restore terminal window" : "Minimize terminal window",
    );
  }

  private downloadResume(format: "pdf" | "markdown"): void {
    const href =
      format === "markdown" ? resumeData.pdf.markdownHref : resumeData.pdf.href;
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download =
      format === "markdown"
        ? "chris-pecunies-resume.md"
        : "chris-pecunies-resume.pdf";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  private copyIfClipboardCommand(command: string): void {
    const normalized = command.replace(/^\//, "").trim();

    if (!normalized.startsWith("cp ")) return;

    const text = normalized.slice(3);
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  private async recordMetric(route: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/api/metrics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      const response = await fetch(`${API_BASE}/api/posts`);
      const payload = (await response.json()) as {
        posts?: Array<{
          title: string;
          slug: string;
          path: string;
          markdown: string;
          published?: string;
          description?: string;
          tags?: string[];
          comments?: Array<{
            id?: number;
            name: string;
            message: string;
            at: string;
            replies?: Array<{
              id?: number;
              name: string;
              message: string;
              at: string;
            }>;
          }>;
        }>;
      };
      if (!response.ok) throw new Error("posts fetch failed");
      const posts = Array.isArray(payload.posts) ? payload.posts : [];

      this.lines.push({
        id: this.makeId(),
        kind: "view",
        html: this.renderPosts(posts),
        text: posts
          .map((post) => `${post.title}\n${post.markdown}`)
          .join("\n\n"),
      });
      this.renderLog();
    } catch {
      this.lines.push({
        id: this.makeId(),
        kind: "view",
        html: this.renderPosts([]),
        text: "No published posts found.",
      });
      this.lines.push(
        this.responseLine("Could not load the live /api/posts index.", "warn"),
      );
      this.renderLog();
    }
  }

  private renderPosts(
    posts: Array<{
      title: string;
      slug: string;
      path: string;
      markdown: string;
      published?: string;
      description?: string;
      tags?: string[];
      comments?: Array<{
        id?: number;
        name: string;
        message: string;
        at: string;
        replies?: Array<{
          id?: number;
          name: string;
          message: string;
          at: string;
        }>;
      }>;
    }>,
  ): string {
    const commentCountLabel = (count: number): string =>
      `${count} ${count === 1 ? "comment" : "comments"}`;
    const feedBody = posts.length
      ? posts
          .map((post) => {
            const commentList = post.comments ?? [];
            const comments = commentList.reduce(
              (total, comment) => total + 1 + (comment.replies?.length ?? 0),
              0,
            );

            return `
              <article
                class="output-record post-card timeline-item post-timeline-item is-clickable"
                role="button"
                tabindex="0"
                data-command="post open ${this.escapeAttribute(post.slug)}"
              >
                <span class="timeline-marker" aria-hidden="true"></span>
                <div class="record-topline">
                  <p class="post-card-titleline">
                    <strong>${this.escapeHtml(post.title)}</strong>
                  </p>
                </div>
                <p class="post-date-line">
                  <time class="post-date" datetime="${this.escapeAttribute(post.published ?? "")}">${this.escapeHtml(post.published ?? "—")}</time>
                </p>
                <div class="post-card-status">
                  <span class="post-path-line"><code>${this.escapeHtml(post.path)}</code></span>
                </div>
                <div class="post-tag-row" aria-label="Post tags">
                  ${(post.tags ?? [])
                    .map(
                      (tag) =>
                        `<button type="button" class="content-tag post-tag-chip" data-command="tags ${this.escapeAttribute(tag)}" data-entity-tag="${this.escapeAttribute(tag)}">#${this.escapeHtml(tag)}</button>`,
                    )
                    .join("")}
                </div>
                <p class="record-summary post-excerpt">${this.escapeHtml(post.description ?? this.markdownPreview(post.markdown))}</p>
                <div class="record-meta post-card-actions">
                  <button type="button" class="post-comments-action" data-command="post open ${this.escapeAttribute(post.slug)}">${this.escapeHtml(commentCountLabel(comments))}</button>
                  <span>comment <code>${this.escapeHtml(post.slug)}</code> &lt;name&gt; &lt;message&gt;</span>
                </div>
                ${
                  comments
                    ? `<div class="output-copy post-comments-preview">${commentList
                        .map(
                          (comment) =>
                            `<p><strong>${this.escapeHtml(comment.name)}</strong>: ${this.escapeHtml(comment.message)}</p>`,
                        )
                        .join("")}</div>`
                    : ""
                }
              </article>
            `;
          })
          .join("")
      : '<p class="post-feed-empty">No published posts found.</p>';

    return `
      <div class="terminal-view is-live post-index-view">
        <section class="output-block">
          <div class="post-feed-head">
            <h2 class="output-heading">Published posts</h2>
            <p class="post-feed-rss">
              <a href="/api/rss" target="_blank" rel="noopener noreferrer" class="rss-subscribe-link" aria-label="RSS feed">RSS</a>
            </p>
          </div>
          <div class="output-records post-feed timeline-rail">
            ${feedBody}
          </div>
        </section>
      </div>
    `;
  }

  private markdownPreview(markdown: string): string {
    return markdown
      .replace(/^#\s+.+$/m, "")
      .replace(/[#*_`]/g, "")
      .trim()
      .slice(0, 420);
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value).replaceAll("\n", " ").replaceAll("\r", "");
  }

  private parseChatStreamEvent(line: string): ChatStreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as ChatStreamEvent;
    } catch {
      return null;
    }
  }

  private renderTraceHtml(lines: string[]): string {
    if (!lines.length) return "";
    return `<ul class="pretty-thinking-list">${lines
      .map((line) => `<li>${this.escapeHtml(line)}</li>`)
      .join("")}</ul>`;
  }

  private renderTraceText(lines: string[]): string {
    return lines.join("\n");
  }

  private async sendChat(message: string): Promise<void> {
    if (this.chatPending) {
      this.lines.push(
        this.responseLine("A chat response is already running.", "warn"),
      );
      this.renderLog();
      return;
    }

    this.chatPending = true;
    this.lines.push(this.commandLine(message));
    const pendingId = this.makeId();
    this.lines.push({
      id: pendingId,
      kind: "pretty-response",
      html: renderMarkdownToHtml(""),
      text: "",
      model: this.aiModel,
      copyable: true,
      traceHtml: this.renderTraceHtml(["Opening chat stream…"]),
      traceText: "Opening chat stream…",
      traceLabel: "Trace",
    });
    this.renderLog();

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          model: this.aiModel,
          systemPrompt: this.systemPromptInjection,
          toolsEnabled: this.aiToolsEnabled,
          skillsEnabled: this.skillUseEnabled,
          message,
          visibleContext: this.visibleContext(),
          history: this.lines
            .filter((line) => line.id !== pendingId)
            .slice(-12)
            .map((line) => ({
              kind: line.kind,
              text: this.lineText(line),
            })),
        }),
      });
      if (!response.ok || !response.body) {
        const payload = (await response
          .json()
          .catch(() => null)) as ChatErrorResponse | null;
        const text =
          payload?.error ??
          `Chat request failed with status ${response.status}.`;
        this.replaceLine(pendingId, text, "warn");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let model = this.aiModel;
      let traceLabel = "Trace";
      const traceLines: string[] = [];

      const syncPendingLine = (final = false): void => {
        if (final)
          this.replaceLineMarkdown(
            pendingId,
            answer,
            model,
            renderMarkdownToHtml,
            traceLines,
            traceLabel,
          );
        else
          this.replaceLineStreaming(
            pendingId,
            answer,
            model,
            traceLines,
            traceLabel,
          );
        this.renderLog();
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const event = this.parseChatStreamEvent(line);
          if (!event) continue;
          if (event.type === "meta") {
            if (event.model) model = event.model;
            if (event.traceLabel) traceLabel = event.traceLabel;
            syncPendingLine(false);
            continue;
          }
          if (event.type === "trace") {
            const text = String(event.text ?? "").trim();
            if (text) {
              traceLines.push(text);
              syncPendingLine(false);
            }
            continue;
          }
          if (event.type === "answer") {
            const delta = String(event.delta ?? "");
            if (delta) {
              answer += delta;
              syncPendingLine(false);
            }
            continue;
          }
          if (event.type === "error") {
            this.replaceLine(
              pendingId,
              event.error ?? "Chat stream failed.",
              "warn",
            );
            this.renderLog();
            return;
          }
          if (event.type === "done") {
            if (event.model) model = event.model;
            if (event.traceLabel) traceLabel = event.traceLabel;
            if (!answer && event.answer) answer = event.answer;
            syncPendingLine(true);
          }
        }

        if (done) break;
      }

      const tailEvent = this.parseChatStreamEvent(buffer.trim());
      if (tailEvent?.type === "done") {
        if (tailEvent.model) model = tailEvent.model;
        if (tailEvent.traceLabel) traceLabel = tailEvent.traceLabel;
        if (!answer && tailEvent.answer) answer = tailEvent.answer;
      }
      this.replaceLineMarkdown(
        pendingId,
        answer,
        model,
        renderMarkdownToHtml,
        traceLines,
        traceLabel,
      );
    } catch {
      this.replaceLine(
        pendingId,
        "Chat request failed before reaching the Cloudflare AI worker.",
        "warn",
      );
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
      kind: "response",
      text: "…",
      tone: "info",
    });
    this.renderLog();

    try {
      const response = await fetch(`${API_BASE}/api/os`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          command,
          model: this.aiModel,
          systemPrompt: this.systemPromptInjection,
          skillsEnabled: this.skillUseEnabled,
          visibleContext: this.visibleContext(),
        }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as OsResponse | null;
      const output = response.ok
        ? (payload?.output ?? "OK")
        : (payload?.output ??
          payload?.error ??
          `OS command failed with status ${response.status}.`);

      if (payload?.config && typeof payload.config === "object")
        this.applyOsConfig(payload.config as Record<string, unknown>);

      if (payload?.mode === "chat") {
        this.chatMode = true;
        this.promptLabel.textContent = "chat>";
        this.triggerViewSwitchFeedback("chat");
        this.themeIndicator.textContent = "workers-ai";
        this.highlightNavLink("chat");
      }

      if (output.startsWith("[sudo]") || output.startsWith("Password:"))
        this.sensitiveNextInput = true;

      const cmdTrim = command.trim();
      const catPath =
        cmdTrim.match(/^cat\s+(?:--pretty\s+)?(\S+)/i)?.[1] ?? null;
      const lessPath = cmdTrim.match(/^less\s+(\S+)/i)?.[1] ?? null;
      const targetPath = (
        (catPath ?? lessPath)
          ? `/${(catPath ?? lessPath)!.replace(/^\/+/, "")}`
          : ""
      ).toLowerCase();
      const isMarkdownPath = /\.(md|markdown)$/i.test(targetPath);
      const isCodePath =
        /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|css|scss|sass|less|html|xml|svg|py|pyi|go|rs|java|kt|kts|scala|cs|c|h|cpp|cc|cxx|hpp|php|rb|swift|zig|sh|bash|zsh|fish|ps1|sql|yml|yaml|toml|ini|env|dockerfile)$/i.test(
          targetPath,
        );
      const isAiMarkdown = /^\s*(ask|explain)\b/i.test(cmdTrim);

      if (!response.ok) {
        this.replaceLine(pendingId, output, "warn");
      } else if (isMarkdownPath || isAiMarkdown) {
        this.morphLineToPretty(pendingId);
        const renderer = targetPath.startsWith("/posts/")
          ? renderPostMarkdownToHtml
          : renderMarkdownToHtml;
        await this.streamMarkdownToLine(
          pendingId,
          output,
          isAiMarkdown ? this.aiModel : undefined,
          renderer,
        );
      } else if (isCodePath) {
        this.morphLineToPretty(pendingId);
        await this.streamMarkdownToLine(
          pendingId,
          this.normalizeCodeMarkdown(output, targetPath),
        );
      } else this.replaceLine(pendingId, output, "success");
    } catch {
      this.replaceLine(
        pendingId,
        "OS command failed before reaching the Cloudflare worker.",
        "warn",
      );
    } finally {
      this.renderLog();
      this.inputElement.focus();
    }
  }

  private async recordCommand(command: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/api/os`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
    return [
      this.viewElement.textContent ?? "",
      ...this.lines.map((line) => this.lineText(line)),
    ]
      .join("\n")
      .slice(-6000);
  }

  private normalizeCodeMarkdown(output: string, targetPath: string): string {
    const lang = (targetPath.split(".").pop() || "text").toLowerCase();
    const trimmed = String(output || "").trim();
    const fenced = trimmed.match(/^```([a-zA-Z0-9_-]*)\n([\s\S]*?)\n```$/);
    if (fenced) {
      const existingLang = (fenced[1] || "").toLowerCase() || lang;
      const body = fenced[2] ?? "";
      return `\`\`\`${existingLang}\n${body}\n\`\`\``;
    }
    return `\`\`\`${lang}\n${output}\n\`\`\``;
  }

  private lineText(line: SessionLine): string {
    if (line.kind === "view") return line.text;
    return line.text;
  }

  private viewText(view: ViewDefinition): string {
    const sections = view.sections
      .map((section) => {
        if (section.type === "paragraphs")
          return `${section.heading}\n${section.body.join("\n")}`;
        if (section.type === "note")
          return `${section.heading}\n${section.lines.join("\n")}`;
        if (section.type === "timeline")
          return `${section.heading}\n${section.items
            .map(
              (item) =>
                `${item.period} ${item.role} ${item.company}: ${item.summary}`,
            )
            .join("\n")}`;
        if (section.type === "projects")
          return `${section.heading}\n${section.items
            .map((item) => `${item.name}: ${item.summary}`)
            .join("\n")}`;
        if (section.type === "tag-groups")
          return `${section.heading}\n${section.groups
            .map((group) => `${group.title}: ${group.items.join(", ")}`)
            .join("\n")}`;
        if (section.type === "contact")
          return `${section.heading}\n${section.items.map((item) => `${item.label}: ${item.value}`).join("\n")}`;
        if (section.type === "education")
          return `${section.heading}\n${section.item.school}: ${section.item.degree}`;
        if (section.type === "command-list")
          return `${section.heading}\n${section.items.map((item) => item.usage).join("\n")}`;
        if (section.type === "pdf")
          return `${section.heading}\n${section.summary}`;
        if (section.type === "tag-index")
          return `${section.heading}\n${section.items.map((i) => `${i.type}: ${i.label} (${i.command})`).join("\n")}`;

        return "";
      })
      .join("\n\n");

    return `${view.title}\n${view.description}\n${sections}`;
  }

  private replaceLine(id: string, text: string, tone: LogTone): void {
    this.lines = this.lines.map((line) =>
      line.id === id
        ? {
            id,
            kind: "response",
            text,
            tone,
          }
        : line,
    );
  }

  private morphLineToPretty(id: string): void {
    this.lines = this.lines.map((line) =>
      line.id === id
        ? {
            id,
            kind: "pretty-response",
            html: renderMarkdownToHtml(""),
            text: "",
            copyable: false,
          }
        : line,
    );
  }

  private async streamMarkdownToLine(
    id: string,
    text: string,
    model?: string,
    renderer: (markdown: string) => string = renderMarkdownToHtml,
  ): Promise<void> {
    if (!text) {
      this.replaceLineMarkdown(id, "", model, renderer);
      return;
    }
    // Performance: keep streaming effect but cap DOM rewrites aggressively.
    const chunkCount =
      text.length > 2400
        ? 1
        : text.length > 1200
          ? 2
          : text.length > 600
            ? 3
            : 5;
    for (let i = 1; i <= chunkCount; i += 1) {
      const end = Math.floor((text.length * i) / chunkCount);
      const acc = text.slice(0, end);
      this.replaceLineStreaming(id, acc, model);
      this.renderLog();
      this.outputElement.scrollTop = this.outputElement.scrollHeight;
      await new Promise((r) =>
        window.requestAnimationFrame(() => r(undefined)),
      );
    }
    this.replaceLineMarkdown(id, text, model, renderer);
    this.renderLog();
  }

  private replaceLineStreaming(
    id: string,
    raw: string,
    model?: string,
    traceLines: string[] = [],
    traceLabel = "Trace",
  ): void {
    const display = raw || "…";
    const html = `<pre class="streaming-output">${this.escapeHtml(display)}</pre>`;
    this.lines = this.lines.map((line) =>
      line.id === id
        ? {
            id,
            kind: "pretty-response",
            html,
            text: raw,
            model,
            copyable: false,
            traceHtml: this.renderTraceHtml(traceLines),
            traceText: this.renderTraceText(traceLines),
            traceLabel,
          }
        : line,
    );
  }

  private replaceLineMarkdown(
    id: string,
    raw: string,
    model?: string,
    renderer: (markdown: string) => string = renderMarkdownToHtml,
    traceLines: string[] = [],
    traceLabel = "Trace",
  ): void {
    const html = renderer(raw);
    this.lines = this.lines.map((line) =>
      line.id === id
        ? {
            id,
            kind: "pretty-response",
            html,
            text: raw,
            model,
            copyable: true,
            traceHtml: this.renderTraceHtml(traceLines),
            traceText: this.renderTraceText(traceLines),
            traceLabel,
          }
        : line,
    );
  }

  private pushHistory(command: string): void {
    if (this.history.at(-1) !== command) this.history.push(command);
    if (this.history.length > 40) this.history.shift();
    window.localStorage.setItem(
      "pecunies-terminal-command-history",
      JSON.stringify(this.history),
    );
  }

  private restorePersistedHistory(): void {
    try {
      const history = JSON.parse(
        window.localStorage.getItem("pecunies-terminal-command-history") ??
          "[]",
      ) as string[];
      this.history = Array.isArray(history)
        ? history.filter((entry) => typeof entry === "string").slice(-40)
        : [];
    } catch {
      this.history = [];
    }
  }

  private restoreHistory(direction: -1 | 1): void {
    if (!this.history.length) return;
    if (this.historyIndex === null)
      this.historyIndex = direction === -1 ? this.history.length - 1 : 0;
    else
      this.historyIndex = Math.min(
        this.history.length - 1,
        Math.max(0, this.historyIndex + direction),
      );
    const command = this.history[this.historyIndex];
    if (!command) return;
    this.inputElement.value = command;
    this.inputElement.setSelectionRange(command.length, command.length);
  }

  private startGame(game: GameKind): void {
    this.gameMode = game;
    this.pendingScore = null;
    this.minesGameOver = false;

    if (game === "jobquest") {
      this.jobQuestState = createJobQuestState();
      return;
    }
    this.jobQuestState = null;

    if (game === "chess") {
      this.chessMoves = 0;
      this.chessBoard = [
        ["r", "n", "b", "q", "k", "b", "n", "r"],
        ["p", "p", "p", "p", "p", "p", "p", "p"],
        [".", ".", ".", ".", ".", ".", ".", "."],
        [".", ".", ".", ".", ".", ".", ".", "."],
        [".", ".", ".", ".", ".", ".", ".", "."],
        [".", ".", ".", ".", ".", ".", ".", "."],
        ["P", "P", "P", "P", "P", "P", "P", "P"],
        ["R", "N", "B", "Q", "K", "B", "N", "R"],
      ];
      return;
    }

    if (game === "minesweeper") {
      this.startMinesweeper();
      return;
    }

    this.gameScore = 0;
    this.gameBoard = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => 0),
    );
    this.spawnTile();
    this.spawnTile();
  }

  private handleGameInput(input: string): void {
    const command = input.trim().toLowerCase();

    if (this.pendingScore) {
      const pending = this.pendingScore;
      this.pendingScore = null;
      void this.saveScore(
        pending.game,
        pending.score,
        input.trim() || "anonymous",
      );
      this.lines.push(
        this.responseLine(
          `Saved ${pending.game} score ${pending.score} for ${input.trim() || "anonymous"}.`,
          "success",
        ),
      );
      return;
    }

    if (command === "q" || command === "quit") {
      this.gameMode = null;
      this.jobQuestState = null;
      this.setShellPrompt();
      this.lines.push(this.responseLine("Game closed.", "info"));
      return;
    }

    if (command === "n" || command === "new") {
      const game = this.gameMode ?? "2048";
      this.startGame(game);
      this.lines.push(this.responseLine(this.renderGame(), "info"));
      return;
    }

    if (this.gameMode === "jobquest" && this.jobQuestState) {
      const result = processJobQuestInput(this.jobQuestState, input.trim());
      this.jobQuestState = result.state;
      const toneFor = (line: string, index: number): LogTone => {
        if (line.startsWith("Unknown choice")) return "warn";
        if (line.startsWith("(type a choice")) return "warn";
        if (index === result.lines.length - 1 && result.gameOver)
          return result.won ? "success" : "warn";
        return "info";
      };
      result.lines.forEach((line, index) => {
        this.lines.push(this.responseLine(line, toneFor(line, index)));
      });
      if (result.gameOver) {
        const score = jobQuestScore(result.state, result.won);
        this.pendingScore = { game: "jobquest", score };
        this.lines.push(
          this.responseLine(
            result.won
              ? "Enter a name to save this run, or run another command to leave the game."
              : "Enter a name to save this score, or run another command to leave the game.",
            "info",
          ),
        );
      }
      return;
    }

    if (this.gameMode === "chess") {
      this.handleChessInput(command);
      return;
    }

    if (this.gameMode === "minesweeper") {
      this.handleMinesInput(command);
      return;
    }

    const moved = this.moveGame(command);

    if (!moved) {
      this.lines.push(
        this.responseLine("Use w/a/s/d, n for new, or q to quit.", "warn"),
      );
      return;
    }

    this.spawnTile();
    const won = this.gameBoard.some((row) => row.some((cell) => cell >= 2048));
    const stuck = !this.canMoveGame();
    const suffix = won
      ? "\n\n2048 reached."
      : stuck
        ? "\n\nNo moves left. Press n for a new board."
        : "";
    this.lines.push(
      this.responseLine(
        `${this.renderGame()}${suffix}`,
        won ? "success" : stuck ? "warn" : "info",
      ),
    );

    if (won || stuck) {
      this.pendingScore = { game: "2048", score: this.gameScore };
      this.lines.push(
        this.responseLine(
          "Enter a name to save this score, or run another command to exit the game.",
          "info",
        ),
      );
    }
  }

  private moveGame(direction: string): boolean {
    const before = JSON.stringify(this.gameBoard);
    const transpose = (board: number[][]) =>
      board[0]?.map((_, index) => board.map((row) => row[index] ?? 0)) ?? [];
    const reverseRows = (board: number[][]) =>
      board.map((row) => [...row].reverse());
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

    if (direction === "a" || direction === "left")
      this.gameBoard = this.gameBoard.map(mergeLeft);
    else if (direction === "d" || direction === "right")
      this.gameBoard = reverseRows(reverseRows(this.gameBoard).map(mergeLeft));
    else if (direction === "w" || direction === "up")
      this.gameBoard = transpose(transpose(this.gameBoard).map(mergeLeft));
    else if (direction === "s" || direction === "down")
      this.gameBoard = transpose(
        reverseRows(reverseRows(transpose(this.gameBoard)).map(mergeLeft)),
      );

    return before !== JSON.stringify(this.gameBoard);
  }

  private canMoveGame(): boolean {
    for (let y = 0; y < 4; y += 1)
      for (let x = 0; x < 4; x += 1) {
        const cell = this.gameBoard[y]?.[x] ?? 0;
        if (
          !cell ||
          cell === this.gameBoard[y]?.[x + 1] ||
          cell === this.gameBoard[y + 1]?.[x]
        )
          return true;
      }

    return false;
  }

  private spawnTile(): void {
    const empty: Array<[number, number]> = [];

    for (let y = 0; y < 4; y += 1)
      for (let x = 0; x < 4; x += 1)
        if (!this.gameBoard[y]?.[x]) empty.push([y, x]);
    const slot = empty[Math.floor(Math.random() * empty.length)];
    if (!slot) return;
    const [y, x] = slot;
    this.gameBoard[y]![x] = Math.random() > 0.88 ? 4 : 2;
  }

  private renderGame(): string {
    if (this.gameMode === "chess") return this.renderChess();
    if (this.gameMode === "minesweeper") return this.renderMinesweeper();
    if (this.gameMode === "jobquest" && this.jobQuestState)
      return formatJobQuestScene(this.jobQuestState);
    const divider = "+------+------+------+------+";
    const rows = this.gameBoard.map((row) => {
      const cells = row
        .map((cell) => String(cell || ".").padStart(4, " "))
        .join(" | ");
      return `| ${cells} |`;
    });

    return [
      `score: ${this.gameScore}`,
      divider,
      ...rows.flatMap((row) => [row, divider]),
      "w/a/s/d move | n new | q quit",
    ].join("\n");
  }

  private handleChessInput(command: string): void {
    const match = /^([a-h])([1-8])([a-h])([1-8])$/.exec(command);

    if (!match) {
      this.lines.push(
        this.responseLine(
          "Use coordinate moves like e2e4, n for new, or q to quit.",
          "warn",
        ),
      );
      return;
    }

    const [, fromFile, fromRank, toFile, toRank] = match;
    const from = this.squareToIndex(fromFile!, fromRank!);
    const to = this.squareToIndex(toFile!, toRank!);
    const piece = this.chessBoard[from.row]?.[from.col] ?? ".";

    if (piece === ".") {
      this.lines.push(
        this.responseLine(`No piece on ${fromFile}${fromRank}.`, "warn"),
      );
      return;
    }

    this.chessBoard[to.row]![to.col] = piece;
    this.chessBoard[from.row]![from.col] = ".";
    this.chessMoves += 1;
    this.lines.push(this.responseLine(this.renderChess(), "info"));
  }

  private renderChess(): string {
    const rows = this.chessBoard.map(
      (row, index) => `${8 - index}  ${row.join(" ")}`,
    );
    return [
      `moves: ${this.chessMoves}`,
      "   a b c d e f g h",
      ...rows,
      "",
      "move: e2e4 | n new | q quit",
    ].join("\n");
  }

  private squareToIndex(
    file: string,
    rank: string,
  ): { row: number; col: number } {
    return {
      row: 8 - Number(rank),
      col: file.charCodeAt(0) - 97,
    };
  }

  private startMinesweeper(): void {
    const size = 8;
    this.minesOpenCount = 0;
    this.minesBoard = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        mine: false,
        open: false,
        flag: false,
        count: 0,
      })),
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

    for (let row = 0; row < size; row += 1)
      for (let col = 0; col < size; col += 1)
        this.minesBoard[row]![col]!.count = this.countAdjacentMines(row, col);
  }

  private handleMinesInput(command: string): void {
    if (this.minesGameOver) {
      this.lines.push(
        this.responseLine("Press n for a new board or q to quit.", "warn"),
      );
      return;
    }

    const match = /^(open|flag)\s+([a-h])([1-8])$/.exec(command);

    if (!match) {
      this.lines.push(
        this.responseLine(
          "Use open A1, flag B2, n for new, or q to quit.",
          "warn",
        ),
      );
      return;
    }

    const [, action, file, rank] = match;
    const { row, col } = this.squareToIndex(file!, rank!);
    const cell = this.minesBoard[row]?.[col];

    if (!cell) {
      this.lines.push(
        this.responseLine("Square is outside the board.", "warn"),
      );
      return;
    }

    if (action === "flag") {
      cell.flag = !cell.flag;
      this.lines.push(this.responseLine(this.renderMinesweeper(), "info"));
      return;
    }

    if (cell.flag) {
      this.lines.push(
        this.responseLine(
          "Square is flagged. Unflag it before opening.",
          "warn",
        ),
      );
      return;
    }

    cell.open = true;

    if (cell.mine) {
      this.minesGameOver = true;
      this.pendingScore = { game: "minesweeper", score: this.minesOpenCount };
      this.lines.push(
        this.responseLine(
          `${this.renderMinesweeper(true)}\n\nMine hit. Enter a name to save score ${this.minesOpenCount}.`,
          "warn",
        ),
      );
      return;
    }

    this.minesOpenCount += 1;
    const safeSquares = 64 - 10;

    if (this.minesOpenCount >= safeSquares) {
      this.minesGameOver = true;
      this.pendingScore = { game: "minesweeper", score: this.minesOpenCount };
      this.lines.push(
        this.responseLine(
          `${this.renderMinesweeper(true)}\n\nBoard cleared. Enter a name to save the win.`,
          "success",
        ),
      );
      return;
    }

    this.lines.push(this.responseLine(this.renderMinesweeper(), "info"));
  }

  private renderMinesweeper(reveal = false): string {
    const rows = this.minesBoard.map((row, rowIndex) => {
      const cells = row
        .map((cell) => {
          if (reveal && cell.mine) return "*";
          if (cell.flag) return "F";
          if (!cell.open) return ".";
          return cell.count ? String(cell.count) : " ";
        })
        .join(" ");
      return `${8 - rowIndex}  ${cells}`;
    });

    return [
      `open: ${this.minesOpenCount}/54`,
      "   A B C D E F G H",
      ...rows,
      "",
      "open A1 | flag B2 | n new | q quit",
    ].join("\n");
  }

  private countAdjacentMines(row: number, col: number): number {
    let count = 0;

    for (let dy = -1; dy <= 1; dy += 1)
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dy === 0 && dx === 0) continue;
        if (this.minesBoard[row + dy]?.[col + dx]?.mine) count += 1;
      }
    return count;
  }

  private async saveScore(
    game: GameKind,
    score: number,
    name: string,
  ): Promise<void> {
    try {
      await fetch("/api/os", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
    return window.location.hash.replace(/^#\/?/, "").trim();
  }

  private writeRoute(route: string): void {
    if (!route) {
      this.suppressHashChange = true;
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      window.setTimeout(() => {
        this.suppressHashChange = false;
      }, 0);
      return;
    }

    const next = `#/${route}`;
    if (window.location.hash === next) return;
    this.suppressHashChange = true;
    window.location.hash = next;
    window.setTimeout(() => {
      this.suppressHashChange = false;
    }, 0);
  }

  private scrambleText(element: HTMLElement, nextText: string): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.textContent = nextText;
      return;
    }

    const previous = this.scrambleFrames.get(element);

    if (previous) window.cancelAnimationFrame(previous);
    const chars = "<>[]{}/*+?#$%&=";
    const current = element.textContent ?? "";
    const length = Math.max(current.length, nextText.length);
    const queue = Array.from({ length }, (_, index) => ({
      from: current[index] ?? " ",
      to: nextText[index] ?? " ",
      start: Math.floor(Math.random() * 8),
      end: 8 + Math.floor(Math.random() * 14),
      char: "",
    }));

    let frame = 0;

    const tick = () => {
      let output = "";
      let complete = 0;

      for (const item of queue) {
        if (frame >= item.end) {
          complete += 1;
          output += item.to;
          continue;
        }

        if (frame >= item.start) {
          if (!item.char || Math.random() < 0.26)
            item.char = chars[Math.floor(Math.random() * chars.length)] ?? "#";
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
      kind: "command",
      text,
    };
  }

  private responseLine(text: string, tone: LogTone): SessionLine {
    return {
      id: this.makeId(),
      kind: "response",
      text,
      tone,
    };
  }

  private makeId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getSessionId(): string {
    const key = "pecunies-terminal-session";
    const existing = window.localStorage.getItem(key);

    if (existing) return existing;
    const next =
      window.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, next);
    return next;
  }

  private requireElement<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Expected to find ${selector}.`);
    return element;
  }

  private isShellFrameMode(): boolean {
    return (
      window.innerWidth > 820 && !window.matchMedia("(pointer: coarse)").matches
    );
  }

  private setupShellWindowing(): void {
    window.addEventListener("resize", this.handleShellViewportResize);
    this.initializeShellLayout();
  }

  private readonly handleShellViewportResize = (): void => {
    this.syncShellLayoutWithViewport();
  };

  private initializeShellLayout(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.syncShellLayoutWithViewport();
      });
    });
  }

  private syncShellLayoutWithViewport(): void {
    const frameMode = this.isShellFrameMode();
    const shell = this.shellElement;
    if (!frameMode) {
      this.shellWindowingActive = false;
      shell.classList.remove("shell-frame-mode");
      if (!shell.classList.contains("is-maximized"))
        this.clearShellInlineLayout();
      return;
    }

    if (shell.classList.contains("is-maximized")) return;
    if (!this.shellWindowingActive) {
      this.shellWindowingActive = true;
      shell.classList.add("shell-frame-mode");
      if (!this.tryRestoreShellFrame()) this.centerShell();
      if (!this.shellBindingsDone) {
        this.bindShellDrag();
        this.bindShellResize();
        this.shellBindingsDone = true;
      }
    } else {
      this.clampShellToParent();
      try {
        localStorage.setItem(
          SHELL_FRAME_STORAGE,
          JSON.stringify(this.readFrameFromDom()),
        );
      } catch {
        /* ignore */
      }
    }
  }

  private tryRestoreShellFrame(): boolean {
    try {
      const raw = localStorage.getItem(SHELL_FRAME_STORAGE);
      if (!raw) return false;
      const f = JSON.parse(raw) as ShellFrame;
      if (
        ![f.left, f.top, f.width, f.height].every(
          (n) => typeof n === "number" && Number.isFinite(n),
        )
      )
        return false;
      const p = this.siteShellElement;
      const minW = Math.min(MIN_SHELL_W, p.clientWidth);
      const minH = Math.min(MIN_SHELL_H, p.clientHeight);
      const w = Math.min(Math.max(f.width, minW), p.clientWidth);
      const h = Math.min(Math.max(f.height, minH), p.clientHeight);
      const left = Math.min(
        Math.max(0, f.left),
        Math.max(0, p.clientWidth - w),
      );
      const top = Math.min(Math.max(0, f.top), Math.max(0, p.clientHeight - h));
      this.applyShellFrame({ left, top, width: w, height: h });
      return true;
    } catch {
      return false;
    }
  }

  private centerShell(): void {
    const shell = this.shellElement;
    const parent = this.siteShellElement;
    const w = shell.offsetWidth;
    const h = shell.offsetHeight;
    const left = Math.max(0, (parent.clientWidth - w) / 2);
    const top = Math.max(0, (parent.clientHeight - h) / 2);
    this.applyShellFrame({ left, top, width: w, height: h });
  }

  private readFrameFromDom(): ShellFrame {
    const shell = this.shellElement;
    return {
      left: shell.offsetLeft,
      top: shell.offsetTop,
      width: shell.offsetWidth,
      height: shell.offsetHeight,
    };
  }

  private applyShellFrame(f: ShellFrame): void {
    const shell = this.shellElement;
    shell.style.position = "absolute";
    shell.style.left = `${f.left}px`;
    shell.style.top = `${f.top}px`;
    shell.style.width = `${f.width}px`;
    shell.style.height = `${f.height}px`;
  }

  private clearShellInlineLayout(): void {
    const s = this.shellElement;
    s.style.position = "";
    s.style.left = "";
    s.style.top = "";
    s.style.width = "";
    s.style.height = "";
  }

  private clampShellToParent(): void {
    const p = this.siteShellElement;
    let { left, top, width, height } = this.readFrameFromDom();
    const minW = Math.min(MIN_SHELL_W, p.clientWidth);
    const minH = Math.min(MIN_SHELL_H, p.clientHeight);
    width = Math.min(Math.max(width, minW), p.clientWidth);
    height = Math.min(Math.max(height, minH), p.clientHeight);
    left = Math.min(Math.max(0, left), Math.max(0, p.clientWidth - width));
    top = Math.min(Math.max(0, top), Math.max(0, p.clientHeight - height));
    this.applyShellFrame({ left, top, width, height });
  }

  private bindShellDrag(): void {
    const header =
      this.shellElement.querySelector<HTMLElement>(".terminal-header");
    if (!header) return;

    header.addEventListener("pointerdown", (event: Event) => {
      const ev = event as PointerEvent;
      if (!this.shellWindowingActive) return;
      if (this.shellElement.classList.contains("is-maximized")) return;
      if (ev.button !== 0) return;
      const t = ev.target;
      if (t instanceof Element && t.closest("button, a, input, [data-command]"))
        return;

      ev.preventDefault();
      const shell = this.shellElement;
      const startX = ev.clientX;
      const startY = ev.clientY;
      const orig = this.readFrameFromDom();

      const onMove = (moveEvent: Event) => {
        const e = moveEvent as PointerEvent;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let left = orig.left + dx;
        let top = orig.top + dy;
        const parent = this.siteShellElement;
        const maxL = Math.max(0, parent.clientWidth - shell.offsetWidth);
        const maxT = Math.max(0, parent.clientHeight - shell.offsetHeight);
        left = Math.min(Math.max(0, left), maxL);
        top = Math.min(Math.max(0, top), maxT);
        this.applyShellFrame({
          left,
          top,
          width: orig.width,
          height: orig.height,
        });
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        try {
          localStorage.setItem(
            SHELL_FRAME_STORAGE,
            JSON.stringify(this.readFrameFromDom()),
          );
        } catch {
          /* ignore */
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  }

  private bindShellResize(): void {
    this.shellElement
      .querySelectorAll<HTMLElement>("[data-resize]")
      .forEach((handle) => {
        handle.addEventListener("pointerdown", (event: Event) => {
          const ev = event as PointerEvent;
          if (!this.shellWindowingActive) return;
          if (this.shellElement.classList.contains("is-maximized")) return;
          if (ev.button !== 0) return;
          ev.preventDefault();
          ev.stopPropagation();

          const edge = handle.dataset.resize ?? "";
          const startX = ev.clientX;
          const startY = ev.clientY;
          const startFrame = this.readFrameFromDom();

          const onMove = (moveEvent: Event) => {
            const e = moveEvent as PointerEvent;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let { left, top, width, height } = startFrame;

            if (edge.includes("e"))
              width = Math.max(
                Math.min(MIN_SHELL_W, this.siteShellElement.clientWidth),
                startFrame.width + dx,
              );
            if (edge.includes("s"))
              height = Math.max(
                Math.min(MIN_SHELL_H, this.siteShellElement.clientHeight),
                startFrame.height + dy,
              );
            if (edge.includes("w")) {
              const nw = Math.max(
                Math.min(MIN_SHELL_W, this.siteShellElement.clientWidth),
                startFrame.width - dx,
              );
              left = startFrame.left + (startFrame.width - nw);
              width = nw;
            }
            if (edge.includes("n")) {
              const nh = Math.max(
                Math.min(MIN_SHELL_H, this.siteShellElement.clientHeight),
                startFrame.height - dy,
              );
              top = startFrame.top + (startFrame.height - nh);
              height = nh;
            }

            const p = this.siteShellElement;
            const minW = Math.min(MIN_SHELL_W, p.clientWidth);
            const minH = Math.min(MIN_SHELL_H, p.clientHeight);
            width = Math.min(width, p.clientWidth - left);
            height = Math.min(height, p.clientHeight - top);
            left = Math.max(0, Math.min(left, p.clientWidth - width));
            top = Math.max(0, Math.min(top, p.clientHeight - height));
            width = Math.max(minW, Math.min(width, p.clientWidth - left));
            height = Math.max(minH, Math.min(height, p.clientHeight - top));

            this.applyShellFrame({ left, top, width, height });
          };

          const onUp = () => {
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onUp);
            document.removeEventListener("pointercancel", onUp);
            try {
              localStorage.setItem(
                SHELL_FRAME_STORAGE,
                JSON.stringify(this.readFrameFromDom()),
              );
            } catch {
              /* ignore */
            }
          };

          document.addEventListener("pointermove", onMove);
          document.addEventListener("pointerup", onUp);
          document.addEventListener("pointercancel", onUp);
        });
      });
  }

  private setupPointerDepth(): void {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    window.addEventListener("pointermove", (event) => {
      const driftX = (event.clientX / window.innerWidth - 0.5) * 108;
      const driftY = (event.clientY / window.innerHeight - 0.5) * 78;
      const xNorm = event.clientX / window.innerWidth;
      const yNorm = event.clientY / window.innerHeight;
      const depth = 0.86 + (1 - Math.abs(xNorm - 0.5) * 2) * 0.32;
      const hueShift = (xNorm - 0.5) * 34;
      const actionLift = (1 - yNorm) * 0.2;
      document.documentElement.style.setProperty(
        "--pointer-drift-x",
        `${driftX}px`,
      );
      document.documentElement.style.setProperty(
        "--pointer-drift-y",
        `${driftY}px`,
      );
      document.documentElement.style.setProperty(
        "--pointer-depth",
        depth.toFixed(3),
      );
      document.documentElement.style.setProperty(
        "--pointer-hue-shift",
        `${hueShift.toFixed(2)}deg`,
      );
      document.documentElement.style.setProperty(
        "--pointer-action-lift",
        actionLift.toFixed(3),
      );
    });

    const resetShell = () => {
      this.shellElement.style.setProperty("--shell-tilt-x", "0deg");
      this.shellElement.style.setProperty("--shell-tilt-y", "0deg");
      this.shellElement.style.setProperty("--shell-glow-x", "50%");
      this.shellElement.style.setProperty("--shell-glow-y", "50%");
    };

    resetShell();

    this.shellElement.addEventListener("pointermove", (event) => {
      const bounds = this.shellElement.getBoundingClientRect();
      const localX = event.clientX - bounds.left;
      const localY = event.clientY - bounds.top;
      const edgeDeadZonePx = 18;

      // Keep a quiet border around the window so resize handles are easier to grab.
      if (
        localX < edgeDeadZonePx ||
        localY < edgeDeadZonePx ||
        localX > bounds.width - edgeDeadZonePx ||
        localY > bounds.height - edgeDeadZonePx
      ) {
        resetShell();
        return;
      }

      const x = localX / bounds.width;
      const y = localY / bounds.height;

      this.shellElement.style.setProperty(
        "--shell-tilt-x",
        `${(0.5 - y) * 4}deg`,
      );
      this.shellElement.style.setProperty(
        "--shell-tilt-y",
        `${(x - 0.5) * 5.5}deg`,
      );
      this.shellElement.style.setProperty("--shell-glow-x", `${x * 100}%`);
      this.shellElement.style.setProperty("--shell-glow-y", `${y * 100}%`);
    });

    this.shellElement.addEventListener("pointerleave", resetShell);

    this.root.addEventListener("pointermove", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) return;
      const card = target.closest<HTMLElement>(
        ".terminal-stat, .output-record, .command-card, .pdf-thumb, .action-chip",
      );
      if (!card) return;
      const bounds = card.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * 100;
      const y = ((event.clientY - bounds.top) / bounds.height) * 100;
      card.style.setProperty("--card-glow-x", `${x}%`);
      card.style.setProperty("--card-glow-y", `${y}%`);
    });
  }

  private async handleSignalEdit(signalId: string): Promise<void> {
    const signal = resumeData.signals.find((s) => s.id === signalId);
    if (!signal) {
      this.lines.push(this.responseLine(`Signal ${signalId} not found.`, "error"));
      this.render();
      return;
    }

    this.lines.push(
      this.responseLine(`Editing signal: ${signal.label}`, "info"),
      this.responseLine(`Current value: ${signal.value}`, "info"),
    );
    if (signal.detail) {
      this.lines.push(this.responseLine(`Current detail: ${signal.detail}`, "info"));
    }
    this.lines.push(
      this.responseLine("Enter new value (or press Enter to keep current):", "info"),
    );
    this.render();
    this.inputElement.focus();

    const newValue = await this.waitForInput();
    const valueToSet = newValue.trim() || signal.value;

    this.lines.push(
      this.responseLine(`Enter new detail (or press Enter to keep current):`, "info"),
    );
    this.render();
    this.inputElement.focus();

    const newDetail = await this.waitForInput();
    const detailToSet = newDetail.trim() || signal.detail || "";

    try {
      await upsertSignal({
        signalId,
        signalLabel: signal.label,
        signalValue: valueToSet,
        signalDetail: detailToSet || undefined,
        signalAccent: signal.accent,
        signalMode: signal.mode,
      });
      this.lines.push(this.responseLine(`Signal updated successfully.`, "success"));
      
      signal.value = valueToSet;
      signal.detail = detailToSet || "";
      
      this.render();
    } catch (error) {
      this.lines.push(
        this.responseLine(`Failed to update signal: ${error instanceof Error ? error.message : String(error)}`, "error"),
      );
      this.render();
    }
  }

  private async handleSignalRemove(signalId: string): Promise<void> {
    const signal = resumeData.signals.find((s) => s.id === signalId);
    if (!signal) {
      this.lines.push(this.responseLine(`Signal ${signalId} not found.`, "error"));
      this.render();
      return;
    }

    this.lines.push(
      this.responseLine(`Remove signal: ${signal.label}? (y/N)`, "warn"),
    );
    this.render();
    this.inputElement.focus();

    const confirmation = await this.waitForInput();
    if (confirmation.trim().toLowerCase() !== "y") {
      this.lines.push(this.responseLine("Cancelled.", "info"));
      this.render();
      return;
    }

    try {
      await deleteSignal(signalId);
      this.lines.push(this.responseLine(`Signal removed successfully.`, "success"));
      
      const index = resumeData.signals.findIndex((s) => s.id === signalId);
      if (index !== -1) {
        resumeData.signals.splice(index, 1);
      }
      
      this.render();
    } catch (error) {
      this.lines.push(
        this.responseLine(`Failed to remove signal: ${error instanceof Error ? error.message : String(error)}`, "error"),
      );
      this.render();
    }
  }

  private waitForInput(): Promise<string> {
    return new Promise((resolve) => {
      const handler = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
          this.inputElement.removeEventListener("keydown", handler);
          resolve(this.inputElement.value);
          this.inputElement.value = "";
        }
      };
      this.inputElement.addEventListener("keydown", handler);
    });
  }
}
