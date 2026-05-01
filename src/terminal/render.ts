import { COMMAND_TAGS } from "../data/content-tags";
import { resumeData } from "../data/resume";
import { WORKERS_AI_TEXT_MODELS, formatWorkersAiModelLabel } from "./ai-models";
import type {
  CommandDefinition,
  CommandHelpItem,
  ContactCard,
  PdfPreview,
  ProjectCard,
  SessionLine,
  TagGroup,
  TerminalSection,
  TimelineItem,
  ViewAction,
  ViewDefinition,
  ViewStat,
} from "./types";

type ShellRenderOptions = {
  featuredCommands: CommandDefinition[];
};

function renderTagChip(tag: string, compact = false, context = ""): string {
  const cls = compact ? "content-tag content-tag--compact" : "content-tag";
  const contextAttr = context
    ? ` data-entity-context="${escapeAttribute(context)}"`
    : "";
  return `<button type="button" class="${cls}" data-command="tags ${escapeAttribute(tag)}" data-entity-tag="${escapeAttribute(tag)}"${contextAttr}>#${escapeHtml(tag)}</button>`;
}

function entitySlug(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitSkillLabel(value: string): { name: string; years: string } {
  const match = String(value || "").match(
    /^(.*?)\s+-\s+([0-9.]+\+?\s+years?)$/i,
  );
  return {
    name: (match?.[1] ?? value).trim(),
    years: (match?.[2] ?? "").trim(),
  };
}

function editWrap(key: string, inner: string, block = true): string {
  const tag = block ? "div" : "span";
  const cls = block
    ? "editable-wrap editable-wrap--block"
    : "editable-wrap editable-wrap--inline";
  return `<${tag} class="${cls}">${inner}<button class="edit-btn" type="button" data-edit-key="${escapeAttribute(key)}" aria-label="Edit" tabindex="-1">✎</button></${tag}>`;
}

export function renderShell({ featuredCommands }: ShellRenderOptions): string {
  const labels = new Map<string, string>([
    ["about", "About"],
    ["resume", "Resume"],
    ["timeline", "Timeline"],
    ["projects", "Projects"],
    ["skills", "Skills"],
    ["posts", "Posts"],
    ["links", "Links"],
    ["pdf", "PDF"],
    ["chat", "Chat"],
  ]);

  const navSequence = [
    "about",
    "resume",
    "projects",
    "posts",
    "links",
    "chat",
  ] as const;
  const featuredByName = new Map(
    featuredCommands.map((command) => [command.name, command]),
  );
  const navLinks = navSequence
    .map((name) => featuredByName.get(name))
    .filter((command): command is CommandDefinition => Boolean(command))
    .map(
      (command) => `
        <button class="nav-link" type="button" data-command="${escapeAttribute(command.name)}" data-nav="${escapeAttribute(command.name)}">
          ${escapeHtml(labels.get(command.name) ?? command.name)}
        </button>
      `,
    )
    .join("");
  const rssNavButton = `
    <a class="nav-link" href="/api/rss" target="_blank" rel="noopener noreferrer" aria-label="RSS feed">RSS</a>
  `;

  return `
    <canvas class="field-canvas" id="field-canvas" aria-hidden="true"></canvas>
    <div class="parallax-grid" aria-hidden="true"></div>
    <div class="ambient-noise" aria-hidden="true"></div>
    <div class="crt-chromatic-field" aria-hidden="true"></div>
    <div class="crt-color-burn-field" aria-hidden="true"></div>
    <div class="crt-signal-bleed" aria-hidden="true"></div>
    <div class="crt-vignette" aria-hidden="true"></div>
    <div class="crt-grain" aria-hidden="true"></div>
    <div class="crt-hum" aria-hidden="true"></div>
    <div class="scanlines" aria-hidden="true"></div>

    <header class="site-nav" aria-label="Primary navigation">
      <button class="brand-mark" type="button" data-command="home">
        <span class="brand-dot" aria-hidden="true"></span>
        <span>${escapeHtml(resumeData.name)}</span>
      </button>
      <nav class="nav-links" aria-label="Portfolio sections">
        ${navLinks}
        ${rssNavButton}
      </nav>
    </header>

    <div class="site-shell">
      <section class="terminal-shell" id="terminal-shell">
        <div class="terminal-crt-scan" aria-hidden="true"></div>
        <header class="terminal-header">
          <div class="terminal-left-controls">
            <div class="terminal-controls">
              <button class="window-button is-close" type="button" data-window-action="shutdown" aria-label="Shutdown terminal"></button>
              <button class="window-button is-minimize" type="button" data-window-action="minimize" aria-label="Minimize terminal"></button>
              <button class="window-button is-maximize" type="button" data-window-action="maximize" aria-label="Maximize terminal"></button>
            </div>
          </div>
          <div class="terminal-state">
            <span id="route-indicator">resume</span>
            <button id="theme-indicator" type="button" aria-haspopup="dialog" aria-expanded="false" hidden></button>
            <div class="theme-popover" id="theme-popover" hidden>
              <div class="theme-popover-title">Choose palette</div>
              <div class="theme-popover-grid">
                <button type="button" class="theme-choice-chip" data-theme-choice="auto">auto</button>
                <button type="button" class="theme-choice-chip" data-theme-choice="red">red</button>
                <button type="button" class="theme-choice-chip" data-theme-choice="amber">amber</button>
                <button type="button" class="theme-choice-chip" data-theme-choice="frost">frost</button>
                <button type="button" class="theme-choice-chip" data-theme-choice="ivory">ivory</button>
                <button type="button" class="theme-choice-chip" data-theme-choice="green">green</button>
                <button type="button" class="theme-choice-chip" data-theme-choice="magenta">magenta</button>
                <button type="button" class="theme-choice-chip" data-theme-choice="blue">blue</button>
              </div>
            </div>
          </div>
          <button class="ghost-button titlebar-ghost" id="terminal-back-button" type="button" data-nav-action="back" aria-label="Go back to previous view">back</button>
        </header>

        <div class="terminal-body crt-text">
          <div class="terminal-output terminal-text">
            <div class="terminal-ambient-summary" hidden>
              <span class="prompt-prefix" id="terminal-prompt-label">guest@pecunies:~$</span>
              <span class="banner-command" id="prompt-scramble" data-scramble>${escapeHtml(resumeData.commandBanner)}</span>
              <span class="terminal-status" id="status-scramble" data-scramble>
                ${escapeHtml(resumeData.statement)}
              </span>
            </div>

            <article class="viewer-panel" id="active-view" hidden></article>
            <ol class="terminal-log" id="terminal-log" aria-live="polite"></ol>
          </div>

          <div
            class="autocomplete-panel"
            id="autocomplete-panel"
            role="listbox"
            hidden
            aria-label="Command suggestions"
          >
            <div class="autocomplete-list" id="autocomplete-list"></div>
          </div>

          <div class="terminal-prompt-bar">
            <form class="terminal-form" id="terminal-form" autocomplete="off">
              <label class="sr-only" for="terminal-input">Terminal command input</label>
              <button
                class="prompt-prefix prompt-identity-button"
                id="prompt-identity-button"
                type="button"
                aria-haspopup="dialog"
                aria-expanded="false"
              >
                guest@pecunies:~$
              </button>
              <input
                class="terminal-input crt-text"
                id="terminal-input"
                name="command"
                type="text"
                spellcheck="false"
                placeholder="help"
                aria-label="Type a command"
                aria-autocomplete="list"
                aria-controls="autocomplete-list"
                aria-expanded="false"
              />
              <button class="submit-button" type="submit">Run</button>
            </form>
            <div class="identity-popover" id="identity-popover" hidden>
              <div class="identity-popover-title">Session identity</div>
              <label class="identity-popover-label" for="identity-display-name">Display name</label>
              <input class="identity-popover-input" id="identity-display-name" type="text" maxlength="32" />
              <label class="identity-popover-label" for="identity-environment">Environment</label>
              <select class="identity-popover-select" id="identity-environment">
                <option value="pecunies">pecunies</option>
              </select>
              <label class="identity-popover-label" for="identity-model">AI model</label>
              <select class="identity-popover-select" id="identity-model">
                ${WORKERS_AI_TEXT_MODELS.map(
                  (id) =>
                    `<option value="${escapeAttribute(id)}">${escapeHtml(id)}</option>`,
                ).join("")}
              </select>
              <label class="identity-popover-label" for="identity-email">Email (optional)</label>
              <input
                class="identity-popover-input"
                id="identity-email"
                type="email"
                maxlength="120"
                placeholder="name@example.com"
              />
              <label class="identity-popover-label" for="identity-theme">Theme</label>
              <select class="identity-popover-select" id="identity-theme">
                <option value="orange">orange</option>
                <option value="red">red</option>
                <option value="amber">amber</option>
                <option value="frost">frost</option>
                <option value="ivory">ivory</option>
                <option value="green">green</option>
                <option value="magenta">magenta</option>
                <option value="blue">blue</option>
                <option value="purple">purple</option>
                <option value="auto">auto</option>
              </select>
              <label class="identity-popover-toggle" for="identity-dark-mode">
                <input id="identity-dark-mode" type="checkbox" checked />
                <span>dark mode</span>
              </label>
              <label class="identity-popover-toggle" for="identity-ai-tools">
                <input id="identity-ai-tools" type="checkbox" />
                <span>AI tool use (chat)</span>
              </label>
              <label class="identity-popover-toggle" for="identity-skill-use">
                <input id="identity-skill-use" type="checkbox" />
                <span>AI skill use</span>
              </label>
              <label class="identity-popover-label" for="identity-system-prompt">System prompt injection</label>
              <textarea
                class="identity-popover-textarea"
                id="identity-system-prompt"
                rows="4"
                maxlength="1200"
                placeholder="Append temporary instructions to the default AI context..."
              ></textarea>
              <div class="identity-popover-actions">
                <button class="ghost-button" id="identity-cancel" type="button">Cancel</button>
                <button class="submit-button" id="identity-save" type="button">Save</button>
              </div>
            </div>
          </div>
        </div>
        <span class="shell-resize-handle shell-resize-n" data-resize="n" aria-hidden="true"></span>
        <span class="shell-resize-handle shell-resize-s" data-resize="s" aria-hidden="true"></span>
        <span class="shell-resize-handle shell-resize-e" data-resize="e" aria-hidden="true"></span>
        <span class="shell-resize-handle shell-resize-w" data-resize="w" aria-hidden="true"></span>
        <span class="shell-resize-handle shell-resize-ne" data-resize="ne" aria-hidden="true"></span>
        <span class="shell-resize-handle shell-resize-nw" data-resize="nw" aria-hidden="true"></span>
        <span class="shell-resize-handle shell-resize-se" data-resize="se" aria-hidden="true"></span>
        <span class="shell-resize-handle shell-resize-sw" data-resize="sw" aria-hidden="true"></span>
      </section>

      <!-- Entity hover popover (tag / skill) -->
      <div id="entity-hover-popover" class="entity-hover-popover" role="tooltip" hidden>
        <button class="ehp-dismiss" type="button" aria-label="Remove" title="Remove from page">✕ Remove</button>
        <div class="ehp-type-badge"></div>
        <p class="ehp-name"></p>
        <p class="ehp-desc"></p>
        <div class="ehp-meta"><span class="ehp-count"></span></div>
        <ul class="ehp-uses"></ul>
        <div class="ehp-footer">
          <button class="ehp-navigate" type="button">View page →</button>
          <button class="ehp-remove" type="button" aria-label="Remove tag">Remove</button>
        </div>
      </div>

      <!-- Sudo auth modal for in-place editing -->
      <div id="sudo-edit-modal" class="sudo-edit-modal" role="dialog" aria-modal="true" aria-labelledby="sudo-modal-label" hidden>
        <div class="sudo-modal-backdrop"></div>
        <div class="sudo-modal-content">
          <p class="sudo-modal-label" id="sudo-modal-label">[sudo] Password required to edit:</p>
          <input class="sudo-modal-input" id="sudo-modal-input" type="password" autocomplete="current-password" placeholder="password" />
          <p class="sudo-modal-error" id="sudo-modal-error" hidden></p>
          <div class="sudo-modal-actions">
            <button class="ghost-button sudo-modal-cancel" type="button" id="sudo-cancel-btn">Cancel</button>
            <button class="submit-button sudo-modal-confirm" type="button" id="sudo-confirm-btn">Authenticate</button>
          </div>
        </div>
      </div>
      <button class="terminal-dock is-active" id="terminal-dock" type="button" aria-label="Minimize terminal window">
        <span></span>
        Terminal
      </button>
    </div>
  `;
}

let _knownCommandNames = new Set<string>();

export function setKnownCommandNames(names: string[]): void {
  _knownCommandNames = new Set(names);
}

/** Highlight command-looking strings in output only. Click text to stage it; click ⓘ for man. */
function highlightCommandTokens(text: string): string {
  if (!_knownCommandNames.size) return escapeHtml(text);

  // Match commands only - must start with /, followed by known command name, stop at whitespace/punctuation
  const commandPattern = Array.from(_knownCommandNames)
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  
  const commandLike = new RegExp(
    `(^|[^\\w/-])(/(${commandPattern}))(?=[\\s,.;)]|$)`,
    "gi",
  );

  let html = "";
  let lastIndex = 0;
  for (const match of text.matchAll(commandLike)) {
    const full = match[0] ?? "";
    const prefix = match[1] ?? "";
    const commandText = match[2] ?? "";
    const commandName = match[3]?.toLowerCase() ?? "";
    const start = (match.index ?? 0) + prefix.length;
    
    if (!commandText || !_knownCommandNames.has(commandName)) continue;

    html += escapeHtml(text.slice(lastIndex, start));
    html += `<span class="cmd-token cmd-token--preview-wrap"><button type="button" class="cmd-token cmd-token--name" data-command-preview="${escapeAttribute(commandText)}" data-prepopulate-command="${escapeAttribute(commandText)}" title="Stage command">${escapeHtml(commandText)}</button><button type="button" class="cmd-token-info" data-man-command="${escapeAttribute(commandName)}" aria-label="Open man page for ${escapeAttribute(commandName)}">ⓘ</button></span>`;
    lastIndex = start + commandText.length;
  }
  html += escapeHtml(text.slice(lastIndex));
  return html;
}

export function renderLog(lines: SessionLine[]): string {
  return lines
    .map((line) => {
      if (line.kind === "command") {
        return `
          <li class="log-line log-line-command" data-line-id="${escapeAttribute(line.id)}">
            <span class="log-prefix">guest@pecunies:~$</span>
            <span class="log-copy">${escapeHtml(line.text)}</span>
          </li>
        `;
      }

      if (line.kind === "system") {
        return `
          <li class="log-line log-line-system is-${escapeAttribute(line.tone)}" data-line-id="${escapeAttribute(line.id)}">
            <span class="log-label">[${escapeHtml(line.label)}]</span>
            <span class="log-copy">${highlightCommandTokens(line.text)}</span>
          </li>
        `;
      }

      if (line.kind === "pretty-response") {
        const copyButton = line.copyable
          ? `<button class="pretty-copy-button" type="button" data-copy-pretty-id="${escapeAttribute(line.id)}" aria-label="Copy response"></button>`
          : "";
        const displayModel = formatWorkersAiModelLabel(line.model);
        const metaHeader =
          displayModel || copyButton
            ? `<div class="pretty-output-meta">
                 <span class="pretty-output-model">${displayModel ? escapeHtml(displayModel) : ""}</span>
                 ${copyButton}
               </div>`
            : "";
        const traceSection =
          line.traceHtml && line.traceText
            ? renderTraceSection(line.traceHtml, line.traceLabel ?? "Trace")
            : "";
        const shellClass = [
          "pretty-output-shell",
          line.model ? "pretty-output-shell--ai" : "",
          line.copyable && !line.model ? "pretty-output-shell--file-copy" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const quoteAttr = line.model ? ' data-chat-quote-source="1"' : "";
        return `
          <li class="log-line log-line-pretty" data-line-id="${escapeAttribute(line.id)}"${quoteAttr}>
            <div class="${shellClass}">
              ${metaHeader}
              <div class="pretty-output markdown-body">${line.html}</div>
              ${traceSection}
            </div>
          </li>
        `;
      }

      if (line.kind === "view") {
        return `
          <li class="log-line log-line-view" data-line-id="${escapeAttribute(line.id)}">
            ${line.html}
          </li>
        `;
      }

      return `
        <li class="log-line log-line-response is-${escapeAttribute(line.tone)}" data-line-id="${escapeAttribute(line.id)}">
          <span class="log-label">&gt;</span>
          <span class="log-copy">${highlightCommandTokens(line.text)}</span>
        </li>
      `;
    })
    .join("");
}

export function renderView(view: ViewDefinition): string {
  const actionsMarkup = view.actions?.length
    ? renderActions(view.actions, "view-actions", view.id)
    : `<div class="view-actions"><button type="button" class="add-quick-link-btn" data-add-entity-type="link" data-add-entity-context="view:${escapeAttribute(view.id)}" aria-label="Add quick link" title="Add quick link">+</button></div>`;
  const sectionsMarkup = view.sections
    .map((s, i) => renderSection(s, view.id, i))
    .join("");

  const tagRow = view.tags?.length
    ? `<div class="view-tag-row" aria-label="Content tags">
        ${view.tags.map((tag) => renderTagChip(tag, false, `view:${view.id}`)).join("")}
        <button type="button" class="add-tag-btn" data-add-tag-context="${escapeAttribute(`view:${view.id}`)}" aria-label="Add tag" title="Add tag">+</button>
      </div>`
    : "";

  return `
    <div class="terminal-view is-live">
      <header class="terminal-view-head">
        <div class="terminal-view-meta">
          <span class="terminal-kicker">${escapeHtml(view.eyebrow)}</span>
          <code>${escapeHtml(view.prompt)}</code>
        </div>
        ${editWrap(`view:${view.id}:title`, `<h1 class="terminal-title" data-edit-key="${escapeAttribute(`view:${view.id}:title`)}">${escapeHtml(view.title)}</h1>`)}
        ${editWrap(`view:${view.id}:desc`, `<p class="terminal-copy" data-edit-key="${escapeAttribute(`view:${view.id}:desc`)}">${escapeHtml(view.description)}</p>`)}
        ${view.note ? `<p class="terminal-note">${escapeHtml(view.note)}</p>` : ""}
        ${tagRow}
        ${actionsMarkup}
      </header>

      <div class="terminal-section-stack">
        ${sectionsMarkup}
      </div>
    </div>
  `;
}

function renderSection(
  section: TerminalSection,
  viewId = "",
  sectionIndex = 0,
): string {
  const hKey = `view:${viewId}:s${sectionIndex}:h`;
  const heading = editWrap(
    hKey,
    `<h2 class="output-heading" data-edit-key="${escapeAttribute(hKey)}">${escapeHtml(section.heading)}</h2>`,
  );

  switch (section.type) {
    case "paragraphs":
      return `
        <section class="output-block">
          ${heading}
          <div class="output-copy">
            ${section.body
              .map((paragraph, pi) =>
                editWrap(
                  `view:${viewId}:s${sectionIndex}:p${pi}`,
                  `<p data-edit-key="${escapeAttribute(`view:${viewId}:s${sectionIndex}:p${pi}`)}">${escapeHtml(paragraph)}</p>`,
                ),
              )
              .join("")}
          </div>
        </section>
      `;

    case "metrics":
      return `
        <section class="output-block">
          ${heading}
          <div class="terminal-stat-grid">
            ${section.items.map(renderStat).join("")}
          </div>
        </section>
      `;

    case "timeline":
      return `
        <section class="output-block">
          ${heading}
          <div class="timeline-rail">
            ${section.items.map((item, itemIndex) => renderTimelineItem(item, viewId, sectionIndex, itemIndex)).join("")}
          </div>
          <button type="button" class="add-experience-btn" data-add-entity-type="work" data-add-entity-context="view:${escapeAttribute(viewId)}" aria-label="Add experience" title="Add experience">+</button>
        </section>
      `;

    case "tag-groups":
      return `
        <section class="output-block">
          ${heading}
          <div class="output-grid">
            ${section.groups.map(renderTagGroup).join("")}
          </div>
          <button type="button" class="add-skill-btn" data-add-entity-type="skill" aria-label="Add skill" title="Add skill">+</button>
        </section>
      `;

    case "projects":
      return `
        <section class="output-block">
          ${heading}
          <div class="output-records">
            ${section.items.map(renderProjectCard).join("")}
          </div>
        </section>
      `;

    case "contact":
      return `
        <section class="output-block">
          ${heading}
          <div class="output-grid">
            ${section.items.map(renderContactCard).join("")}
          </div>
        </section>
      `;

    case "education":
      return `
        <section class="output-block">
          ${heading}
          <article class="output-record">
            <div class="record-topline">
              <p>
                <strong>${escapeHtml(section.item.school)}</strong>
                <span>${escapeHtml(section.item.degree)}</span>
              </p>
              <div class="record-meta">
                <span>${escapeHtml(section.item.location)}</span>
                <span>${escapeHtml(section.item.period)}</span>
              </div>
            </div>
            <ul class="output-list">
              ${section.item.highlights.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join("")}
            </ul>
          </article>
        </section>
      `;

    case "command-list":
      return `
        <section class="output-block">
          ${heading}
          <div class="command-list">
            ${section.items.map(renderCommandHelpItem).join("")}
          </div>
        </section>
      `;

    case "pdf":
      return `
        <section class="output-block pdf-panel">
          ${heading}
          <p class="terminal-copy">${escapeHtml(section.summary)}</p>
          <div class="pdf-layout">
            <div class="pdf-preview-strip">
              ${section.previews.map(renderPdfPreview).join("")}
            </div>
            <div class="pdf-frame">
              <iframe
                class="pdf-embed"
                src="${escapeAttribute(section.src)}#toolbar=0&navpanes=0&view=FitH"
                title="Chris Pecunies resume PDF"
              ></iframe>
            </div>
          </div>
        </section>
      `;

    case "note":
      return `
        <section class="output-block note-panel">
          ${heading}
          <div class="output-copy">
            ${
              section.html
                ? section.html
                : section.lines
                    .map((line, li) =>
                      editWrap(
                        `view:${viewId}:s${sectionIndex}:n${li}`,
                        `<p data-edit-key="${escapeAttribute(`view:${viewId}:s${sectionIndex}:n${li}`)}">${escapeHtml(line)}</p>`,
                      ),
                    )
                    .join("")
            }
          </div>
        </section>
      `;

    case "tag-index": {
      const selected = new Set(
        (section.selectedTags ?? []).map((tag) => tag.toLowerCase()),
      );
      const buildTagCommand = (slug: string): string => {
        const next = new Set(selected);
        if (next.has(slug)) {
          next.delete(slug);
        } else {
          next.add(slug);
        }
        const tokens = Array.from(next);
        return tokens.length ? `tags ${tokens.join(" ")}` : "tags";
      };
      return `
        <section class="output-block tag-index-panel">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
          ${
            section.description
              ? `<p class="terminal-copy tag-index-desc">${escapeHtml(section.description)}</p>`
              : ""
          }
          ${
            section.filter
              ? `<p class="tag-index-active">Filtering: <strong>#${escapeHtml(section.filter)}</strong></p>`
              : ""
          }
          <div class="tag-cloud" role="list">
            ${section.allTags
              .map(
                (t) => `
              <button type="button" class="tag-cloud-chip${selected.has(t.slug) ? " is-active" : ""}" data-command="${escapeAttribute(buildTagCommand(t.slug))}" data-entity-tag="${escapeAttribute(t.slug)}" role="listitem">
                <span class="tag-cloud-name">#${escapeHtml(t.slug)}</span>
                <span class="tag-cloud-count">${t.count}</span>
              </button>`,
              )
              .join("")}
          </div>
          <h3 class="output-heading output-heading-sub">Matching content</h3>
          <div class="tag-result-list">
            ${section.items
              .map(
                (item) => `
              <button type="button" class="tag-result-row" data-command="${escapeAttribute(item.command)}">
                <span class="tag-result-type">${escapeHtml(item.type)}</span>
                <span class="tag-result-label">${escapeHtml(item.label)}</span>
                <code class="tag-result-cmd">${escapeHtml(item.command)}</code>
              </button>`,
              )
              .join("")}
          </div>
        </section>
      `;
    }
  }
}

function renderStat(stat: ViewStat): string {
  const content = `
    <span>${escapeHtml(stat.label)}</span>
    <strong>${escapeHtml(stat.value)}</strong>
    ${stat.detail ? `<small>${escapeHtml(stat.detail)}</small>` : ""}
  `;

  const signalId = stat.signalId;
  const isSignal = Boolean(signalId);
  const signalIdAttr = signalId ? ` data-signal-id="${escapeAttribute(signalId)}"` : "";
  const signalAccentAttr = isSignal && stat.signalAccent ? ` style="--signal-accent: ${escapeAttribute(stat.signalAccent)}"` : "";

  if (stat.command) {
    return `
      <button class="terminal-stat" type="button" data-command="${escapeAttribute(stat.command)}"${signalIdAttr}${signalAccentAttr}>
        ${content}
        ${signalId ? `
          <span class="stat-actions">
            <button type="button" class="stat-edit-btn" data-signal-edit="${escapeAttribute(signalId)}" aria-label="Edit signal">✎</button>
            <button type="button" class="stat-remove-btn" data-signal-remove="${escapeAttribute(signalId)}" aria-label="Remove signal">✕</button>
          </span>
        ` : ""}
      </button>
    `;
  }

  return `
    <article class="terminal-stat"${signalIdAttr}${signalAccentAttr}>
      ${content}
      ${signalId ? `
        <span class="stat-actions">
          <button type="button" class="stat-edit-btn" data-signal-edit="${escapeAttribute(signalId)}" aria-label="Edit signal">✎</button>
          <button type="button" class="stat-remove-btn" data-signal-remove="${escapeAttribute(signalId)}" aria-label="Remove signal">✕</button>
        </span>
      ` : ""}
    </article>
  `;
}

function renderTimelineItem(
  item: TimelineItem,
  viewId = "",
  sectionIndex = 0,
  itemIndex = 0,
): string {
  const rowCommand = item.link?.command ?? "";
  const link = item.link?.href
    ? `<a class="inline-link timeline-link" href="${escapeAttribute(item.link.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.link.label)}</a>`
    : "";
  const rowCommandAttr = rowCommand
    ? ` data-command="${escapeAttribute(rowCommand)}" tabindex="0" role="button"`
    : "";
  const rowClass = rowCommand ? "timeline-item is-clickable" : "timeline-item";
  const baseKey = `view:${viewId}:s${sectionIndex}:t${itemIndex}`;
  return `
    <article class="${rowClass}"${rowCommandAttr}>
      <div class="timeline-marker" aria-hidden="true"></div>
      <div class="record-topline">
        <p>
          ${editWrap(`${baseKey}:role`, `<strong data-edit-key="${escapeAttribute(`${baseKey}:role`)}">${escapeHtml(item.role)}</strong>`, false)}
          ${editWrap(`${baseKey}:company`, `<span data-edit-key="${escapeAttribute(`${baseKey}:company`)}">${escapeHtml(item.company)}</span>`, false)}
        </p>
        <div class="record-meta">
          ${editWrap(`${baseKey}:location`, `<span data-edit-key="${escapeAttribute(`${baseKey}:location`)}">${escapeHtml(item.location)}</span>`, false)}
          ${editWrap(`${baseKey}:period`, `<span data-edit-key="${escapeAttribute(`${baseKey}:period`)}">${escapeHtml(item.period)}</span>`, false)}
        </div>
      </div>
      ${editWrap(`${baseKey}:summary`, `<p class="record-summary" data-edit-key="${escapeAttribute(`${baseKey}:summary`)}">${escapeHtml(item.summary)}</p>`)}
      ${link}
      <ul class="output-list">
        ${item.bullets.map((bullet, bulletIndex) => editWrap(`${baseKey}:b${bulletIndex}`, `<li data-edit-key="${escapeAttribute(`${baseKey}:b${bulletIndex}`)}">${escapeHtml(bullet)}</li>`)).join("")}
      </ul>
    </article>
  `;
}

function renderTagGroup(group: TagGroup): string {
  const categorySlug = entitySlug(group.title);
  return `
    <article class="output-record output-record-compact">
      <p class="record-title"><button type="button" class="category-link" data-command="skill --cat ${escapeAttribute(categorySlug)}" data-entity-type="skill-category" data-entity-slug="${escapeAttribute(categorySlug)}" data-entity-title="${escapeAttribute(group.title)}">${escapeHtml(group.title)}</button></p>
      ${group.note ? `<p class="record-summary">${escapeHtml(group.note)}</p>` : ""}
      <div class="tag-list">
        ${group.items
          .map((item) => {
            const skill = splitSkillLabel(item);
            const slug = entitySlug(skill.name);
            const yearsAttr = skill.years
              ? ` data-entity-years="${escapeAttribute(skill.years)}"`
              : "";
            return `<button type="button" class="action-chip action-chip--skill" data-command="skill ${escapeAttribute(slug)}" data-entity-type="skill" data-entity-slug="${escapeAttribute(slug)}" data-entity-title="${escapeAttribute(skill.name)}"${yearsAttr}><span class="skill-chip-label">${escapeHtml(skill.name)}</span>${skill.years ? `<span class="skill-chip-years">${escapeHtml(skill.years)}</span>` : ""}</button>`;
          })
          .join("")}
      </div>
    </article>
  `;
}

function renderProjectCard(project: ProjectCard): string {
  const clickableClass = project.command ? " project-card is-clickable" : "";
  const commandAttr = project.command
    ? ` data-command="${escapeAttribute(project.command)}"`
    : "";
  const projectSlug = entitySlug(project.name);
  const entityAttrs = ` data-entity-type="project" data-entity-slug="${escapeAttribute(projectSlug)}" data-entity-title="${escapeAttribute(project.name)}" data-entity-context="view:projects"`;
  return `
    <article class="output-record${clickableClass}"${commandAttr}${entityAttrs}>
      <div class="record-topline">
        <p>
          <strong>${escapeHtml(project.name)}</strong>
        </p>
        <div class="record-meta">
          <span>${escapeHtml(project.period)}</span>
        </div>
      </div>
      <p class="record-summary">${escapeHtml(project.summary)}</p>
      <ul class="output-list">
        ${project.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
      </ul>
      ${
        project.link
          ? `
            <a class="inline-link" href="${escapeAttribute(project.link.href)}" target="_blank" rel="noreferrer">
              ${escapeHtml(project.link.label)}
            </a>
          `
          : ""
      }
    </article>
  `;
}

function renderContactCard(item: ContactCard): string {
  const content = `
    <p class="record-title">${escapeHtml(item.label)}</p>
    <p class="record-summary">${escapeHtml(item.value)}</p>
  `;

  if (item.href) {
    return `
      <a class="output-record output-record-compact" href="${escapeAttribute(item.href)}" target="_blank" rel="noreferrer">
        ${content}
      </a>
    `;
  }

  return `<article class="output-record output-record-compact">${content}</article>`;
}

function renderCommandHelpItem(item: CommandHelpItem): string {
  const tagList = item.tags?.length
    ? item.tags
    : (COMMAND_TAGS[item.name] ?? []);
  const tagRow =
    tagList.length > 0
      ? `<div class="command-help-tags" aria-label="Tags">
          ${tagList.map((t) => renderTagChip(t, true)).join("")}
        </div>`
      : "";
  return `
    <article
      class="command-card is-clickable"
      data-command="man ${escapeAttribute(item.name)}"
      data-prepopulate-command="${escapeAttribute(item.name)}"
    >
      <div class="command-copy">
        <button class="command-name" type="button" data-command="man ${escapeAttribute(item.name)}" data-prepopulate-command="${escapeAttribute(item.name)}">/${escapeHtml(item.name)}</button>
        <p class="command-desc">${escapeHtml(item.description)}</p>
        ${tagRow}
      </div>
      <div class="command-meta">
        <code>${escapeHtml(item.usage)}</code>
      </div>
    </article>
  `;
}

function renderPdfPreview(preview: PdfPreview): string {
  return `
    <a class="pdf-thumb" href="${escapeAttribute(preview.href)}" target="_blank" rel="noreferrer">
      <img src="${escapeAttribute(preview.image)}" alt="${escapeAttribute(preview.label)} preview" loading="lazy" />
      <span>${escapeHtml(preview.label)}</span>
    </a>
  `;
}

function renderActions(
  actions: ViewAction[],
  className: string,
  viewId = "",
): string {
  return `
    <div class="${className}">
      ${actions.map(renderAction).join("")}
      <button type="button" class="add-quick-link-btn" data-add-entity-type="link" data-add-entity-context="view:${escapeAttribute(viewId)}" aria-label="Add quick link" title="Add quick link">+</button>
    </div>
  `;
}

function renderTraceSection(traceHtml: string, label: string): string {
  return `
    <details class="pretty-thinking" open>
      <summary><span class="pretty-thinking-chevron">&gt;</span> <span class="pretty-thinking-label">${escapeHtml(label)}</span></summary>
      <div class="pretty-thinking-body">${traceHtml}</div>
    </details>
  `;
}

function renderAction(action: ViewAction): string {
  if (action.command) {
    return `
      <button class="action-chip" type="button" data-command="${escapeAttribute(action.command)}" data-entity-type="command" data-entity-slug="${escapeAttribute(action.command.split(/\s+/)[0] ?? action.command)}" data-entity-title="/${escapeAttribute(action.command)}">
        /${escapeHtml(action.command)}
      </button>
    `;
  }

  if (action.href) {
    return `
      <a
        class="action-chip"
        href="${escapeAttribute(action.href)}"
        data-entity-type="link"
        data-entity-slug="${escapeAttribute(entitySlug(action.label || action.href))}"
        data-entity-title="${escapeAttribute(action.label)}"
        data-entity-url="${escapeAttribute(action.href)}"
        ${action.external ? 'target="_blank" rel="noreferrer"' : ""}
      >
        ${escapeHtml(action.label)}
      </a>
    `;
  }

  return "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
