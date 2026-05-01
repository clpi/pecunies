import { resumeData } from "../data/resume";
import { renderPostMarkdownToHtml } from "./markdown";
import {
  COMMAND_TAGS,
  TAG_INDEX,
  type TagContentItem,
} from "../data/content-tags";
import { baseCommandForType } from "../data/catalog";
import { terminalThemes, type ThemeName } from "./palette";
import type {
  CommandDefinition,
  CommandHelpItem,
  CommandOutcome,
  ViewDefinition,
  ViewStat,
} from "./types";
import {
  fetchCatalog,
  fetchEntity,
  postComment,
  fetchHistory,
  authLogin,
  authSignup,
  type CatalogEntity,
  API_BASE,
} from "../api";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeTagItem(item: TagContentItem): {
  label: string;
  type: string;
  command: string;
} {
  if (item.type !== "command") {
    return { label: item.label, type: item.type, command: item.command };
  }
  const base = String(item.command || "")
    .trim()
    .replace(/^\//, "")
    .split(/\s+/)[0];
  return {
    label: item.label,
    type: item.type,
    command: base ? `man ${base}` : item.command,
  };
}

function mergeTagItems(
  slugs: string[],
  tagIndex: Record<string, TagContentItem[]>,
): { label: string; type: string; command: string }[] {
  const seen = new Set<string>();
  const out: { label: string; type: string; command: string }[] = [];
  for (const slug of slugs) {
    for (const item of tagIndex[slug] ?? []) {
      const normalized = normalizeTagItem(item);
      const key = `${item.command}\0${item.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function fallbackCommandTags(command: CommandDefinition): string[] {
  const groupTag = command.group.toLowerCase().replace(/\s+/g, "-");
  const surfaceTag = command.route ? "view" : "command";
  return ["terminal", groupTag, surfaceTag];
}

function intersectTagItems(
  slugs: string[],
  tagIndex: Record<string, TagContentItem[]>,
): { label: string; type: string; command: string }[] {
  if (!slugs.length) return [];
  const sets = slugs.map((slug) => {
    const entries = (tagIndex[slug] ?? []) as TagContentItem[];
    return new Set(entries.map((item) => `${item.command}\0${item.label}`));
  });
  const [first, ...rest] = sets;
  const out: { label: string; type: string; command: string }[] = [];
  for (const key of first ?? []) {
    if (!rest.every((set) => set.has(key))) continue;
    const [command, label] = key.split("\0");
    const base = ((tagIndex[slugs[0]!] ?? []) as TagContentItem[]).find(
      (item) => item.command === command && item.label === label,
    );
    if (!base) continue;
    out.push(normalizeTagItem(base));
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function buildCatalogTagIndex(
  entities: CatalogEntity[],
): Record<string, TagContentItem[]> {
  const out: Record<string, TagContentItem[]> = {};
  for (const entity of entities) {
    if (entity.type === "tag") continue;
    const command = `${baseCommandForType(entity.type)} ${entity.slug}`;
    const entry: TagContentItem = {
      label: entity.title || entity.slug,
      type: entity.type,
      command,
    };
    for (const rawTag of entity.tags ?? []) {
      const tag = String(rawTag).trim().toLowerCase();
      if (!tag) continue;
      if (!out[tag]) out[tag] = [];
      out[tag]!.push(entry);
    }
  }
  return out;
}

function mergeTagIndexes(
  ...indexes: Record<string, TagContentItem[]>[]
): Record<string, TagContentItem[]> {
  const out: Record<string, TagContentItem[]> = {};
  for (const index of indexes) {
    for (const [tag, items] of Object.entries(index)) {
      if (!out[tag]) out[tag] = [];
      out[tag]!.push(...items);
    }
  }
  return out;
}

function buildTagsView(
  filter: string | undefined,
  dynamicTagIndex: Record<string, TagContentItem[]>,
): ViewDefinition {
  const raw = filter?.trim().toLowerCase();
  const tokens = (raw ?? "")
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const selected = Array.from(new Set(tokens));
  const tagIndex: Record<string, TagContentItem[]> = { ...TAG_INDEX };
  for (const [slug, items] of Object.entries(dynamicTagIndex)) {
    const merged = [...(tagIndex[slug] ?? []), ...items];
    const seen = new Set<string>();
    tagIndex[slug] = merged.filter((item) => {
      const key = `${item.type}\0${item.label}\0${item.command}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const summaries = Object.keys(tagIndex)
    .sort((a, b) => a.localeCompare(b))
    .map((slug) => ({ slug, count: tagIndex[slug]?.length ?? 0 }));

  if (!selected.length) {
    return {
      id: "tags",
      route: "tags",
      prompt: "./terminal --tags",
      eyebrow: "Discovery",
      title: "Content tags",
      description:
        "Taxonomy across views, commands, portfolio files, and posts. Click a tag chip to see every item tagged with it, or type tags <name> in the prompt.",
      theme: "frost",
      logline: "Opened tag index.",
      tags: ["portfolio", "terminal", "tooling"],
      sections: [
        {
          type: "tag-index",
          heading: "All tags",
          description:
            "Tag counts include views, commands, files, and links. Use tags <partial> to match tag names (e.g. tags net for network).",
          allTags: summaries,
          selectedTags: [],
          items: [],
        },
      ],
    };
  }

  const allKnownTags = selected.every((tag) => Boolean(tagIndex[tag]));
  if (allKnownTags) {
    const items =
      selected.length === 1
        ? (tagIndex[selected[0]!] as TagContentItem[]).map((item) =>
            normalizeTagItem(item),
          )
        : intersectTagItems(selected, tagIndex);
    const selectedLabel = selected.map((tag) => `#${tag}`).join(" + ");
    return {
      id: "tags",
      route: "tags",
      prompt: `./terminal --tags --filter ${selected.join(" ")}`,
      eyebrow: "Discovery",
      title:
        selected.length === 1 ? `Tag #${selected[0]}` : `Tags ${selectedLabel}`,
      description:
        selected.length === 1
          ? `Everything tagged “${selected[0]}” in this portfolio shell.`
          : `Showing content that matches all selected tags: ${selectedLabel}.`,
      theme: "frost",
      logline: `Filtered tags: ${selected.join(", ")}.`,
      tags: selected,
      sections: [
        {
          type: "tag-index",
          heading:
            selected.length === 1
              ? `Items tagged #${selected[0]}`
              : `Items matching all: ${selectedLabel}`,
          filter: selected.join(" "),
          selectedTags: selected,
          allTags: summaries,
          items,
        },
      ],
    };
  }

  if (selected.length > 1) {
    return {
      id: "tags",
      route: "tags",
      prompt: `./terminal --tags --q ${selected.join(" ")}`,
      eyebrow: "Discovery",
      title: `No combined match`,
      description: `One or more selected tags are invalid. Pick from the available list below.`,
      theme: "frost",
      logline: `No match for multi-tag filter “${selected.join(" ")}”.`,
      sections: [
        {
          type: "tag-index",
          heading: "Browse all tags",
          description: `Selected tags must exist exactly. Invalid selection: ${selected.map((tag) => `#${tag}`).join(", ")}`,
          filter: selected.join(" "),
          selectedTags: [],
          allTags: summaries,
          items: [],
        },
      ],
    };
  }

  const single = selected[0]!;
  const matches = Object.keys(tagIndex).filter(
    (slug) => slug === single || slug.includes(single),
  );
  if (matches.length) {
    const items = mergeTagItems(matches, tagIndex);
    return {
      id: "tags",
      route: "tags",
      prompt: `./terminal --tags --q ${single}`,
      eyebrow: "Discovery",
      title: `Tags matching “${single}”`,
      description:
        matches.length > 1
          ? `Multiple tag buckets match “${single}”. Combined items are listed below.`
          : `Matched tag “${matches[0]}”.`,
      theme: "frost",
      logline: `Tag search “${single}”.`,
      tags: matches,
      sections: [
        {
          type: "tag-index",
          heading: "Matching content",
          description: `Tag keys matched: ${matches.map((m) => `#${m}`).join(", ")}`,
          filter: single,
          selectedTags: matches,
          allTags: matches.map((slug) => ({
            slug,
            count: tagIndex[slug].length,
          })),
          items,
        },
      ],
    };
  }

  return {
    id: "tags",
    route: "tags",
    prompt: `./terminal --tags --q ${single}`,
    eyebrow: "Discovery",
    title: `No tag “${single}”`,
    description:
      "Try another fragment, or pick a tag from the full list below.",
    theme: "blue",
    logline: `No tag match for “${single}”.`,
    sections: [
      {
        type: "tag-index",
        heading: "Browse all tags",
        description: `No tag or prefix matched “${single}”.`,
        filter: single,
        selectedTags: [],
        allTags: summaries,
        items: [],
      },
    ],
  };
}

export function createCommandRegistry(): {
  commands: CommandDefinition[];
  featuredCommands: CommandDefinition[];
} {
  const homeView: ViewDefinition = {
    id: "home",
    route: "",
    prompt: "./neofetch --compact",
    eyebrow: "pecunies.com",
    title: "Home",
    description: "My personal website and portfolio.",
    theme: "frost",
    tags: ["terminal", "portfolio", "view", "home"],
    logline: "Loaded terminal home.",
    actions: [
      { label: "about", command: "about" },
      { label: "commands", command: "commands" },
      { label: "resume", command: "resume" },
      { label: "projects", command: "projects" },
      { label: "experience", command: "experience" },
      { label: "skills", command: "skills" },
      { label: "posts", command: "posts" },
      { label: "links", command: "links" },
      { label: "contact", command: "contact" },
      { label: "themes", command: "themes" },
      { label: "pdf", command: "pdf" },
      { label: "ask", command: "ask " },
    ],
    sections: [
      {
        type: "note",
        heading: "neofetch",
        lines: [
          "guest@pecunies",
          "os: pecuOS version 0.1",
          "shell: /bin/clpsh",
          "focus: cloud systems, DevOps automation, distributed systems, runtime engineering",
          "try: help, resume, projects, timeline, cat /README.md, ask <question>",
        ],
      },
      {
        type: "contact",
        heading: "Important links",
        items: [
          {
            label: "GitHub",
            value: "github.com/clpi",
            href: "https://github.com/clpi",
          },
          {
            label: "LinkedIn",
            value: "linkedin.com/in/chrispecunies",
            href: "https://linkedin.com/in/chrispecunies",
          },
          {
            label: "Moe Marketplace",
            value: "moe.pecunies.com",
            href: "https://moe.pecunies.com",
          },
          {
            label: "Email",
            value: "chris@pecunies.com",
            href: "mailto:chris@pecunies.com",
          },
          {
            label: "Cal.com",
            value: "cal.com/chrisp",
            href: "https://cal.com/chrisp",
          },
          {
            label: "Resume PDF",
            value: resumeData.pdf.href,
            href: resumeData.pdf.href,
          },
        ],
      },
    ],
  };

  const overviewView: ViewDefinition = {
    id: "resume",
    route: "resume",
    prompt: "./resume --overview",
    eyebrow: "Profile",
    title: "My professional profile.",
    description: "My professional profile.",
    note: resumeData.availability,
    theme: "green",
    tags: ["resume", "career", "portfolio"],
    logline: "Loaded professional profile.",
    stats: buildSignalStats(),
    actions: [
      { label: "Experience", command: "experience" },
      { label: "Skills", command: "skills" },
      { label: "Resume PDF", command: "pdf" },
      { label: "download", command: "download" },
      { label: "download --markdown", command: "download --markdown" },
      { label: "Ask", command: "ask " },
      { label: "Email Chris", href: "mailto:chris@pecunies.com" },
    ],
    sections: [
      {
        type: "paragraphs",
        heading: "Summary",
        body: [...resumeData.summary],
      },
      {
        type: "metrics",
        heading: "Signals",
        items: buildSignalStats(),
      },
      {
        type: "timeline",
        heading: "Experience",
        items: resumeData.experience.map((item) => ({
          role: item.role,
          company: item.company,
          location: item.location,
          period: item.period,
          summary: item.summary,
          bullets: item.bullets,
        })),
      },
      {
        type: "tag-groups",
        heading: "Skills",
        groups: resumeData.skills.map((group) => ({
          title: group.title,
          items: [...group.items],
          note: group.note,
        })),
      },
      {
        type: "projects",
        heading: "Projects",
        items: resumeData.projects.map((project) => ({
          name: project.name,
          period: project.period,
          summary: project.summary,
          details: project.details,
          command: `project ${project.slug}`,
          link: project.link,
        })),
      },
      {
        type: "education",
        heading: "Education",
        item: { ...resumeData.education },
      },
    ],
  };

  const experienceView: ViewDefinition = {
    id: "experience",
    route: "experience",
    prompt: "./resume --experience",
    eyebrow: "Work history",
    title: "My work history.",
    note: "Use the experience command to open a role detail view.",
    stats: buildSignalStats(),
    description: "My work history.",
    theme: "orange",
    tags: ["career", "chronology"],
    logline:
      "Loaded timeline view across consulting, blockchain infra, and platform work.",
    actions: [
      { label: "Resume", command: "resume" },
      { label: "Projects", command: "projects" },
      { label: "Contact", command: "contact" },
    ],
    sections: [
      {
        type: "timeline",
        heading: "Experience",
        items: resumeData.experience.map((item) => ({
          role: item.role,
          company: item.company,
          location: item.location,
          period: item.period,
          summary: item.summary,
          bullets: item.bullets,
          link: { label: "Open →", command: `experience ${item.slug}` },
        })),
      },
    ],
  };

  const skillsView: ViewDefinition = {
    id: "skills",
    route: "skills",
    prompt: "./resume --skills",
    eyebrow: "Stack",
    title: "Cloud platforms, runtime code, and product delivery.",
    description:
      "The infrastructure, application surfaces, runtime systems, data paths, and observability tools I've worked with.",
    theme: "magenta",
    tags: ["skills", "engineering"],
    logline:
      "Loaded grouped skills across languages, cloud, web, and observability.",
    actions: [
      { label: "Projects", command: "projects" },
      { label: "Experience", command: "experience" },
      { label: "Themes", command: "themes" },
    ],
    sections: [
      {
        type: "tag-groups",
        heading: "Skill groups",
        groups: resumeData.skills.map((group) => ({
          title: group.title,
          items: [...group.items],
          note: group.note,
        })),
      },
      {
        type: "note",
        heading: "Biases",
        lines: [
          "Strong preference for automated delivery, reproducible infrastructure, and production-friendly interfaces.",
          "Most comfortable when the system underneath the UI is still visible and measurable.",
        ],
      },
    ],
  };

  const projectsView: ViewDefinition = {
    id: "projects",
    route: "projects",
    prompt: "./resume --projects",
    eyebrow: "Independent work",
    title: "My independent projects and work.",
    description: "My independent projects and work.",
    theme: "amber",
    tags: ["projects", "engineering", "devops"],
    note: "Use the project command to open a project detail view.",
    stats: buildSignalStats(),
    logline:
      "Loaded projects: Moe marketplace aggregation, Zig runtime work, and Raspberry Pi cluster ops.",
    actions: [
      { label: "Skills", command: "skills" },
      { label: "PDF", command: "pdf" },
      { label: "Contact", command: "contact" },
      { label: "Links", command: "links" },
      { label: "Experience", command: "experience" },
    ],
    sections: [
      {
        type: "projects",
        heading: "Projects",
        items: resumeData.projects.map((project) => ({
          name: project.name,
          period: project.period,
          summary: project.summary,
          details: project.details,
          command: `project ${project.slug}`,
          link: project.link,
        })),
      },
    ],
  };

  const projectDetailViews = Object.fromEntries(
    resumeData.projects.map((project) => [
      project.slug,
      {
        id: `project-${project.slug}`,
        route: `project/${project.slug}`,
        prompt: `./project --open ${project.slug}`,
        eyebrow: "Project",
        title: project.name,
        description: project.summary,
        theme: "amber",
        tags: ["projects", "engineering", "deep-dive"],
        logline: `Loaded project page: ${project.name}.`,
        actions: [
          { label: "Back to projects", command: "projects" },
          { label: "Resume", command: "resume" },
          ...(project.link
            ? [
                {
                  label: project.link.label,
                  href: project.link.href,
                  external: true,
                },
              ]
            : []),
        ],
        sections: [
          {
            type: "note",
            heading: "Overview",
            lines: [project.summary, `Period: ${project.period}`],
          },
          {
            type: "projects",
            heading: "Details",
            items: [
              {
                name: project.name,
                period: project.period,
                summary: project.summary,
                details: project.details,
                link: project.link,
              },
            ],
          },
          {
            type: "note",
            heading: "Next",
            lines: [
              `Use explain project ${project.slug} for an AI summary.`,
              "Return with projects to compare all portfolio projects.",
            ],
          },
        ],
      } satisfies ViewDefinition,
    ]),
  ) as Record<string, ViewDefinition>;

  const experienceDetailViews = Object.fromEntries(
    resumeData.experience.map((item) => [
      item.slug,
      {
        id: `experience-${item.slug}`,
        route: `experience/${item.slug}`,
        prompt: `./experience --open ${item.slug}`,
        eyebrow: item.company,
        title: item.role,
        description: item.summary,
        theme: "orange",
        tags: ["career", "work", "deep-dive"],
        logline: `Loaded experience detail: ${item.role} at ${item.company}.`,
        actions: [
          { label: "Back to experience", command: "experience" },
          { label: "Resume", command: "resume" },
          { label: "Projects", command: "projects" },
        ],
        sections: [
          {
            type: "note",
            heading: "Overview",
            lines: [item.summary, `${item.period} · ${item.location}`],
          },
          {
            type: "timeline",
            heading: "Highlights",
            items: [
              {
                role: item.role,
                company: item.company,
                location: item.location,
                period: item.period,
                summary: item.summary,
                bullets: item.bullets,
              },
            ],
          },
        ],
      } satisfies ViewDefinition,
    ]),
  ) as Record<string, ViewDefinition>;

  const educationView: ViewDefinition = {
    id: "education",
    route: "education",
    prompt: "./resume --education",
    eyebrow: "Education",
    title: "My formal engineering education and coursework.",
    description: "My formal engineering education and coursework.",
    theme: "green",
    tags: ["career"],
    logline: "Loaded education and coursework context.",
    actions: [
      { label: "Experience", command: "experience" },
      { label: "Resume", command: "resume" },
    ],
    sections: [
      {
        type: "education",
        heading: "Education",
        item: { ...resumeData.education },
      },
      {
        type: "note",
        heading: "Context",
        lines: [
          "The academic track crossed over with research software engineering at GEMSEC.",
          "That overlap is where containerized apps, scientific APIs, and data-heavy tooling first became part of the portfolio.",
        ],
      },
    ],
  };

  const contactView: ViewDefinition = {
    id: "contact",
    route: "contact",
    prompt: "./resume --contact",
    eyebrow: "Reach out",
    title: "Reach out to me directly.",
    description: "Reach out to me directly.",
    theme: "blue",
    tags: ["contact", "social", "career"],
    logline: "Loaded contact channels and resume links.",
    actions: [
      { label: "Email", href: "mailto:chris@pecunies.com" },
      {
        label: "LinkedIn",
        href: "https://linkedin.com/in/chrispecunies",
        external: true,
      },
      { label: "GitHub", href: "https://github.com/clpi", external: true },
      { label: "GitLab", href: "https://gitlab.com/clpi", external: true },
      { label: "Resume PDF", command: "pdf" },
    ],
    sections: [
      {
        type: "contact",
        heading: "Contact",
        items: resumeData.contact.map((item) => ({ ...item })),
      },
      {
        type: "note",
        heading: "Fit",
        lines: [
          "Open to platform engineering, DevOps, distributed systems, cloud architecture, and full-stack delivery work.",
          "Seattle-based and comfortable with remote or hybrid collaboration.",
        ],
      },
    ],
  };

  const pdfView: ViewDefinition = {
    id: "pdf",
    route: "resume-pdf",
    prompt: "./resume --pdf",
    eyebrow: "Document view",
    title: "My resume in PDF format.",
    description:
      "This route keeps the terminal framing while showing the real two-page PDF directly inside the experience.",
    note: "Use the page thumbnails for a quick scan or open the file in a new tab for the raw document.",
    theme: "frost",
    tags: ["document", "resume"],
    logline: "Loaded embedded resume PDF and page previews.",
    actions: [
      { label: "download", command: "download" },
      { label: "download --markdown", command: "download --markdown" },
      { label: "Resume", command: "resume" },
      { label: "Contact", command: "contact" },
    ],
    sections: [
      {
        type: "pdf",
        heading: "Resume PDF",
        src: resumeData.pdf.href,
        summary:
          "Two-page PDF pulled directly from the latest resume file and styled inside the shell.",
        previews: resumeData.pdf.previews.map((preview) => ({ ...preview })),
      },
    ],
  };

  const timelineView: ViewDefinition = {
    id: "timeline",
    route: "timeline",
    prompt: "./resume --timeline",
    eyebrow: "Chronology",
    title: "A single timeline for work, education, and projects.",
    description:
      "This view compresses the portfolio into chronological landmarks so the whole path is visible from one command.",
    theme: "amber",
    tags: ["chronology", "career"],
    logline:
      "Loaded combined timeline across education, work history, and projects.",
    actions: [
      { label: "Projects", command: "projects" },
      { label: "Work", command: "experience" },
      { label: "Education", command: "education" },
    ],
    sections: [
      {
        type: "timeline",
        heading: "Timeline",
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
            company: "Independent project",
            location: project.link?.href ?? "Local / cloud",
            period: project.period,
            summary: project.summary,
            bullets: project.details.slice(0, 2),
            link: project.link
              ? { label: project.link.label, href: project.link.href }
              : {
                  label: `explain ${project.slug}`,
                  command: `explain project ${project.slug}`,
                },
          })),
          {
            role: resumeData.education.degree,
            company: resumeData.education.school,
            location: resumeData.education.location,
            period: resumeData.education.period,
            summary:
              "Formal engineering background with software-heavy coursework and research overlap.",
            bullets: resumeData.education.highlights,
          },
        ],
      },
    ],
  };

  const linksView: ViewDefinition = {
    id: "links",
    route: "links",
    prompt: "./resume --links",
    eyebrow: "Links",
    title: "External surfaces and live project endpoints.",
    description:
      "A compact link board for contact channels, source control, deployed projects, and the resume document.",
    theme: "magenta",
    tags: ["links", "social"],
    logline:
      "Loaded link board with GitHub, GitLab, LinkedIn, Moe, PDF, and Markdown resume.",
    actions: [
      { label: "GitHub", href: "https://github.com/clpi", external: true },
      { label: "GitLab", href: "https://gitlab.com/clpi", external: true },
      { label: "SourceHut", href: "https://sr.ht/~clp/", external: true },
      { label: "Codeberg", href: "https://codeberg.org/clp", external: true },
      {
        label: "LinkedIn",
        href: "https://linkedin.com/in/chrispecunies",
        external: true,
      },
      { label: "download", command: "download" },
      { label: "download --markdown", command: "download --markdown" },
      { label: "/contact", command: "contact" },
    ],
    sections: [
      {
        type: "contact",
        heading: "Social Profiles",
        items: [
          {
            label: "LinkedIn",
            value: "linkedin.com/in/chrispecunies",
            href: "https://linkedin.com/in/chrispecunies",
          },
          { label: "X", value: "x.com/clpif", href: "https://x.com/clpif" },
          {
            label: "Threads",
            value: "threads.com/@chris.pecunies",
            href: "https://www.threads.com/@chris.pecunies",
          },
          {
            label: "Instagram",
            value: "instagram.com/chris.pecunies",
            href: "https://www.instagram.com/chris.pecunies/",
          },
          {
            label: "Facebook",
            value: "facebook.com/chris.pecunies",
            href: "https://www.facebook.com/chris.pecunies/",
          },
        ],
      },
      {
        type: "contact",
        heading: "Support Me",
        items: [
          {
            label: "Ko-fi",
            value: "ko-fi.com/clp",
            href: "https://ko-fi.com/clp",
          },
          {
            label: "Patreon",
            value: "patreon.com/pecunies",
            href: "https://patreon.com/pecunies",
          },
          {
            label: "Open Collective",
            value: "opencollective.com/clp",
            href: "https://opencollective.com/clp",
          },
          {
            label: "Buy Me a Coffee",
            value: "buymeacoffee.com/pecunies",
            href: "https://buymeacoffee.com/pecunies",
          },
        ],
      },
      {
        type: "contact",
        heading: "Git Profiles",
        items: [
          {
            label: "GitHub",
            value: "github.com/clpi",
            href: "https://github.com/clpi",
          },
          {
            label: "GitLab",
            value: "gitlab.com/clpi",
            href: "https://gitlab.com/clpi",
          },
          {
            label: "SourceHut",
            value: "sr.ht/~clp",
            href: "https://sr.ht/~clp/",
          },
          {
            label: "Codeberg",
            value: "codeberg.org/clp",
            href: "https://codeberg.org/clp",
          },
        ],
      },
      {
        type: "contact",
        heading: "Projects",
        items: [
          {
            label: "WASM Runtime",
            value: "github.com/clpi/wart.git",
            href: "https://github.com/clpi/wart.git",
          },
          {
            label: "down.nvim",
            value: "github.com/clpi/down.nvim.git",
            href: "https://github.com/clpi/down.nvim.git",
          },
          {
            label: "pecunies.com",
            value: "github.com/clpi/pecunies.git",
            href: "https://github.com/clpi/pecunies.git",
          },
          {
            label: "Moe Marketplace",
            value: "moe.pecunies.com",
            href: "https://moe.pecunies.com",
          },
        ],
      },
      {
        type: "contact",
        heading: "Contact",
        items: [
          {
            label: "Terminal Contact View",
            value: "/contact",
            href: "#/contact",
          },
          {
            label: "Email",
            value: "chris@pecunies.com",
            href: "mailto:chris@pecunies.com",
          },
          {
            label: "Cal.com",
            value: "cal.com/chrisp",
            href: "https://cal.com/chrisp",
          },
          {
            label: "Calendly",
            value: "calendly.com/pecunies",
            href: "https://calendly.com/pecunies",
          },
          { label: "Short site", value: "clp.is", href: "https://clp.is" },
        ],
      },
      {
        type: "contact",
        heading: "Misc",
        items: [
          {
            label: "Resume PDF",
            value: resumeData.pdf.href,
            href: resumeData.pdf.href,
          },
          {
            label: "Resume Markdown",
            value: resumeData.pdf.markdownHref,
            href: resumeData.pdf.markdownHref,
          },
        ],
      },
    ],
  };

  const postsView: ViewDefinition = {
    id: "posts",
    route: "posts",
    prompt: "./posts --list",
    eyebrow: "Posts",
    title: "Chronological notes and essays.",
    description:
      "A lightweight post index for writing that will stay terminal-native and RSS-addressable.",
    theme: "red",
    tags: ["writing", "content"],
    logline: "Loaded post index and RSS location.",
    actions: [
      { label: "RSS", href: "/api/rss", external: true },
      { label: "About", command: "about" },
      { label: "Projects", command: "projects" },
    ],
    sections: [],
  };

  const aboutView: ViewDefinition = {
    id: "about",
    route: "about",
    prompt: "about",
    eyebrow: "About",
    title: "About this site.",
    description:
      "This site is a one-page terminal emulator with command history, files, AI-assisted commands, games, metrics, and view routing rendered in a single shell.",
    theme: "blue",
    tags: ["terminal", "portfolio", "architecture"],
    logline: "Loaded about page for the terminal application.",
    actions: [
      { label: "README", command: "cat /README.md" },
      { label: "TODO", command: "cat /TODO.md" },
      { label: "CHANGELOG", command: "cat /CHANGELOG.md" },
      { label: "Commands", command: "help" },
      { label: "Tags", command: "tags" },
      { label: "Home", command: "home" },
    ],
    sections: [
      {
        type: "paragraphs",
        heading: "Intent",
        body: [
          "The interface keeps the site minimal: one glass terminal, a command prompt, and content that appears where the command produced it.",
          "The visual layer uses ambient terminal dust (layered particle field), subtle parallax, glass surfaces, and theme-driven accents instead of conventional portfolio sections.",
          "The command registry is intentionally centralized so adding a new view or command does not require rewriting the shell.",
        ],
      },
      {
        type: "metrics",
        heading: "Application surface",
        items: [
          {
            label: "UI",
            value: "Single-shell SPA",
            detail:
              "One terminal window, route-aware navigation, and command-driven rendering.",
          },
          {
            label: "State",
            value: "Session-first",
            detail:
              "Command history, identity, theme, and profile preferences persisted per session.",
          },
          {
            label: "Content",
            value: "Markdown + structured views",
            detail:
              "Resume, projects, posts, and docs rendered as terminal-native output.",
          },
          {
            label: "Cloud",
            value: "Cloudflare Pages + Functions",
            detail:
              "Workers AI + KV + optional D1/R2 for AI context, comments, and content syncing.",
          },
        ],
      },
      {
        type: "note",
        heading: "Architecture",
        lines: [
          "Static portfolio views live in the command registry.",
          "Stateful OS commands, identity/config persistence, and AI context flow through Cloudflare Pages Functions.",
          "Workers AI is used for ask/explain/chat flows; session context (history, reads, profile config) is injected per request.",
          "Posts and comments are exposed through /api/posts, and /comment writes directly into the same post stream.",
          "The root OS files README.md and TODO.md remain the canonical app snapshot and backlog.",
        ],
      },
    ],
  };

  const tagsView: ViewDefinition = {
    id: "tags",
    route: "tags",
    prompt: "search tag",
    eyebrow: "Tags",
    title: "Tag filter and browse",
    description: "Browse all tags and find views by tag.",
    theme: "frost",
    logline: "Loaded tags.",
    sections: [],
  };

  const staticViews = {
    home: homeView,
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
    tags: tagsView,
  } as const;

  const commands: CommandDefinition[] = [];

  const resolveCommandRef = (
    raw: string | undefined,
  ): CommandDefinition | null => {
    const query = raw?.trim().toLowerCase();
    if (!query) return null;
    const normalized = query.replace(/^\//, "");
    return (
      commands.find(
        (command) =>
          command.name.toLowerCase() === normalized ||
          command.aliases.some((alias) => alias.toLowerCase() === normalized),
      ) ?? null
    );
  };

  const getCommandTags = (command: CommandDefinition): string[] => {
    const base =
      command.tags ??
      COMMAND_TAGS[command.name] ??
      fallbackCommandTags(command);
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const tag of base) {
      const normalized = String(tag).trim().toLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      tags.push(normalized);
    }
    return tags.length ? tags : ["terminal", "command"];
  };

  const buildCommandTagIndex = (): Record<string, TagContentItem[]> => {
    const out: Record<string, TagContentItem[]> = {};
    for (const command of commands) {
      const entry: TagContentItem = {
        label: `/${command.name}`,
        type: "command",
        command: command.name,
      };
      for (const tag of getCommandTags(command)) {
        if (!out[tag]) out[tag] = [];
        out[tag]!.push(entry);
      }
    }
    return out;
  };

  const usageParts = (usage: string): string[] => {
    const parts = usage
      .replace(/^\S+/, "")
      .match(/(\[[^\]]+\]|<[^>]+>|--?[A-Za-z0-9][\w-]*(?:=<[^>]+>)?)/g);
    return parts ?? [];
  };

  const describeUsagePart = (part: string): string => {
    const isOptional = part.startsWith("[") && part.endsWith("]");
    const inner = isOptional ? part.slice(1, -1) : part;
    const isFlag = /^--?/.test(inner);
    const isRequiredArg = inner.startsWith("<") && inner.endsWith(">");
    const clean = inner.replace(/^<|>$/g, "");

    if (inner.includes("|")) {
      return `${part}: ${isOptional ? "optional" : "required"} choice. Pick one of ${inner
        .replace(/[<>\[\]]/g, "")
        .split("|")
        .map((token) => token.trim())
        .filter(Boolean)
        .join(", ")}.`;
    }

    if (isFlag) {
      const [, value] = inner.split("=");
      return `${part}: ${isOptional ? "optional" : "accepted"} flag${value ? ` taking ${value.replace(/[<>]/g, "")}` : ""}.`;
    }

    if (isRequiredArg)
      return `${part}: required argument for ${clean.replace(/[-_]/g, " ")}.`;

    return `${part}: ${isOptional ? "optional" : "accepted"} argument for ${clean.replace(/[-_]/g, " ")}.`;
  };

  const buildManView = (command: CommandDefinition): ViewDefinition => {
    const tags = getCommandTags(command);
    const aliases = command.aliases.length
      ? command.aliases.map((alias) => `/${alias}`).join(", ")
      : "none";
    const parameterLines = usageParts(command.usage).map(describeUsagePart);
    const related = commands
      .filter(
        (candidate) =>
          candidate.name !== command.name &&
          (candidate.group === command.group ||
            getCommandTags(candidate).some((tag) => tags.includes(tag))),
      )
      .slice(0, 6)
      .map((candidate) => ({
        label: `/${candidate.name}`,
        command: candidate.name,
      }));

    return {
      id: `man-${command.name}`,
      route: "help",
      prompt: `man ${command.name}`,
      eyebrow: "Manual",
      title: `man ${command.name}`,
      description: command.description,
      note: "Use /help <command> or /commands <command> as shortcuts to this same manual page.",
      theme: "amber",
      tags,
      logline: `Opened manual page for ${command.name}.`,
      actions: [
        { label: "Run command", command: command.name },
        { label: "All commands", command: "commands" },
        { label: "Help index", command: "help" },
      ],
      sections: [
        {
          type: "paragraphs",
          heading: "NAME",
          body: [`${command.name} - ${command.description}`],
        },
        {
          type: "paragraphs",
          heading: "SYNOPSIS",
          body: [`/${command.usage}`],
        },
        {
          type: "paragraphs",
          heading: "DESCRIPTION",
          body: [
            command.description,
            `Command group: ${command.group}.`,
            `Aliases: ${aliases}.`,
          ],
        },
        {
          type: "paragraphs",
          heading: "ARGUMENTS / FLAGS / OPTIONS",
          body:
            parameterLines.length > 0
              ? parameterLines
              : [
                  "No explicit arguments or flags. Run the command exactly as shown in SYNOPSIS.",
                ],
        },
        {
          type: "paragraphs",
          heading: "EXAMPLES",
          body: [
            `/${command.usage}`,
            `/man ${command.name}`,
            `/help ${command.name}`,
            `/commands ${command.name}`,
            `/explain command ${command.name}`,
          ],
        },
        {
          type: "note",
          heading: "TAGS",
          lines: [
            `${tags.map((tag) => `#${tag}`).join(" ")}`,
            "Every command has tags. Click the chips above this page to filter related commands, files, and views.",
          ],
        },
        {
          type: "metrics",
          heading: "RELATED",
          items: related.map((item) => ({
            label: item.label,
            value: "related command",
            detail: "same group or overlapping tags",
            command: `man ${item.command}`,
          })),
        },
      ],
    };
  };

  const buildHelpView = (): ViewDefinition => ({
    id: "help",
    route: "help",
    prompt: "./terminal --help",
    eyebrow: "Registry",
    title: "Help index.",
    description: "Help index for the terminal application.",
    note: "Use the help command to open this page.",
    theme: "amber",
    tags: ["terminal", "tooling", "portfolio"],
    logline: "Loaded command registry and usage guide.",
    actions: [
      { label: "Resume", command: "resume" },
      { label: "Experience", command: "experience" },
      { label: "Themes", command: "themes" },
      { label: "Full command list", command: "commands" },
      { label: "Home", command: "home" },
      { label: "About", command: "about" },
    ],
    sections: [
      {
        type: "command-list",
        heading: "Commands",
        items: [...commands]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map<CommandHelpItem>((command) => ({
            name: command.name,
            usage: command.usage,
            description: command.description,
            command: command.name,
            group: command.group,
            tags: getCommandTags(command),
          })),
      },
      {
        type: "note",
        heading: "Extension path",
        lines: [
          "Static views are defined once and mapped to commands with a small helper.",
          "Custom behavior such as theme switching uses the same command interface and can still emit log messages or full views.",
          "Click any command card to run man <command>; the prompt is prefilled with that command for immediate use.",
        ],
      },
    ],
  });

  const buildThemesView = (currentTheme: ThemeName | null): ViewDefinition => ({
    id: "themes",
    route: "themes",
    prompt: "./terminal --themes",
    eyebrow: "Palette",
    title: "Themes.",
    description: "Available themes for the terminal application.",
    note: currentTheme
      ? `Current manual palette: ${terminalThemes[currentTheme].label}.`
      : "Current palette mode: auto, driven by the active panel.",
    theme: currentTheme ?? "orange",
    tags: ["theme", "terminal"],
    logline: "Loaded palette controls and theme options.",
    actions: [
      { label: "theme red", command: "theme red" },
      { label: "theme orange", command: "theme orange" },
      { label: "theme amber", command: "theme amber" },
      { label: "theme frost", command: "theme frost" },
      { label: "theme ivory", command: "theme ivory" },
      { label: "theme green", command: "theme green" },
      { label: "theme magenta", command: "theme magenta" },
      { label: "theme blue", command: "theme blue" },
      { label: "theme purple", command: "theme purple" },
      { label: "theme sea", command: "theme sea" },
      { label: "theme olive", command: "theme olive" },
      { label: "theme pink", command: "theme pink" },
      { label: "theme auto", command: "theme auto" },
    ],
    sections: [
      {
        type: "metrics",
        heading: "Available palettes",
        items: Object.entries(terminalThemes).map(([key, theme]) => ({
          label: key,
          value: theme.label,
          detail: key === currentTheme ? "currently pinned" : "available",
          command: `theme ${key}`,
        })),
      },
      {
        type: "note",
        heading: "Usage",
        lines: [
          "Use theme red, orange, amber, frost, ivory, green, magenta, blue, or purple to pin the shell.",
          "Use theme auto to let each command view restore its own palette.",
        ],
      },
    ],
  });

  const buildSkillsCategoryView = (): ViewDefinition => ({
    ...skillsView,
    id: "skills-category",
    prompt: "./resume --skills --category",
    title: "Skills grouped by category and depth.",
    description:
      "Category mode keeps the resume skill list grouped exactly by language, web, cloud, database, AI, and tooling areas.",
    logline: "Loaded skills category breakdown.",
  });

  const buildSkillsApplicationsView = (): ViewDefinition => ({
    id: "skills-applications",
    route: "skills",
    prompt: "./resume --skills --applications",
    eyebrow: "Applied stack",
    title: "Skills organized by how they get used.",
    description:
      "Application mode maps skills onto the kinds of systems they support: cloud delivery, APIs, runtime work, observability, and AI-assisted workflows.",
    theme: "magenta",
    logline: "Loaded skills applications breakdown.",
    actions: [
      { label: "skills --category", command: "skills --category" },
      { label: "Projects", command: "projects" },
      { label: "Experience", command: "experience" },
    ],
    sections: [
      {
        type: "tag-groups",
        heading: "Applications",
        groups: [
          {
            title: "Cloud delivery",
            items: [
              "AWS",
              "Azure",
              "GCP",
              "OCI",
              "Terraform",
              "Ansible",
              "Kubernetes",
              "AWS CDK",
            ],
            note: "Infrastructure, deployment, orchestration, and repeatable cloud architecture.",
          },
          {
            title: "Application surfaces",
            items: [
              "TypeScript",
              "React",
              "Next.js",
              "FastAPI",
              "Django",
              "Node.js",
              "GraphQL",
              "REST",
            ],
            note: "Interfaces and APIs connected directly to operational systems.",
          },
          {
            title: "Runtime and distributed systems",
            items: [
              "Go",
              "Rust",
              "Zig",
              "WebAssembly",
              "gRPC",
              "Protocol Buffers",
              "SQL",
            ],
            note: "Lower-level execution, serialization, transaction systems, and networked services.",
          },
          {
            title: "Observability and reliability",
            items: [
              "Grafana",
              "Prometheus",
              "PromQL",
              "GitHub Actions",
              "Jenkins",
              "Docker",
              "GitOps",
            ],
            note: "Delivery feedback, production visibility, and operational hardening.",
          },
          {
            title: "AI-assisted workflows",
            items: [
              "Cloudflare Workers AI",
              "OpenAI API",
              "Anthropic API",
              "LangChain",
              "LangGraph",
              "Codex",
            ],
            note: "Agentic tooling, AI APIs, and coding-assistant workflows.",
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
      fullPageView?: boolean;
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
      fullPageView: config.fullPageView ?? true,
      description: config.description ?? view.description,
      execute(_context, args) {
        if (
          name === "skills" &&
          (args.includes("--category") || args.includes("--categories"))
        )
          return { kind: "view", view: buildSkillsCategoryView() };
        if (name === "skills" && args.includes("--applications"))
          return { kind: "view", view: buildSkillsApplicationsView() };
        return { kind: "view", view };
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
        return { kind: "os", command: raw };
      },
    });
  };

  // Add a new command here and either point it at a view or return a custom outcome.
  addViewCommand("about", {
    aliases: ["site"],
    usage: "about",
    group: "Core",
    featured: true,
    description: "Explain the terminal app, design, and architecture.",
  });

  addViewCommand("home", {
    aliases: ["start", "landing", "root", "welcome"],
    usage: "home",
    group: "Core",
    description: "Return to the compact terminal landing screen.",
  });

  addViewCommand("resume", {
    aliases: [],
    usage: "resume",
    group: "Core",
    featured: true,
    description: "Load the resume-backed landing view.",
  });

  commands.push({
    name: "experience",
    aliases: ["experiences", "work"],
    usage: "experience [slug]",
    group: "Core",
    featured: true,
    description:
      "Show the work timeline. Pass a slug to open a role detail view.",
    execute(_context, args): CommandOutcome {
      const slug = String(args[0] ?? "")
        .trim()
        .toLowerCase();
      if (!slug) return { kind: "view", view: staticViews["experience"] };
      const view = experienceDetailViews[slug];
      if (!view)
        return {
          kind: "system",
          text: `Unknown role "${slug}". Try experience for the full list.`,
          tone: "warn",
        };
      return { kind: "view", view };
    },
  });

  addViewCommand("timeline", {
    aliases: ["chronology"],
    usage: "timeline",
    group: "Core",
    featured: true,
    description: "Show a combined timeline of work, projects, and education.",
  });

  addViewCommand("skills", {
    aliases: ["stack", "tools", "skill"],
    usage: "skills [--category|--applications]",
    group: "Core",
    featured: true,
    description:
      "List skill groups across languages, cloud, and observability.",
  });

  addViewCommand("projects", {
    aliases: ["builds"],
    usage: "projects",
    group: "Deep dive",
    featured: true,
    description: "Open the independent project panel.",
  });

  addViewCommand("posts", {
    aliases: ["writing", "blog"],
    usage: "posts",
    group: "Core",
    featured: true,
    description: "List chronological posts and expose the RSS feed.",
  });

  addViewCommand("links", {
    aliases: ["linktree", "link"],
    usage: "links",
    group: "Core",
    featured: true,
    description: "Open source-control, contact, project, and resume links.",
  });

  addViewCommand("education", {
    aliases: ["school"],
    usage: "education",
    group: "Deep dive",
    description: "Show education background and coursework context.",
  });

  addViewCommand("contact", {
    aliases: ["hire"],
    usage: "contact",
    group: "Core",
    featured: true,
    description: "Open direct contact channels and hiring context.",
  });

  addViewCommand("pdf", {
    aliases: ["cv", "resume-pdf"],
    usage: "pdf",
    group: "Documents",
    featured: true,
    description: "Embed the exact PDF resume in the terminal shell.",
  });

  commands.unshift({
    name: "help",
    aliases: [],
    usage: "help [command]",
    group: "Utility",
    route: "help",
    fullPageView: true,
    description: "Inspect the command registry and extension pattern.",
    execute(_context, args) {
      const ref = resolveCommandRef(args[0]);
      if (args[0] && ref) return { kind: "view", view: buildManView(ref) };
      if (args[0] && !ref)
        return {
          kind: "system",
          text: `No manual entry for "${args[0]}". Try commands for the full index.`,
          tone: "warn",
        };
      return { kind: "view", view: buildHelpView() };
    },
  });

  commands.push({
    name: "commands",
    aliases: ["command-list", "command"],
    usage: "commands [command]",
    group: "Utility",
    route: "help",
    featured: true,
    fullPageView: true,
    description:
      "Open the full command list with descriptions and man-page shortcuts.",
    execute(_context, args) {
      const ref = resolveCommandRef(args[0]);
      if (args[0] && ref) return { kind: "view", view: buildManView(ref) };
      if (args[0] && !ref)
        return {
          kind: "system",
          text: `No manual entry for "${args[0]}". Try commands for the full index.`,
          tone: "warn",
        };
      return { kind: "view", view: buildHelpView() };
    },
  });

  commands.push({
    name: "themes",
    aliases: ["palette", "palettes"],
    usage: "Get themes selection view",
    group: "Utility",
    route: "themes",
    fullPageView: true,
    description: "Preview the available shell palettes.",
    execute(context) {
      return { kind: "view", view: buildThemesView(context.getTheme()) };
    },
  });

  commands.push({
    name: "theme",
    aliases: ["color", "colors", "colorscheme"],
    usage: "theme [set <name>|list|random|auto|<palette name>]",
    group: "Utility",
    description:
      "Set, list, or randomize the shell palette. Also accepts direct theme names.",
    execute(context, args): CommandOutcome {
      const sub = args[0]?.toLowerCase();

      if (!sub)
        return {
          kind: "system",
          text: "Usage: theme <set <name>|list|random|auto|--dark|--light|palette>. Try theme list.",
          tone: "warn",
        };

      if (sub === "--dark" || sub === "dark") {
        context.setDarkMode(true);
        return { kind: "system", text: "Dark mode enabled.", tone: "success" };
      }

      if (sub === "--light" || sub === "light") {
        context.setDarkMode(false);
        return { kind: "system", text: "Light mode enabled.", tone: "success" };
      }

      /* theme list */
      if (sub === "list") {
        const entries = Object.entries(terminalThemes);
        const current = context.getTheme();
        const lines = entries.map(
          ([key, theme]) =>
            `${key === current ? "* " : "  "}${key.padEnd(10)} ${theme.label}`,
        );
        return { kind: "system", text: lines.join("\n"), tone: "info" };
      }

      /* theme random */
      if (sub === "random") {
        const keys = Object.keys(terminalThemes);
        const pick = keys[Math.floor(Math.random() * keys.length)] as ThemeName;
        context.setTheme(pick);
        return {
          kind: "system",
          text: `Random palette: ${terminalThemes[pick].label}.`,
          tone: "success",
        };
      }

      const next = (sub === "set" ? args[1]?.toLowerCase() : sub) as
        | ThemeName
        | "auto"
        | "view"
        | undefined;

      if (!next)
        return {
          kind: "system",
          text: "Usage: theme set <name>",
          tone: "warn",
        };

      if (next === "auto" || next === "view") {
        context.setTheme(null);
        return {
          kind: "system",
          text: "Palette override cleared. Active views now control the shell accent.",
          tone: "success",
        };
      }

      if (!(next in terminalThemes))
        return {
          kind: "system",
          text: `Unknown palette "${next}". Try theme list for the supported set.`,
          tone: "warn",
        };

      context.setTheme(next);
      return {
        kind: "system",
        text: `Pinned palette: ${terminalThemes[next].label}.`,
        tone: "success",
      };
    },
  });

  commands.push({
    name: "project",
    aliases: ["proj"],
    usage: "project <slug>",
    group: "Core",
    description: "Open a dedicated project page by slug.",
    execute(_context, args): CommandOutcome {
      const slug = String(args[0] ?? "")
        .trim()
        .toLowerCase();
      if (!slug)
        return {
          kind: "system",
          text: "Usage: project <slug>. Try projects for the list.",
          tone: "warn",
        };
      const view = projectDetailViews[slug];
      if (!view)
        return {
          kind: "system",
          text: `Unknown project "${slug}". Try projects for available slugs.`,
          tone: "warn",
        };
      return { kind: "view", view };
    },
  });

  commands.push({
    name: "download",
    aliases: ["dl"],
    usage: "download [--markdown]",
    group: "Documents",
    featured: true,
    description: "Download the resume PDF or Markdown version.",
    execute(_context, args): CommandOutcome {
      return {
        kind: "download",
        format:
          args.includes("--markdown") || args.includes("-m")
            ? "markdown"
            : "pdf",
        text:
          args.includes("--markdown") || args.includes("-m")
            ? "Downloading resume markdown."
            : "Downloading resume PDF.",
        tone: "success",
      };
    },
  });

  commands.push({
    name: "shutdown",
    aliases: ["poweroff"],
    usage: "shutdown",
    group: "Window",
    description: "Close the terminal window visually.",
    execute(): CommandOutcome {
      return {
        kind: "window",
        action: "shutdown",
        text: "Terminal shutdown requested.",
        tone: "warn",
      };
    },
  });

  commands.push({
    name: "maximize",
    aliases: ["zoom", "fullscreen", "max"],
    usage: "maximize (zoom alone) · zoom in | zoom out | zoom reset",
    group: "Window",
    description:
      "Toggle the terminal between default and maximized size. Use zoom in, zoom out, or zoom reset to change text size.",
    execute(): CommandOutcome {
      return {
        kind: "window",
        action: "maximize",
        text: "Window maximize toggled.",
        tone: "info",
      };
    },
  });

  commands.push({
    name: "minimize",
    aliases: ["hide", "min"],
    usage: "minimize",
    group: "Window",
    description: "Minimize the terminal to the bottom dock icon.",
    execute(): CommandOutcome {
      return {
        kind: "window",
        action: "minimize",
        text: "Window minimized.",
        tone: "info",
      };
    },
  });

  commands.push({
    name: "chat",
    aliases: ["ai", "agent"],
    usage: "chat",
    group: "AI",
    route: "chat",
    featured: true,
    description:
      "Enter an AI chat session about Chris, his work history, and his projects. Use /model and /context to change the Workers AI model or system prompt injection without leaving chat.",
    execute() {
      return {
        kind: "chat",
        text: "Chat mode active. Ask about Chris, his work history, or projects. Use /model and /context for Workers AI settings; /exit to leave.",
        tone: "success",
      };
    },
  });

  commands.push({
    name: "model",
    aliases: [],
    usage: "model [<workers-ai-model-id>]",
    group: "AI",
    description:
      "Set or show the Workers AI model for chat, ask, explain, and OS AI calls (same as session identity). In chat, prefix with a slash: /model @cf/…",
    execute(context, args) {
      if (!args.length) {
        return {
          kind: "system",
          text: `Current model: ${context.getAiModel()}`,
          tone: "info",
        };
      }
      const id = args.join(" ").trim();
      if (!context.setAiModel(id)) {
        return {
          kind: "system",
          text: "Invalid Workers AI model id. Use an id such as @cf/meta/llama-3.1-8b-instruct (tab-complete after model).",
          tone: "warn",
        };
      }
      return {
        kind: "system",
        text: `Model set to ${id}.`,
        tone: "success",
      };
    },
  });

  commands.push({
    name: "context",
    aliases: [],
    usage: "context [clear | <system-prompt-text>]",
    group: "AI",
    description:
      "Set or show the optional system prompt injected into AI calls (same textarea as session identity). In chat, use /context …. Run context clear to reset.",
    execute(context, args) {
      if (!args.length) {
        const cur = context.getSystemPrompt();
        if (!cur)
          return {
            kind: "system",
            text: "No system prompt injection is set.",
            tone: "info",
          };
        return {
          kind: "system",
          text: `Current injection (${cur.length} chars):\n${cur}`,
          tone: "info",
        };
      }
      if (args.length === 1 && args[0]!.toLowerCase() === "clear") {
        context.setSystemPrompt("");
        return {
          kind: "system",
          text: "System prompt injection cleared.",
          tone: "success",
        };
      }
      const text = args.join(" ").trim().slice(0, 1200);
      context.setSystemPrompt(text);
      return {
        kind: "system",
        text: `System prompt injection updated (${text.length} chars).`,
        tone: "success",
      };
    },
  });

  commands.push({
    name: "post",
    aliases: ["article"],
    usage: "post open <slug|path-fragment>",
    group: "Core",
    featured: true,
    fullPageView: true,
    description:
      "Render a full markdown post from the published /api/posts index.",
    async execute(_context, args) {
      const sub = (args[0] || "").toLowerCase();
      if (sub !== "open" && sub !== "view")
        return {
          kind: "system",
          text: "Usage: post open <slug|path-fragment>",
          tone: "warn",
        };
      const query = args.slice(1).join(" ").trim();
      if (!query)
        return {
          kind: "system",
          text: "Usage: post open <slug>",
          tone: "warn",
        };
      try {
        const res = await fetch(`${API_BASE}/api/posts`);
        const payload = (await res.json()) as {
          posts?: Array<{
            slug: string;
            path: string;
            title: string;
            markdown: string;
            description?: string;
            published?: string;
            updated?: string;
            tags?: string[];
            comments?: Array<{
              id: number;
              name: string;
              message: string;
              at: string;
              replies?: Array<{
                id: number;
                name: string;
                message: string;
                at: string;
              }>;
            }>;
          }>;
        };
        const list = payload.posts ?? [];
        const q = query.toLowerCase();
        let post = list.find((p) => p.slug.toLowerCase() === q);
        if (!post)
          post = list.find(
            (p) =>
              p.path.toLowerCase() === q ||
              p.path.toLowerCase().endsWith(`/${q}`) ||
              p.path.toLowerCase().endsWith(`/${q}.md`),
          );
        if (!post)
          post = list.find(
            (p) =>
              p.slug.toLowerCase().includes(q) ||
              p.path.toLowerCase().includes(q),
          );
        if (!post)
          return {
            kind: "system",
            text: `No post matching "${query}". Run posts for the index.`,
            tone: "warn",
          };
        void fetch(`${API_BASE}/api/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "view", path: post.path }),
        }).catch(() => null);
        const comments = post.comments ?? [];
        const totalComments = comments.reduce(
          (total, entry) => total + 1 + (entry.replies?.length ?? 0),
          0,
        );
        const commentHeading = `${totalComments} ${totalComments === 1 ? "comment" : "comments"}`;
        const commentsHtml = comments.length
          ? comments
              .map((entry) => {
                const at = entry.at ? new Date(entry.at).toLocaleString() : "";
                const replies = entry.replies ?? [];
                const repliesHtml = replies.length
                  ? `<div class="post-reply-list">
                      ${replies
                        .map((reply) => {
                          const replyAt = reply.at
                            ? new Date(reply.at).toLocaleString()
                            : "";
                          return `<article class="post-reply-item">
                            <p class="post-comment-meta"><strong>${escapeHtml(reply.name || "anonymous")}</strong>${replyAt ? ` <span>${escapeHtml(replyAt)}</span>` : ""}</p>
                            <p class="post-comment-body">${escapeHtml(reply.message || "")}</p>
                          </article>`;
                        })
                        .join("")}
                    </div>`
                  : "";
                return `<article class="post-comment-item">
                  <div class="post-comment-head">
                    <p class="post-comment-meta"><strong>${escapeHtml(entry.name || "anonymous")}</strong>${at ? ` <span>${escapeHtml(at)}</span>` : ""}</p>
                    <button type="button" class="inline-link post-comment-reply-link" data-prepopulate-command="reply ${entry.id} ">reply</button>
                  </div>
                  <p class="post-comment-body">${escapeHtml(entry.message || "")}</p>
                  ${repliesHtml}
                </article>`;
              })
              .join("")
          : '<p class="post-comment-empty">No comments yet.</p>';
        const articleHtml = renderPostMarkdownToHtml(post.markdown);
        const postIndex = list.findIndex((entry) => entry.path === post.path);
        const previousPost = postIndex > 0 ? list[postIndex - 1] : undefined;
        const nextPost = postIndex >= 0 ? list[postIndex + 1] : undefined;
        const previousButton = previousPost
          ? `<button type="button" class="inline-link post-previous-link" data-command="post open ${escapeHtml(previousPost.slug)}">&lt;- previous</button>`
          : '<span aria-hidden="true"></span>';
        const nextButton = nextPost
          ? `<button type="button" class="inline-link post-next-link" data-command="post open ${escapeHtml(nextPost.slug)}">next -&gt;</button>`
          : '<span aria-hidden="true"></span>';
        const html = `<article class="post-article-shell">
          <div class="post-article-nav">
            <button type="button" class="inline-link" data-command="posts">← back to posts</button>
            ${previousButton}
            ${nextButton}
          </div>
          <div class="post-article-divider" aria-hidden="true"></div>
          <section class="post-article-body markdown-body">${articleHtml}</section>
          <section class="post-comment-section">
            <div class="post-comment-section-head">
              <h3 class="output-heading">${escapeHtml(commentHeading)}</h3>
              <button type="button" class="post-comments-action" data-prepopulate-command="comment ${escapeHtml(post.slug)} ">comment</button>
            </div>
            <p class="post-comment-command">comment <code>${escapeHtml(post.slug)}</code> &lt;name&gt; &lt;message&gt;</p>
            ${commentsHtml}
          </section>
        </article>`;
        return {
          kind: "markdown-view",
          title: post.title,
          html,
          text: post.markdown,
          tone: "success",
        };
      } catch {
        return {
          kind: "system",
          text: "Could not load /api/posts.",
          tone: "warn",
        };
      }
    },
  });

  addOsCommand("ask", {
    usage: "ask <question>",
    group: "AI",
    featured: true,
    description: "Ask Workers AI a question with terminal OS context.",
  });

  addOsCommand("explain", {
    usage: "explain <project|skill|work|education|command|last> [name]",
    aliases: ["why"],
    group: "AI",
    featured: true,
    description:
      'Explain projects, skills, work, education, or commands using Workers AI. Use "explain last" to explain the previous command.',
  });

  addOsCommand("email", {
    aliases: ["mail"],
    usage: "email <your email> <subject> <message>",
    group: "Contact",
    description: "Prepare an email to Chris with structured arguments.",
  });

  addOsCommand("book", {
    usage: "book <your email> <date> <time> <duration> <message>",
    aliases: ["schedule"],
    group: "Contact",
    description:
      "Request a meeting slot and notify both parties through the edge worker.",
  });

  addOsCommand("ls", {
    aliases: ["dir"],
    usage: "ls [path]",
    group: "OS",
    featured: false,
    description: "List files in the portfolio OS.",
  });

  addOsCommand("cat", {
    usage: "cat [--pretty] <path>",
    group: "OS",
    featured: false,
    description:
      "Read a file from the portfolio OS. Use --pretty for formatted output.",
  });

  commands.push({
    name: "man",
    aliases: [],
    usage: "man [command]",
    group: "OS",
    featured: false,
    description:
      "Open command manual pages with sections, tags, and related commands.",
    execute(_context, args) {
      const ref = resolveCommandRef(args[0]);
      if (args[0] && ref) return { kind: "view", view: buildManView(ref) };
      if (args[0] && !ref)
        return {
          kind: "system",
          text: `No manual entry for "${args[0]}". Try commands for the full index.`,
          tone: "warn",
        };
      return { kind: "view", view: buildHelpView() };
    },
  });

  addOsCommand("whoami", {
    usage: "whoami",
    group: "OS",
    description: "Print the current portfolio identity.",
  });

  addOsCommand("history", {
    usage: "history",
    group: "OS",
    description: "Show persisted command history for this terminal session.",
  });

  addOsCommand("ps", {
    usage: "ps",
    group: "OS",
    description: "List pseudo processes running in the terminal OS.",
  });

  addOsCommand("top", {
    usage: "top",
    group: "OS",
    description: "Show pseudo live resource usage for the terminal OS.",
  });

  addOsCommand("pwd", {
    usage: "pwd",
    group: "OS",
    description: "Print the current working directory.",
  });

  addOsCommand("echo", {
    aliases: ["print"],
    usage: "echo <text>",
    group: "OS",
    description: "Print arguments back to the terminal.",
  });

  addOsCommand("cp", {
    usage: "cp <text>",
    group: "OS",
    description: "Copy text to the local clipboard and echo what was copied.",
  });

  addOsCommand("tree", {
    usage: "tree [path]",
    group: "OS",
    description: "Print a tree view of the portfolio OS.",
  });

  addOsCommand("find", {
    usage: "find <query>",
    group: "OS",
    description: "Find files and directories in the portfolio OS.",
  });

  addOsCommand("grep", {
    usage: "grep <query>",
    group: "OS",
    description: "Search readable OS files for matching text.",
  });

  addOsCommand("touch", {
    usage: "touch <path>",
    group: "OS",
    description: "Create an empty file in writable areas of the portfolio OS.",
  });

  addOsCommand("rm", {
    usage: "rm <path>",
    group: "OS",
    description: "Remove a writable file; protected areas require sudo.",
  });

  addOsCommand("sudo", {
    usage: "sudo <command>",
    group: "OS",
    description:
      "Run a protected filesystem command after password authentication.",
  });

  addOsCommand("su", {
    usage: "su",
    group: "OS",
    description:
      "Start a short-lived root session after password authentication.",
  });

  addOsCommand("comment", {
    usage: "comment <post> <name> <message>",
    group: "OS",
    description: "Add a viewer comment to a markdown post.",
  });

  addOsCommand("reply", {
    usage: "reply <comment-id> <message>",
    group: "OS",
    description: "Reply to an existing comment on a markdown post.",
  });

  addOsCommand("new", {
    usage: "new <type> [--title=<t>] [--tags=<a,b>] [args...]",
    group: "OS",
    description:
      "Create new data type instances (post, workflow, step, trigger, job, hook, tool, skill).",
  });

  addOsCommand("workflow", {
    usage: "workflow <list|get|create|update|delete|run> [id] [args...]",
    group: "OS",
    description: "Manage customizable AI workflows.",
  });

  addOsCommand("step", {
    usage: "step <list|get|create|update|delete> [id] [args...]",
    group: "OS",
    description: "Manage reusable workflow steps.",
  });

  addOsCommand("trigger", {
    usage: "trigger <list|get|create|update|delete> [id] [args...]",
    group: "OS",
    description: "Manage event-driven triggers.",
  });

  addOsCommand("job", {
    usage: "job <list|get|create|update|delete|run> [id] [args...]",
    group: "OS",
    description: "Manage scheduled jobs (cron).",
  });

  addOsCommand("hook", {
    usage: "hook <list|get|create|update|delete> [id] [args...]",
    group: "OS",
    description: "Manage lifecycle hooks.",
  });

  addOsCommand("tool", {
    usage: "tool <list|get|create|update|delete> [id] [args...]",
    group: "OS",
    description: "Manage tool definitions.",
  });

  addOsCommand("skill", {
    usage: "skill <list|get|create|update|delete> [id] [args...]",
    group: "OS",
    description: "Manage skill definitions.",
  });

  addOsCommand("list", {
    usage: "list <type> [--tags=<a,b>] [--limit=<n>]",
    group: "OS",
    description: "List and browse data type instances.",
  });

  addOsCommand("sync", {
    usage: "sync",
    group: "OS",
    description:
      "Sync /posts and /public/posts content to D1 and R2 (sudo required by default).",
  });

  addOsCommand("upload", {
    usage: "upload image <post> <https://image-url> [alt text]",
    group: "OS",
    description:
      "Upload a remote image into /public/posts and append it to the post markdown.",
  });

  addOsCommand("date", {
    usage: "date",
    group: "OS",
    description: "Print current edge time.",
  });

  addOsCommand("dark", {
    usage: "dark",
    group: "Utility",
    description: "Enable dark mode and persist it to shell config.",
  });

  addOsCommand("light", {
    usage: "light",
    group: "Utility",
    description: "Enable light mode and persist it to shell config.",
  });

  addOsCommand("source", {
    usage: "source <path>",
    group: "OS",
    description: "Read shell commands from a file and run them in order.",
  });

  addOsCommand("rag", {
    usage: "rag <add|list|clear> [context]",
    group: "AI",
    description:
      "Persist session context notes that are injected into ask, explain, chat, and agentic AI calls.",
  });

  addOsCommand("uptime", {
    usage: "uptime",
    group: "System",
    description:
      "Show current time, uptime duration, users, and load averages.",
  });

  addOsCommand("last", {
    usage: "last [n]",
    group: "System",
    description: "Show recent command activity in a login-style list.",
  });

  addOsCommand("curl", {
    usage: "curl <url>",
    group: "Network",
    description:
      "Fetch a URL from the Cloudflare edge and print a short response.",
  });

  addOsCommand("ping", {
    usage: "ping <host>",
    group: "Network",
    description: "Measure HTTP reachability from the Cloudflare edge.",
  });

  addOsCommand("traceroute", {
    usage: "traceroute <host>",
    group: "Network",
    description: "Show a hop-by-hop path view similar to bash traceroute.",
  });

  addOsCommand("whois", {
    usage: "whois <site>",
    group: "Network",
    description: "Show DNS/RDAP ownership metadata for a domain.",
  });

  addOsCommand("weather", {
    usage: "weather [location]",
    group: "Network",
    description: "Show current weather; defaults to Seattle, WA.",
  });

  addOsCommand("stock", {
    usage: "stock <ticker>",
    group: "Network",
    description: "Show a compact market quote for a ticker.",
  });

  addOsCommand("trace", {
    usage: "trace <website>",
    group: "Network",
    description:
      "Show a stylized route from the browser through Cloudflare to a site.",
  });

  addOsCommand("doctor", {
    usage: "doctor",
    group: "System",
    description: "Run diagnostics for bindings, DNS, and network reachability.",
  });

  addOsCommand("metrics", {
    usage: "metrics",
    group: "System",
    description:
      "Show visits, page hits, command counts, and geographic breakdowns from KV.",
  });

  addOsCommand("leaderboard", {
    usage: "leaderboard [game]",
    group: "Games",
    description: "Show high scores for 2048, chess, minesweeper, and jobquest.",
  });

  addOsCommand("internet", {
    usage: "internet [site]",
    group: "Network",
    description:
      "Open a tiny fake text-web browser with navigable terminal sites.",
  });

  addOsCommand("fzf", {
    usage: "fzf [query]",
    group: "OS",
    description: "Fuzzy-find commands, files, projects, and views.",
  });

  addOsCommand("logs", {
    aliases: ["log"],
    usage: "logs [--full]",
    group: "System",
    description:
      "Show system log entries. Use sudo logs --full for the complete log.",
  });

  addOsCommand("tail", {
    usage: "tail [-n N] <path>",
    group: "OS",
    featured: false,
    description: "Print the last N lines of a file (default 10).",
  });

  addOsCommand("less", {
    usage: "less <path>",
    group: "OS",
    featured: false,
    description: "View a file in the portfolio OS with scrollback.",
  });

  addOsCommand("mkdir", {
    usage: "mkdir <path>",
    group: "OS",
    featured: false,
    description: "Create a directory in writable areas of the portfolio OS.",
  });

  addOsCommand("cd", {
    usage: "cd [path]",
    group: "OS",
    featured: false,
    description: "Change the current working directory in the portfolio OS.",
  });

  addOsCommand("mv", {
    usage: "mv <source> <destination>",
    group: "OS",
    featured: false,
    description: "Move or rename a file in writable areas of the portfolio OS.",
  });

  addOsCommand("ln", {
    usage: "ln <source> <destination>",
    group: "OS",
    featured: false,
    description: "Create a link entry in writable areas of the portfolio OS.",
  });

  addOsCommand("head", {
    usage: "head [-n N] <path>",
    group: "OS",
    featured: false,
    description: "Print the first N lines of a file (default 10).",
  });

  addOsCommand("export", {
    usage: "export KEY=VALUE",
    group: "OS",
    featured: false,
    description: "Set a shell environment variable for this session.",
  });

  commands.push({
    name: "clpsh",
    aliases: ["/bin/clpsh", "sh"],
    usage: "clpsh",
    group: "OS",
    description: "Start a new portfolio OS shell process.",
    execute() {
      return {
        kind: "system",
        text: "clpsh: portfolio OS shell session active",
        tone: "success",
      };
    },
  });

  commands.push({
    name: "debug",
    aliases: ["dbg"],
    usage: "debug [on|off]",
    group: "System",
    description: "Toggle debug logging on or off. Default is on.",
    execute(_context, args) {
      const action = args[0]?.toLowerCase();
      const state = action === "off" ? false : true;
      return {
        kind: "system",
        text: `Debug logging ${state ? "enabled" : "disabled"}.`,
        tone: "info",
      };
    },
  });

  commands.push({
    name: "split",
    aliases: ["splith", "hsplit"],
    usage: "split",
    group: "Window",
    description:
      "Split the terminal horizontally, adding a new clpsh instance.",
    execute() {
      return {
        kind: "system",
        text: "Split created below. Use /move to navigate between panes.",
        tone: "success",
      };
    },
  });

  commands.push({
    name: "vsplit",
    aliases: ["splitv", "vertical"],
    usage: "vsplit",
    group: "Window",
    description: "Split the terminal vertically, adding a new clpsh instance.",
    execute() {
      return {
        kind: "system",
        text: "Vertical split created. Use /move to navigate between panes.",
        tone: "success",
      };
    },
  });

  commands.push({
    name: "new",
    aliases: ["create"],
    usage:
      "new [split|tab|window|post] [--title <title>] [--body <text>] [--tags <t1,t2>]",
    group: "Window",
    description:
      "Create a new split, tab, window, or post. Use `new post --title ... --body ...` to draft a post via the API.",
    async execute(_context, args) {
      const target = args[0]?.toLowerCase();
      if (target === "split") {
        return {
          kind: "system",
          text: "Split created below. Use /move to navigate.",
          tone: "success",
        };
      }
      if (target === "window") {
        return { kind: "system", text: "New window opened.", tone: "success" };
      }
      if (target === "post") {
        const titleIdx = args.indexOf("--title");
        const bodyIdx = args.indexOf("--body");
        const tagsIdx = args.indexOf("--tags");
        const title =
          titleIdx >= 0
            ? args
                .slice(titleIdx + 1, bodyIdx > titleIdx ? bodyIdx : undefined)
                .join(" ")
                .replace(/^--\S+.*/, "")
            : "";
        const body =
          bodyIdx >= 0
            ? args
                .slice(bodyIdx + 1)
                .filter((a, i, arr) => {
                  // stop at next flag
                  if (i > 0 && String(arr[i - 1]).startsWith("--")) return true;
                  return !a.startsWith("--");
                })
                .join(" ")
            : "";
        const tags =
          tagsIdx >= 0
            ? String(args[tagsIdx + 1] || "")
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : [];
        if (!title && !body) {
          return {
            kind: "system",
            tone: "info",
            text: "Usage: new post --title <title> --body <body text> [--tags tag1,tag2]",
          };
        }
        try {
          const slug =
            title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "") || `post-${Date.now().toString(36)}`;
          const res = await fetch(`${API_BASE}/api/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create",
              slug,
              title,
              markdown: body,
              tags,
            }),
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            return {
              kind: "system",
              tone: "warn",
              text: `Post creation failed: ${err?.error ?? res.statusText}`,
            };
          }
          return {
            kind: "system",
            tone: "success",
            text: `Post '${slug}' created. View it with: post open ${slug}`,
          };
        } catch (err) {
          return {
            kind: "system",
            tone: "warn",
            text: `Error: ${(err as Error).message}`,
          };
        }
      }
      return {
        kind: "system",
        text: "New tab created. Use /tab to manage tabs.",
        tone: "success",
      };
    },
  });

  commands.push({
    name: "close",
    aliases: [],
    usage: "close [split|tab]",
    group: "Window",
    description: "Close the current split pane or tab. Defaults to close tab.",
    execute(_context, args) {
      const target = args[0]?.toLowerCase();
      if (target === "split")
        return { kind: "system", text: "Split pane closed.", tone: "info" };
      return { kind: "system", text: "Tab closed.", tone: "info" };
    },
  });

  commands.push({
    name: "move",
    aliases: ["switch"],
    usage: "move <up|left|right|down>",
    group: "Window",
    description: "Move focus to an adjacent split pane.",
    execute(_context, args) {
      const direction = args[0]?.toLowerCase();
      if (!direction || !["up", "left", "right", "down"].includes(direction))
        return {
          kind: "system",
          text: "Usage: move <up|left|right|down>",
          tone: "warn",
        };
      return {
        kind: "system",
        text: `Focus moved ${direction}.`,
        tone: "success",
      };
    },
  });

  commands.push({
    name: "tab",
    aliases: ["tabs"],
    usage: "tab <close|new|next|previous>",
    group: "Window",
    description: "Manage terminal tabs.",
    execute(_context, args) {
      const action = args[0]?.toLowerCase();
      if (!action || !["close", "new", "next", "previous"].includes(action))
        return {
          kind: "system",
          text: "Usage: tab <close|new|next|previous>",
          tone: "warn",
        };
      return { kind: "system", text: `Tab ${action}.`, tone: "success" };
    },
  });

  commands.push({
    name: "2048",
    aliases: ["/bin/2048"],
    usage: "2048",
    group: "Games",
    featured: true,
    description: "Boot a text-mode 2048 game in the terminal.",
    execute() {
      return {
        kind: "game",
        game: "2048",
        text: "2048 booted. Use w/a/s/d to move, n for a new board, q to quit.",
        tone: "success",
      };
    },
  });

  commands.push({
    name: "chess",
    aliases: ["/bin/chess"],
    usage: "chess",
    group: "Games",
    featured: true,
    description: "Boot a lightweight text-mode chess board.",
    execute() {
      return {
        kind: "game",
        game: "chess",
        text: "Chess booted. Enter moves like e2e4, n for a new board, q to quit.",
        tone: "success",
      };
    },
  });

  commands.push({
    name: "minesweeper",
    aliases: ["mines", "/bin/minesweeper"],
    usage: "minesweeper",
    group: "Games",
    featured: true,
    description: "Boot a text-mode minesweeper board.",
    execute() {
      return {
        kind: "game",
        game: "minesweeper",
        text: "Minesweeper booted. Use open A1, flag B2, n for new, q to quit.",
        tone: "success",
      };
    },
  });

  commands.push({
    name: "jobquest",
    aliases: ["signalhunt", "/bin/jobquest"],
    usage: "jobquest",
    group: "Games",
    featured: true,
    description:
      "Text adventure: hunt for signal in a very relatable job search.",
    execute() {
      return {
        kind: "game",
        game: "jobquest",
        text: "Signal Hunt booted. Type 1–9 or a choice keyword; help to re-read the scene; n new; q quit.",
        tone: "success",
      };
    },
  });

  commands.push({
    name: "exit",
    aliases: ["quit"],
    usage: "exit",
    group: "AI",
    description: "Exit the AI chat session and return to terminal commands.",
    execute() {
      return {
        kind: "exit",
        text: "Chat mode closed.",
        tone: "info",
      };
    },
  });

  commands.push({
    name: "clear",
    aliases: ["reset"],
    usage: "clear",
    group: "Utility",
    description: "Clear the terminal window completely.",
    execute() {
      return {
        kind: "clear",
      };
    },
  });

  // ── New commands ──
  addOsCommand("session", {
    usage: "session",
    group: "System",
    description:
      "Show current session info, history stats, metrics, and whoami.",
  });

  addOsCommand("dig", {
    usage: "dig <hostname>",
    group: "Network",
    description:
      "DNS lookup utility — shows A records with mock authoritative results.",
  });

  addOsCommand("config", {
    usage: "config <set|get|list|reset> [key] [value]",
    group: "System",
    description:
      "Manage user config: theme, syntax_scheme, font_size, font, dark, crt, name, environment, email, ai_model, ai_tools, system_prompt.",
  });

  addOsCommand("note", {
    usage: "note <add|list|clear> [text]",
    aliases: ["notes"],
    group: "OS",
    description: "Track session notes. Add, list, or clear notes.",
  });

  addOsCommand("alias", {
    usage: "alias [name] [value]",
    group: "OS",
    description: "Define or show command aliases.",
  });

  addOsCommand("unalias", {
    usage: "unalias <name>",
    group: "OS",
    description: "Remove a command alias.",
  });

  addOsCommand("set", {
    usage: "set <key> <value>",
    group: "OS",
    description: "Set a shell config variable.",
  });

  addOsCommand("unset", {
    usage: "unset <key>",
    group: "OS",
    description: "Remove a shell config variable.",
  });

  commands.push({
    name: "open",
    aliases: ["xdg-open", "launch"],
    usage: "open <path|url>",
    group: "Utility",
    featured: true,
    description: "Open a file, directory, or URL with the appropriate handler.",
    execute(_context, args) {
      const target = args[0];
      if (!target)
        return { kind: "system", text: "Usage: open <path|url>", tone: "warn" };
      if (/^(https?:|mailto:|ftp:)/.test(target))
        return {
          kind: "url",
          url: target,
          text: "Opening " + target + " in new tab\u2026",
          tone: "info",
        };
      const dirTarget = target.replace(/\/$/, "");
      if (
        dirTarget === "/" ||
        dirTarget === "/app" ||
        dirTarget === "/bin" ||
        dirTarget === "/etc" ||
        dirTarget === "/etc/themes" ||
        dirTarget === "/guest" ||
        dirTarget === "/home" ||
        dirTarget === "/posts" ||
        dirTarget === "/resume" ||
        dirTarget === "/projects" ||
        dirTarget === "/root" ||
        dirTarget === "/system" ||
        dirTarget === "/tmp" ||
        dirTarget === "/var" ||
        dirTarget === "/var/log"
      )
        return { kind: "os", command: "ls " + target };
      if (target.startsWith("/posts/") || target.startsWith("posts/")) {
        const normalized = target.startsWith("/") ? target : "/" + target;
        return { kind: "os", command: "cat " + normalized };
      }
      if (target.endsWith(".md"))
        return { kind: "os", command: "cat --pretty " + target };
      const codeExts = [
        ".ts",
        ".js",
        ".py",
        ".go",
        ".rs",
        ".zig",
        ".sh",
        ".json",
        ".css",
        ".html",
        ".c",
        ".cpp",
      ];
      if (
        codeExts.some(function (ext) {
          return target.endsWith(ext);
        })
      ) {
        const normalized = target.startsWith("/") ? target : "/" + target;
        return { kind: "os", command: "cat " + normalized };
      }
      return { kind: "os", command: "cat --pretty " + target };
    },
  });

  commands.push({
    name: "neofetch",
    aliases: ["neofetch"],
    usage: "neofetch",
    group: "System",
    description: "Display pecuOS system information with ASCII art.",
    execute() {
      const ascii = `        ____ _     ____
       / ___| |   |  _ \\
      | |   | |   | |_) |
      | |___| |___|  __/
       \\____|_____|_|`;
      const info = [
        "        guest@pecunies",
        "        --------------",
        `        OS: pecuOS terminal portfolio`,
        `        Kernel: Cloudflare Pages + Workers`,
        `        Shell: clpsh`,
        `        Focus: cloud systems / DevOps / runtimes`,
        `        Resume: resume | pdf | download`,
        `        Projects: projects | timeline | explain project <name>`,
        `        AI: chat | ask <question>`,
        `        Theme: orange signal`,
        "",
        `        type help for commands`,
      ];
      return {
        kind: "system",
        text: ascii + "\n" + info.join("\n"),
        tone: "info",
      };
    },
  });

  commands.push({
    name: "panic",
    aliases: ["error"],
    usage: "panic",
    group: "System",
    description: "Trigger a kernel panic animation then reboot the terminal.",
    execute() {
      return {
        kind: "system",
        text: [
          "KERNEL PANIC",
          "------------",
          "CPU 0: panic(@time): fatal trap 12: page fault while in kernel mode",
          "fault virtual address   = 0xdeadc0de",
          "fault code              = supervisor read, page not present",
          "instruction pointer     = 0x00:0xffffffff81000000",
          "stack pointer           = 0x00:0xffffe000deadbeef",
          "frame pointer           = 0x00:0xffffe000deadc0de",
          "code segment            = base 0x0, limit 0xfffff",
          "processor eflags        = interrupt enabled",
          "current process         = 12 (command-registry)",
          "",
          "---",
          "Rebooting pecuOS...",
          "System restored. Terminal ready.",
        ].join("\n"),
        tone: "warn",
      };
    },
  });

  commands.push({
    name: "status",
    aliases: ["dashboard"],
    usage: "status",
    group: "System",
    description: "Show a real-time TUI dashboard with site metrics and status.",
    execute() {
      const lines = [
        "┌─────────────────────────────────────────────────┐",
        "│          pecuOS STATUS DASHBOARD v1.2           │",
        "├─────────────────────────────────────────────────┤",
        "│ Site: pecunies.com                              │",
        `│ Status: ONLINE  │  Uptime: ${Math.floor(Math.random() * 90 + 1)}d ${Math.floor(Math.random() * 24)}h │`,
        "│ Edge: Cloudflare Workers                       │",
        "│ DB:   Cloudflare KV (ok)                       │",
        "│ AI:   Workers AI (ok)                          │",
        "├─────────────────────────────────────────────────┤",
        "│ REGION    │  LATENCY   │  STATUS               │",
        "│ iad       │  12ms      │  OK                   │",
        "│ fra       │  34ms      │  OK                   │",
        "│ nrt       │  89ms      │  OK                   │",
        "│ gru       │  142ms     │  OK                   │",
        "├─────────────────────────────────────────────────┤",
        `│ Last deploy: ${new Date(Date.now() - Math.random() * 86400000 * 3).toISOString().slice(0, 10)}  │  Build: OK                │`,
        `│ TLS: valid  │  Score: A+  │  CDN: active          │`,
        "├─────────────────────────────────────────────────┤",
        "| Refresh site metrics to see live counts.        |",
        "| Type /exit or press Ctrl+C to return.           |",
        "└─────────────────────────────────────────────────┘",
      ];

      return { kind: "system", text: lines.join("\n"), tone: "success" };
    },
  });

  commands.splice(1, 0, {
    name: "tags",
    aliases: [],
    usage: "tags [tag|prefix|tag1 tag2 ...]",
    group: "Utility",
    route: "tags",
    fullPageView: true,
    featured: false,
    description:
      "Browse content tags, filter by tag name/prefix, or select multiple tags (AND filter).",
    tags: ["portfolio", "tooling", "terminal"],
    async execute(_context, args) {
      let catalogTagIndex: Record<string, TagContentItem[]> = {};
      try {
        catalogTagIndex = buildCatalogTagIndex(await fetchCatalog());
      } catch {
        catalogTagIndex = {};
      }
      return {
        kind: "view",
        view: buildTagsView(
          args.join(" "),
          mergeTagIndexes(buildCommandTagIndex(), catalogTagIndex),
        ),
      };
    },
  });

  commands.push({
    name: "home",
    aliases: ["landing"],
    usage: "home",
    group: "Core",
    route: "home",
    fullPageView: true,
    description: "Show a minimal terminal landing page.",
    execute() {
      const pecuosAscii = `
<pre class="home-pecuos-ascii" aria-label="pecuOS banner">
<span class="home-pecuos-c9">           ____________________________________________________________</span>
<span class="home-pecuos-c0">          / ____/ ____/ ____/ / / / ____/ ____/_  __/ ____/ / / / __ \\</span>
<span class="home-pecuos-c1">         / /_  / __/ / /   / / / / /_  / __/   / / / /   / /_/ / / / /</span>
<span class="home-pecuos-c2">        / __/ / /___/ /___/ /_/ / __/ / /___  / / / /___/ __  / /_/ /</span>
<span class="home-pecuos-c3">       /_/   /_____/\\____/\\____/_/   /_____/ /_/  \\____/_/ /_/\\_____/</span>
<span class="home-pecuos-c4">                         cloud kernel / terminal lattice</span>
<span class="home-pecuos-c11"></span>
<span class="home-pecuos-c5">      .================================================================.</span>
<span class="home-pecuos-c6">      ||  [ai-core] [shell] [fs] [net] [kv] [metrics] [runtime]      ||</span>
<span class="home-pecuos-c7">      ||  host: guest@pecunies   edge: cloudflare   mode: interactive ||</span>
<span class="home-pecuos-c8">      ||  > help   > resume   > projects   > posts   > links   > chat ||</span>
<span class="home-pecuos-c10">      ||  palette: auto  red  amber  frost  ivory  green  magenta     ||</span>
<span class="home-pecuos-c5">      '================================================================'</span>
</pre>`;

      return {
        kind: "view",
        view: {
          id: "home",
          route: "home",
          prompt: "./terminal --home",
          eyebrow: "Welcome",
          title: "pecuOS shell",
          description:
            "Minimal entrypoint. Type help, resume, projects, posts, or chat.",
          note: "Shortcuts: help · resume · posts · links · contact",
          theme: "frost",
          logline: "Opened minimal home shell.",
          tags: ["terminal", "portfolio"],
          sections: [
            {
              type: "note",
              heading: "Welcome",
              lines: [],
              html: pecuosAscii,
            },
          ],
        },
      };
    },
  });

  // ── /auth ──────────────────────────────────────────────────────────────────
  commands.push({
    name: "auth",
    aliases: ["login", "signup"],
    usage:
      "auth [login|signup] [--email <email>] [--user <username>] [--name <name>]",
    group: "Identity",
    description: "Login or sign up. Stores session identity locally.",
    tags: ["auth", "identity", "user"],
    async execute(_ctx, args) {
      const sub = args[0]?.toLowerCase() || "login";
      const emailIdx = args.indexOf("--email");
      const userIdx = args.indexOf("--user");
      const nameIdx = args.indexOf("--name");
      const email = emailIdx >= 0 ? args[emailIdx + 1] : "";
      const username = userIdx >= 0 ? args[userIdx + 1] : "";
      const fullName = nameIdx >= 0 ? args.slice(nameIdx + 1).join(" ") : "";

      if (!email) {
        return {
          kind: "system",
          tone: "info",
          text: [
            "Usage:",
            "  auth login  --email <email>",
            "  auth signup --email <email> --user <username> [--name <full name>]",
            "",
            "Stores session as localStorage pecunies.session.*",
          ].join("\n"),
        };
      }

      try {
        let user;
        if (sub === "signup") {
          if (!username)
            return {
              kind: "system",
              tone: "warn",
              text: "--user <username> required for signup.",
            };
          user = await authSignup({ email, username, fullName });
        } else {
          user = await authLogin(email);
        }
        localStorage.setItem("pecunies.session.email", user.email);
        localStorage.setItem("pecunies.session.username", user.username);
        localStorage.setItem("pecunies.session.fullName", user.fullName);
        return {
          kind: "system",
          tone: "success",
          text: `Authenticated as ${user.username} <${user.email}>. Session saved.`,
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: String((err as Error).message),
        };
      }
    },
  });

  // ── /reply ─────────────────────────────────────────────────────────────────
  commands.push({
    name: "reply",
    aliases: ["comment"],
    usage: "reply --to <type>/<slug> [--parent <commentId>] <body...>",
    group: "Social",
    description:
      "Post a comment or reply to an existing comment on any entity.",
    tags: ["social", "comment", "interaction"],
    async execute(_ctx, args) {
      const toIdx = args.indexOf("--to");
      const parentIdx = args.indexOf("--parent");
      const toVal = toIdx >= 0 ? args[toIdx + 1] : "";
      const parentId = parentIdx >= 0 ? args[parentIdx + 1] : undefined;

      const bodyStart = Math.max(
        toIdx >= 0 ? toIdx + 2 : 0,
        parentIdx >= 0 ? parentIdx + 2 : 0,
      );
      const body = args.slice(bodyStart).join(" ").trim();

      if (!toVal || !body) {
        return {
          kind: "system",
          tone: "info",
          text: [
            "Usage:  reply --to <type>/<slug> [--parent <commentId>] <message>",
            "  reply --to post/my-post Hello, world!",
            "  reply --to skill/typescript --parent cmt_abc123 Agreed!",
          ].join("\n"),
        };
      }

      const [targetType, ...slugParts] = toVal.split("/");
      const targetSlug = slugParts.join("/");
      if (!targetType || !targetSlug)
        return {
          kind: "system",
          tone: "warn",
          text: "Invalid --to format. Use type/slug e.g. post/my-post",
        };

      const author =
        localStorage.getItem("pecunies.session.username") || "anon";
      const authorEmail = localStorage.getItem("pecunies.session.email") || "";

      try {
        const comment = await postComment({
          targetType,
          targetSlug,
          body,
          authorUsername: author,
          authorEmail,
          parentId,
        });
        return {
          kind: "system",
          tone: "success",
          text: `Comment posted (id: ${comment.id}) on ${targetType}/${targetSlug}${parentId ? ` [reply to ${parentId}]` : ""}`,
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Failed to post comment: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /redo ──────────────────────────────────────────────────────────────────
  commands.push({
    name: "redo",
    aliases: ["!!"],
    usage: "redo [n]",
    group: "Shell",
    description:
      "Re-run the last command, or the Nth most recent from history.",
    tags: ["shell", "history", "utility"],
    async execute(_ctx, args) {
      const n = Math.max(1, parseInt(args[0] || "1", 10));
      const sessionId =
        localStorage.getItem("pecunies.session.id") || "default";
      try {
        const history = await fetchHistory(sessionId, n + 1);
        const entry = history[n - 1];
        if (!entry)
          return {
            kind: "system",
            tone: "warn",
            text: "No command history found.",
          };
        return {
          kind: "os",
          command: entry.command,
          tone: "info",
        };
      } catch {
        return {
          kind: "system",
          tone: "warn",
          text: "Could not fetch command history.",
        };
      }
    },
  });

  // ── /tool ──────────────────────────────────────────────────────────────────
  commands.push({
    name: "tool",
    aliases: ["tools"],
    usage: "tool [slug]",
    group: "Catalog",
    route: "tool",
    fullPageView: true,
    description:
      "List or inspect tools. Each tool shows its tags, description, and where it's used.",
    tags: ["catalog", "tooling", "agents"],
    async execute(_ctx, args) {
      const slug = args[0]?.toLowerCase().trim();
      try {
        if (slug) {
          const result = await fetchEntity("tool", slug);
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `Tool '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        const tools = await fetchCatalog("tool");
        return {
          kind: "view",
          view: buildEntityListView("tool", "Tools", tools),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /skill ─────────────────────────────────────────────────────────────────
  commands.push({
    name: "skill",
    aliases: ["skills"],
    usage: "skill [slug|--cat <category>|--years <n>]",
    group: "Catalog",
    route: "skill",
    fullPageView: true,
    description:
      "Browse skills. Filter by category or minimum years of experience.",
    tags: ["catalog", "skills", "resume"],
    async execute(_ctx, args) {
      const slug = args.find((a) => !a.startsWith("--"));
      const catIdx = args.indexOf("--cat");
      const yearsIdx = args.indexOf("--years");
      const catFilter = catIdx >= 0 ? args[catIdx + 1] : null;
      const yearsMin =
        yearsIdx >= 0 ? parseFloat(args[yearsIdx + 1] || "0") : null;

      try {
        if (slug) {
          const result = await fetchEntity("skill", slug);
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `Skill '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        let skills = await fetchCatalog("skill");
        if (catFilter)
          skills = skills.filter((s) =>
            s.category?.toLowerCase().includes(catFilter.toLowerCase()),
          );
        if (yearsMin !== null)
          skills = skills.filter(
            (s) => (s.yearsOfExperience ?? 0) >= yearsMin!,
          );
        return {
          kind: "view",
          view: buildEntityListView("skill", "Skills", skills),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /step ──────────────────────────────────────────────────────────────────
  commands.push({
    name: "step",
    aliases: ["steps"],
    usage: "step [slug]",
    group: "Workflows",
    route: "step",
    fullPageView: true,
    description:
      "List or inspect workflow steps. Each step shows the jobs and workflows it's used in.",
    tags: ["workflow", "step", "automation"],
    async execute(_ctx, args) {
      const slug = args[0]?.toLowerCase().trim();
      try {
        if (slug) {
          const result = await fetchEntity("step", slug);
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `Step '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        const items = await fetchCatalog("step");
        return {
          kind: "view",
          view: buildEntityListView("step", "Steps", items),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /workflow ──────────────────────────────────────────────────────────────
  commands.push({
    name: "workflow",
    aliases: ["workflows"],
    usage: "workflow [slug]",
    group: "Workflows",
    route: "workflow",
    fullPageView: true,
    description:
      "List or inspect workflows. Shows executions, steps, tags, and description.",
    tags: ["workflow", "automation", "orchestration"],
    async execute(_ctx, args) {
      const slug = args[0]?.toLowerCase().trim();
      try {
        if (slug) {
          const result = await fetchEntity("workflow", slug);
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `Workflow '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        const items = await fetchCatalog("workflow");
        return {
          kind: "view",
          view: buildEntityListView("workflow", "Workflows", items),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /execution ─────────────────────────────────────────────────────────────
  commands.push({
    name: "execution",
    aliases: ["executions", "exec"],
    usage: "execution [slug]",
    group: "Workflows",
    route: "execution",
    fullPageView: true,
    description:
      "View execution logs. Shows pass/fail, duration, steps run, trigger, and output.",
    tags: ["workflow", "execution", "logs"],
    async execute(_ctx, args) {
      const slug = args[0]?.toLowerCase().trim();
      try {
        if (slug) {
          const result = await fetchEntity("execution", slug);
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `Execution '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        const items = await fetchCatalog("execution");
        return {
          kind: "view",
          view: buildEntityListView("execution", "Executions", items),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /agents ────────────────────────────────────────────────────────────────
  commands.push({
    name: "agents",
    aliases: ["agent"],
    usage: "agents [slug]",
    group: "AI",
    route: "agent",
    fullPageView: true,
    description:
      "List or inspect agents. Shows system prompt, skills, tools, hooks, and triggers.",
    tags: ["ai", "agent", "automation"],
    async execute(_ctx, args) {
      const slug = args[0]?.toLowerCase().trim();
      try {
        if (slug) {
          const result = await fetchEntity("agent", slug);
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `Agent '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        const items = await fetchCatalog("agent");
        return {
          kind: "view",
          view: buildEntityListView("agent", "Agents", items),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /hook ──────────────────────────────────────────────────────────────────
  commands.push({
    name: "hook",
    aliases: ["hooks"],
    usage: "hook [slug]",
    group: "Automation",
    route: "hook",
    fullPageView: true,
    description:
      "List or inspect hooks. Shows trigger events, target action, tags, and where used.",
    tags: ["automation", "hook", "trigger"],
    async execute(_ctx, args) {
      const slug = args[0]?.toLowerCase().trim();
      try {
        if (slug) {
          const result = await fetchEntity("hook", slug);
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `Hook '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        const items = await fetchCatalog("hook");
        return {
          kind: "view",
          view: buildEntityListView("hook", "Hooks", items),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /triggers ──────────────────────────────────────────────────────────────
  commands.push({
    name: "triggers",
    aliases: ["trigger"],
    usage: "triggers [slug]",
    group: "Automation",
    route: "trigger",
    fullPageView: true,
    description:
      "List or inspect triggers. Shows event type, condition, action, tags, and where used.",
    tags: ["automation", "trigger", "event"],
    async execute(_ctx, args) {
      const slug = args[0]?.toLowerCase().trim();
      try {
        if (slug) {
          const result = await fetchEntity("trigger", slug);
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `Trigger '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        const items = await fetchCatalog("trigger");
        return {
          kind: "view",
          view: buildEntityListView("trigger", "Triggers", items),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /users ─────────────────────────────────────────────────────────────────
  commands.push({
    name: "users",
    aliases: ["user"],
    usage: "users [username]",
    group: "Identity",
    route: "user",
    fullPageView: true,
    description:
      "List or inspect users. Each user has their own page with tags, bio, and avatar.",
    tags: ["identity", "user", "social"],
    async execute(_ctx, args) {
      const slug = args[0]?.toLowerCase().trim();
      try {
        if (slug) {
          const result = await fetchEntity("user", slug);
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `User '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        const items = await fetchCatalog("user");
        return {
          kind: "view",
          view: buildEntityListView("user", "Users", items),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /job ───────────────────────────────────────────────────────────────────
  commands.push({
    name: "job",
    aliases: ["jobs", "cron"],
    usage: "job [slug]",
    group: "Automation",
    route: "job",
    fullPageView: true,
    description:
      "List or inspect background jobs (cron). Shows schedule, steps, tags, and run history.",
    tags: ["automation", "job", "cron", "background"],
    async execute(_ctx, args) {
      const slug = args[0]?.toLowerCase().trim();
      try {
        if (slug) {
          const result = await fetchEntity("job", slug);
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `Job '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        const items = await fetchCatalog("job");
        return {
          kind: "view",
          view: buildEntityListView("job", "Background Jobs", items),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /systemprompt ──────────────────────────────────────────────────────────
  commands.push({
    name: "systemprompt",
    aliases: ["sysprompt", "sp"],
    usage: "systemprompt [slug]",
    group: "AI",
    route: "systemprompt",
    fullPageView: true,
    description:
      "List or inspect system prompts. Shows injection text, context sources, where used, and tags.",
    tags: ["ai", "systemprompt", "agent"],
    async execute(_ctx, args) {
      const slug = args[0]?.toLowerCase().trim();
      try {
        if (slug) {
          const result = await fetchEntity("systemprompt", slug);
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `System prompt '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        const items = await fetchCatalog("systemprompt");
        return {
          kind: "view",
          view: buildEntityListView("systemprompt", "System Prompts", items),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  // ── /data ──────────────────────────────────────────────────────────────────
  commands.push({
    name: "data",
    aliases: ["datasource", "sources"],
    usage: "data [slug|--type <category>]",
    group: "AI",
    route: "data",
    fullPageView: true,
    description:
      "List data sources available to agents and skills. Shows type, schema, tags, and where used.",
    tags: ["ai", "data", "knowledge"],
    async execute(_ctx, args) {
      const slug = args.find((a) => !a.startsWith("--"));
      const typeIdx = args.indexOf("--type");
      const typeFilter = typeIdx >= 0 ? args[typeIdx + 1] : null;
      try {
        if (slug) {
          const result = await fetchEntity(
            "data" as CatalogEntity["type"],
            slug,
          );
          if (!result)
            return {
              kind: "system",
              tone: "warn",
              text: `Data source '${slug}' not found.`,
            };
          return {
            kind: "view",
            view: buildEntityDetailView(result.item, result.usedBy),
          };
        }
        let items = await fetchCatalog("data" as CatalogEntity["type"]);
        if (typeFilter)
          items = items.filter((s) =>
            s.category?.toLowerCase().includes(typeFilter.toLowerCase()),
          );
        return {
          kind: "view",
          view: buildEntityListView("data", "Data Sources", items),
        };
      } catch (err) {
        return {
          kind: "system",
          tone: "warn",
          text: `Error: ${(err as Error).message}`,
        };
      }
    },
  });

  return {
    commands,
    featuredCommands: commands.filter((command) => command.featured),
  };
}

// ─── Generic entity view builders ─────────────────────────────────────────────

function buildEntityListView(
  type: string,
  title: string,
  items: CatalogEntity[],
): ViewDefinition {
  const grouped = new Map<string, CatalogEntity[]>();
  for (const item of items) {
    const cat = item.category || "General";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }
  const sections: ViewDefinition["sections"] =
    items.length === 0
      ? [
          {
            type: "note",
            heading: "Empty",
            lines: [`No ${type}s found. Create one via the API.`],
          },
        ]
      : Array.from(grouped.entries()).map(([cat, catItems]) => ({
          type: "command-list" as const,
          heading: cat,
          items: catItems.map((item) => ({
            name: item.title,
            usage: `${type} ${item.slug}`,
            description: item.description || item.summary || "",
            command: `${type} ${item.slug}`,
            group: cat,
            tags: item.tags,
          })),
        }));

  return {
    id: `${type}-list`,
    route: type,
    prompt: `./${type} --list`,
    eyebrow: title,
    title,
    description: `All ${title.toLowerCase()} in the catalog.`,
    theme: "frost",
    logline: `Listing ${items.length} ${title.toLowerCase()}.`,
    tags: [type, "catalog"],
    sections,
    stats: [{ label: "Total", value: String(items.length) }],
    actions: [{ label: `New ${type}`, command: `new ${type}` }],
  };
}

function buildEntityDetailView(
  item: CatalogEntity,
  usedBy: CatalogEntity[],
): ViewDefinition {
  const sections: ViewDefinition["sections"] = [];

  if (item.description || item.summary) {
    sections.push({
      type: "note",
      heading: "About",
      lines: [item.description || item.summary || ""].concat(
        item.details ?? [],
      ),
    });
  }

  if (item.metadata && Object.keys(item.metadata).length > 0) {
    sections.push({
      type: "metrics",
      heading: "Properties",
      items: Object.entries(item.metadata).map(([k, v]) => ({
        label: k.replace(/_/g, " "),
        value: String(v),
      })),
    });
  }

  if (item.tags?.length) {
    sections.push({
      type: "tag-index",
      heading: "Tags",
      allTags: item.tags.map((t) => ({ slug: t, count: 0 })),
      items: item.tags.map((t) => ({
        label: t,
        type: "command",
        command: `tags ${t}`,
      })),
    });
  }

  if (item.related?.length) {
    sections.push({
      type: "command-list",
      heading: "Related",
      items: item.related.map((ref) => ({
        name: ref.label || ref.slug,
        usage: `${ref.type} ${ref.slug}`,
        description: `${ref.type}: ${ref.slug}`,
        command: `${ref.type} ${ref.slug}`,
        group: ref.type,
      })),
    });
  }

  if (usedBy.length > 0) {
    sections.push({
      type: "command-list",
      heading: "Used By",
      items: usedBy.slice(0, 24).map((e) => ({
        name: e.title,
        usage: `${e.type} ${e.slug}`,
        description: e.description || "",
        command: `${e.type} ${e.slug}`,
        group: e.type,
      })),
    });
  }

  if (sections.length === 0) {
    sections.push({
      type: "note",
      heading: item.title,
      lines: ["No details available yet."],
    });
  }

  return {
    id: `${item.type}-${item.slug}`,
    route: `${item.type}/${item.slug}`,
    prompt: `./${item.type} ${item.slug}`,
    eyebrow: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    title: item.title,
    description: item.description || item.summary || "",
    theme: "frost",
    logline: `${item.type}: ${item.title}`,
    tags: item.tags,
    stats: [
      { label: "Type", value: item.type },
      { label: "Slug", value: item.slug },
      ...(item.category ? [{ label: "Category", value: item.category }] : []),
      ...(item.yearsOfExperience
        ? [{ label: "Experience", value: `${item.yearsOfExperience}y` }]
        : []),
      ...(item.status ? [{ label: "Status", value: item.status }] : []),
    ],
    sections,
  };
}

function buildSignalStats(): ViewStat[] {
  return resumeData.signals.map((signal) => ({
    label: signal.label,
    value: signal.value,
    detail: signal.detail,
    signalId: signal.id,
    signalAccent: signal.accent,
    signalMode: signal.mode,
  }));
}
