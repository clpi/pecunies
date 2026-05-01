import type { ResumeData } from '../data/resume';
import type { ThemeName } from './palette';

export type EditorOptions = {
  file: string;
  content: string;
};

export type ViewStat = {
  label: string;
  value: string;
  detail?: string;
  command?: string;
  signalId?: string;
  signalAccent?: string;
  signalMode?: number;
};

export type ViewAction = {
  label: string;
  command?: string;
  href?: string;
  external?: boolean;
};

export type TimelineItem = {
  role: string;
  company: string;
  location: string;
  period: string;
  summary: string;
  bullets: string[];
  link?: {
    label: string;
    href?: string;
    command?: string;
  };
};

export type TagGroup = {
  title: string;
  items: string[];
  note?: string;
};

export type ProjectCard = {
  name: string;
  period: string;
  summary: string;
  details: string[];
  command?: string;
  link?: {
    label: string;
    href: string;
  };
};

export type ContactCard = {
  label: string;
  value: string;
  href?: string;
};

export type EducationCard = {
  school: string;
  degree: string;
  location: string;
  period: string;
  highlights: string[];
};

export type CommandHelpItem = {
  name: string;
  usage: string;
  description: string;
  command: string;
  group: string;
  tags?: string[];
};

export type PdfPreview = {
  label: string;
  image: string;
  href: string;
};

export type ParagraphSection = {
  type: 'paragraphs';
  heading: string;
  body: string[];
};

export type MetricsSection = {
  type: 'metrics';
  heading: string;
  items: ViewStat[];
};

export type TimelineSection = {
  type: 'timeline';
  heading: string;
  items: TimelineItem[];
};

export type TagGroupsSection = {
  type: 'tag-groups';
  heading: string;
  groups: TagGroup[];
};

export type ProjectsSection = {
  type: 'projects';
  heading: string;
  items: ProjectCard[];
};

export type ContactSection = {
  type: 'contact';
  heading: string;
  items: ContactCard[];
};

export type EducationSection = {
  type: 'education';
  heading: string;
  item: EducationCard;
};

export type CommandListSection = {
  type: 'command-list';
  heading: string;
  items: CommandHelpItem[];
};

export type PdfSection = {
  type: 'pdf';
  heading: string;
  src: string;
  summary: string;
  previews: PdfPreview[];
};

export type NoteSection = {
  type: 'note';
  heading: string;
  lines: string[];
  /** Optional trusted markup for decorative terminal banners. */
  html?: string;
};

export type TagIndexSection = {
  type: 'tag-index';
  heading: string;
  description?: string;
  filter?: string;
  selectedTags?: string[];
  allTags: { slug: string; count: number }[];
  items: { label: string; type: string; command: string }[];
};

export type TerminalSection =
  | ParagraphSection
  | MetricsSection
  | TimelineSection
  | TagGroupsSection
  | ProjectsSection
  | ContactSection
  | EducationSection
  | CommandListSection
  | PdfSection
  | NoteSection
  | TagIndexSection;

export type ViewDefinition = {
  id: string;
  route: string;
  prompt: string;
  eyebrow: string;
  title: string;
  description: string;
  note?: string;
  theme: ThemeName;
  logline: string;
  /** Content taxonomy — shown in tags browser and related surfaces */
  tags?: string[];
  stats?: ViewStat[];
  actions?: ViewAction[];
  sections: TerminalSection[];
};

export type LogTone = 'info' | 'success' | 'warn';

export type SessionLine =
  | { id: string; kind: 'system'; label: string; text: string; tone: LogTone }
  | { id: string; kind: 'command'; text: string }
  | { id: string; kind: 'response'; text: string; tone: LogTone }
  | {
      id: string;
      kind: 'pretty-response';
      html: string;
      text: string;
      model?: string;
      copyable?: boolean;
      traceHtml?: string;
      traceText?: string;
      traceLabel?: string;
    }
  | { id: string; kind: 'view'; html: string; text: string };

export type CommandContext = {
  commands: readonly CommandDefinition[];
  resume: ResumeData;
  getTheme: () => ThemeName | null;
  setTheme: (theme: ThemeName | null) => void;
  getDarkMode: () => boolean;
  setDarkMode: (dark: boolean) => void;
  /** Session Workers AI model (chat / ask / identity). */
  getAiModel: () => string;
  setAiModel: (model: string) => boolean;
  /** Prompt for the current sudo password when a frontend CRUD action needs it. */
  ensureSudoPassword: () => Promise<string | null>;
  /** Session system prompt injection (chat / identity). */
  getSystemPrompt: () => string;
  setSystemPrompt: (text: string) => void;
};

export type CommandOutcome =
  | { kind: 'view'; view: ViewDefinition; tone?: LogTone }
  | {
      kind: 'markdown-view';
      title: string;
      html: string;
      text: string;
      tone?: LogTone;
    }
  | { kind: 'system'; text: string; tone?: LogTone }
  | { kind: 'chat'; text: string; tone?: LogTone }
  | { kind: 'exit'; text: string; tone?: LogTone }
  | { kind: 'window'; action: 'shutdown' | 'minimize' | 'maximize'; text?: string; tone?: LogTone }
  | { kind: 'download'; format: 'pdf' | 'markdown'; text?: string; tone?: LogTone }
  | { kind: 'os'; command: string; tone?: LogTone }
  | { kind: 'game'; game: '2048' | 'chess' | 'minesweeper' | 'jobquest'; text: string; tone?: LogTone }
  | { kind: 'url'; url: string; text: string; tone?: LogTone }
  | { kind: 'clear' };

export interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  tags: string[];
  system_prompt: string;
  model: string;
  output_type: string;
  input_types: string[];
  tools: string[];
  skills: string[];
  example_usage: string;
  execution_count: number;
}

export interface StepDef {
  id: string;
  name: string;
  description: string;
  tags: string[];
  type: string;
  action: string;
  params: Record<string, any>;
  output_key: string;
  timeout_seconds: number;
  retry_count: number;
  retry_delay_seconds: number;
}

export interface TriggerDef {
  id: string;
  name: string;
  description: string;
  tags: string[];
  event_type: string;
  condition: string;
  action_type: string;
  action_id: string;
  enabled: boolean;
}

export interface JobDef {
  id: string;
  name: string;
  description: string;
  tags: string[];
  schedule: string;
  action_type: string;
  action_id: string;
  status: string;
  run_count: number;
  enabled: boolean;
}

export interface HookDef {
  id: string;
  name: string;
  description: string;
  tags: string[];
  hook_type: string;
  target_event: string;
  action_type: string;
  action_id: string;
  priority: number;
  enabled: boolean;
}

export interface ExecutionDef {
  id: string;
  source_type: string;
  source_id: string;
  status: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  input: Record<string, any>;
  output: string;
  error: string;
  trigger_type: string;
}

export type TaggedItem = {
  label: string;
  type: 'command' | 'view' | 'file' | 'link' | 'post' | 'section';
  command?: string;
  href?: string;
  tags: string[];
};

export type CommandDefinition = {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  group: string;
  route?: string;
  featured?: boolean;
  tags?: string[];
  /** When true, running this view clears the terminal buffer first (navbar-style pages). */
  fullPageView?: boolean;
  execute: (
    context: CommandContext,
    args: string[],
    raw: string,
  ) => CommandOutcome | Promise<CommandOutcome>;
};
