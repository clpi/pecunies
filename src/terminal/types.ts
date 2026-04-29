import type { ResumeData } from '../data/resume';
import type { ThemeName } from './palette';

export type ViewStat = {
  label: string;
  value: string;
  detail?: string;
  command?: string;
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
  | NoteSection;

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
  stats?: ViewStat[];
  actions?: ViewAction[];
  sections: TerminalSection[];
};

export type LogTone = 'info' | 'success' | 'warn';

export type SessionLine =
  | { id: string; kind: 'system'; label: string; text: string; tone: LogTone }
  | { id: string; kind: 'command'; text: string }
  | { id: string; kind: 'response'; text: string; tone: LogTone }
  | { id: string; kind: 'view'; html: string; text: string };

export type CommandContext = {
  commands: readonly CommandDefinition[];
  resume: ResumeData;
  getTheme: () => ThemeName | null;
  setTheme: (theme: ThemeName | null) => void;
};

export type CommandOutcome =
  | { kind: 'view'; view: ViewDefinition; tone?: LogTone }
  | { kind: 'system'; text: string; tone?: LogTone }
  | { kind: 'chat'; text: string; tone?: LogTone }
  | { kind: 'exit'; text: string; tone?: LogTone }
  | { kind: 'window'; action: 'shutdown' | 'minimize' | 'maximize'; text?: string; tone?: LogTone }
  | { kind: 'download'; format: 'pdf' | 'markdown'; text?: string; tone?: LogTone }
  | { kind: 'os'; command: string; tone?: LogTone }
  | { kind: 'game'; game: '2048' | 'chess' | 'minesweeper'; text: string; tone?: LogTone }
  | { kind: 'clear' };

export type CommandDefinition = {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  group: string;
  route?: string;
  featured?: boolean;
  execute: (context: CommandContext, args: string[], raw: string) => CommandOutcome;
};
