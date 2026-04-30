import { COMMAND_TAGS } from '../data/content-tags';
import { resumeData } from '../data/resume';
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
} from './types';

type ShellRenderOptions = {
  featuredCommands: CommandDefinition[];
};

export function renderShell({ featuredCommands }: ShellRenderOptions): string {
  const labels = new Map<string, string>([
    ['about', 'About'],
    ['resume', 'Resume'],
    ['timeline', 'Timeline'],
    ['projects', 'Projects'],
    ['skills', 'Skills'],
    ['posts', 'Posts'],
    ['links', 'Links'],
    ['contact', 'Contact'],
    ['pdf', 'PDF'],
    ['chat', 'Chat'],
  ]);

  const navSequence = [
    'about',
    'resume',
    'projects',
    'posts',
    'links',
    'contact',
    'pdf',
    'chat',
  ] as const;
  const featuredByName = new Map(featuredCommands.map((command) => [command.name, command]));
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
    .join('');
  const rssNavButton = `
    <a class="nav-link nav-link-icon" href="/api/rss" target="_blank" rel="noopener noreferrer" aria-label="RSS feed">
      <span aria-hidden="true">◔</span>
    </a>
  `;

  return `
    <canvas class="field-canvas" id="field-canvas" aria-hidden="true"></canvas>
    <div class="parallax-grid" aria-hidden="true"></div>
    <div class="ambient-noise" aria-hidden="true"></div>
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
          <div class="terminal-controls">
            <button class="window-button is-close" type="button" data-window-action="shutdown" aria-label="Shutdown terminal"></button>
            <button class="window-button is-minimize" type="button" data-window-action="minimize" aria-label="Minimize terminal"></button>
            <button class="window-button is-maximize" type="button" data-window-action="maximize" aria-label="Maximize terminal"></button>
          </div>
          <div class="terminal-state">
            <span id="route-indicator">resume</span>
            <button id="theme-indicator" type="button" aria-haspopup="dialog" aria-expanded="false">palette:auto</button>
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
          <button class="ghost-button" type="button" data-command="clear">clear</button>
        </header>

        <div class="terminal-body crt-text">
          <div class="terminal-output terminal-text">
            <div class="banner-line">
              <span class="prompt-prefix" id="terminal-prompt-label">guest@pecunies:~$</span>
              <span class="banner-command" id="prompt-scramble" data-scramble>${escapeHtml(resumeData.commandBanner)}</span>
            </div>

            <div class="terminal-status" id="status-scramble" data-scramble>
              ${escapeHtml(resumeData.statement)}
            </div>

            <article class="viewer-panel" id="active-view"></article>
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
                <option value="@cf/meta/llama-3.1-8b-instruct">@cf/meta/llama-3.1-8b-instruct</option>
                <option value="@cf/meta/llama-3.1-70b-instruct">@cf/meta/llama-3.1-70b-instruct</option>
                <option value="@cf/qwen/qwen1.5-14b-chat-awq">@cf/qwen/qwen1.5-14b-chat-awq</option>
              </select>
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
      <button class="terminal-dock is-active" id="terminal-dock" type="button" aria-label="Minimize terminal window">
        <span></span>
        Terminal
      </button>
    </div>
  `;
}

export function renderLog(lines: SessionLine[]): string {
  return lines
    .map((line) => {
      if (line.kind === 'command') {
        return `
          <li class="log-line log-line-command">
            <span class="log-prefix">guest@pecunies:~$</span>
            <span class="log-copy">${escapeHtml(line.text)}</span>
          </li>
        `;
      }

      if (line.kind === 'system') {
        return `
          <li class="log-line log-line-system is-${escapeAttribute(line.tone)}">
            <span class="log-label">[${escapeHtml(line.label)}]</span>
            <span class="log-copy">${escapeHtml(line.text)}</span>
          </li>
        `;
      }

      if (line.kind === 'pretty-response') {
        const modelHeader = line.model
          ? `<div class="pretty-output-meta"><span class="pretty-output-model">${escapeHtml(line.model)}</span></div>`
          : '';
        const copyButton = line.copyable
          ? `<button class="pretty-copy-button" type="button" data-copy-pretty-id="${escapeAttribute(line.id)}" aria-label="Copy AI response">Copy</button>`
          : '';
        return `
          <li class="log-line log-line-pretty">
            <div class="pretty-output-shell">
              ${modelHeader}
              <div class="pretty-output markdown-body">${line.html}</div>
              ${copyButton ? `<div class="pretty-output-actions">${copyButton}</div>` : ''}
            </div>
          </li>
        `;
      }

      if (line.kind === 'view') {
        return `
          <li class="log-line log-line-view">
            ${line.html}
          </li>
        `;
      }

      return `
        <li class="log-line log-line-response is-${escapeAttribute(line.tone)}">
          <span class="log-label">&gt;</span>
          <span class="log-copy">${escapeHtml(line.text)}</span>
        </li>
      `;
    })
    .join('');
}

export function renderView(view: ViewDefinition): string {
  const actionsMarkup = view.actions?.length ? renderActions(view.actions, 'view-actions') : '';
  const sectionsMarkup = view.sections.map(renderSection).join('');

  return `
    <div class="terminal-view is-live">
      <header class="terminal-view-head">
        <div class="terminal-view-meta">
          <span class="terminal-kicker">${escapeHtml(view.eyebrow)}</span>
          <code>${escapeHtml(view.prompt)}</code>
        </div>
        <h1 class="terminal-title">${escapeHtml(view.title)}</h1>
        <p class="terminal-copy">${escapeHtml(view.description)}</p>
        ${view.note ? `<p class="terminal-note">${escapeHtml(view.note)}</p>` : ''}
        ${
          view.tags?.length
            ? `<div class="view-tag-row" aria-label="Content tags">
                ${view.tags
                  .map(
                    (tag) =>
                      `<button type="button" class="content-tag" data-command="tags ${escapeAttribute(tag)}">#${escapeHtml(tag)}</button>`,
                  )
                  .join('')}
              </div>`
            : ''
        }
        ${actionsMarkup}
      </header>

      <div class="terminal-section-stack">
        ${sectionsMarkup}
      </div>
    </div>
  `;
}

function renderSection(section: TerminalSection): string {
  switch (section.type) {
    case 'paragraphs':
      return `
        <section class="output-block">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
          <div class="output-copy">
            ${section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
          </div>
        </section>
      `;

    case 'metrics':
      return `
        <section class="output-block">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
          <div class="terminal-stat-grid">
            ${section.items.map(renderStat).join('')}
          </div>
        </section>
      `;

    case 'timeline':
      return `
        <section class="output-block">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
          <div class="output-records">
            ${section.items.map(renderTimelineItem).join('')}
          </div>
        </section>
      `;

    case 'tag-groups':
      return `
        <section class="output-block">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
          <div class="output-grid">
            ${section.groups.map(renderTagGroup).join('')}
          </div>
        </section>
      `;

    case 'projects':
      return `
        <section class="output-block">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
          <div class="output-records">
            ${section.items.map(renderProjectCard).join('')}
          </div>
        </section>
      `;

    case 'contact':
      return `
        <section class="output-block">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
          <div class="output-grid">
            ${section.items.map(renderContactCard).join('')}
          </div>
        </section>
      `;

    case 'education':
      return `
        <section class="output-block">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
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
              ${section.item.highlights.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join('')}
            </ul>
          </article>
        </section>
      `;

    case 'command-list':
      return `
        <section class="output-block">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
          <div class="command-list">
            ${section.items.map(renderCommandHelpItem).join('')}
          </div>
        </section>
      `;

    case 'pdf':
      return `
        <section class="output-block pdf-panel">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
          <p class="terminal-copy">${escapeHtml(section.summary)}</p>
          <div class="pdf-layout">
            <div class="pdf-preview-strip">
              ${section.previews.map(renderPdfPreview).join('')}
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

    case 'note':
      return `
        <section class="output-block note-panel">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
          <div class="output-copy">
            ${section.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
          </div>
        </section>
      `;

    case 'tag-index':
      return `
        <section class="output-block tag-index-panel">
          <h2 class="output-heading">${escapeHtml(section.heading)}</h2>
          ${
            section.description
              ? `<p class="terminal-copy tag-index-desc">${escapeHtml(section.description)}</p>`
              : ''
          }
          ${
            section.filter
              ? `<p class="tag-index-active">Filtering: <strong>#${escapeHtml(section.filter)}</strong></p>`
              : ''
          }
          <div class="tag-cloud" role="list">
            ${section.allTags
              .map(
                (t) => `
              <button type="button" class="tag-cloud-chip" data-command="tags ${escapeAttribute(t.slug)}" role="listitem">
                <span class="tag-cloud-name">#${escapeHtml(t.slug)}</span>
                <span class="tag-cloud-count">${t.count}</span>
              </button>`,
              )
              .join('')}
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
              .join('')}
          </div>
        </section>
      `;
  }
}

function renderStat(stat: ViewStat): string {
  const content = `
    <span>${escapeHtml(stat.label)}</span>
    <strong>${escapeHtml(stat.value)}</strong>
    ${stat.detail ? `<small>${escapeHtml(stat.detail)}</small>` : ''}
  `;

  if (stat.command) {
    return `
      <button class="terminal-stat" type="button" data-command="${escapeAttribute(stat.command)}">
        ${content}
      </button>
    `;
  }

  return `
    <article class="terminal-stat">
      ${content}
    </article>
  `;
}

function renderTimelineItem(item: TimelineItem): string {
  return `
    <article class="output-record">
      <div class="record-topline">
        <p>
          <strong>${escapeHtml(item.role)}</strong>
          <span>${escapeHtml(item.company)}</span>
        </p>
        <div class="record-meta">
          <span>${escapeHtml(item.location)}</span>
          <span>${escapeHtml(item.period)}</span>
        </div>
      </div>
      <p class="record-summary">${escapeHtml(item.summary)}</p>
      <ul class="output-list">
        ${item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}
      </ul>
    </article>
  `;
}

function renderTagGroup(group: TagGroup): string {
  return `
    <article class="output-record output-record-compact">
      <p class="record-title">${escapeHtml(group.title)}</p>
      ${group.note ? `<p class="record-summary">${escapeHtml(group.note)}</p>` : ''}
      <div class="tag-list">
        ${group.items.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
      </div>
    </article>
  `;
}

function renderProjectCard(project: ProjectCard): string {
  return `
    <article class="output-record">
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
        ${project.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}
      </ul>
      ${
        project.link
          ? `
            <a class="inline-link" href="${escapeAttribute(project.link.href)}" target="_blank" rel="noreferrer">
              ${escapeHtml(project.link.label)}
            </a>
          `
          : ''
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
  const tagList = item.tags?.length ? item.tags : COMMAND_TAGS[item.name] ?? [];
  const tagRow =
    tagList.length > 0
      ? `<div class="command-help-tags" aria-label="Tags">
          ${tagList
            .map(
              (t) =>
                `<button type="button" class="content-tag content-tag--compact" data-command="tags ${escapeAttribute(t)}">#${escapeHtml(t)}</button>`,
            )
            .join('')}
        </div>`
      : '';
  return `
    <article class="command-card">
      <div class="command-copy">
        <p class="command-name">/${escapeHtml(item.name)}</p>
        <p class="command-desc">${escapeHtml(item.description)}</p>
        ${tagRow}
      </div>
      <div class="command-meta">
        <code>${escapeHtml(item.usage)}</code>
        <button
          class="ghost-button"
          type="button"
          data-command="man ${escapeAttribute(item.name)}"
          data-prepopulate-command="${escapeAttribute(item.name)}"
        >
          man
        </button>
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

function renderActions(actions: ViewAction[], className: string): string {
  return `
    <div class="${className}">
      ${actions.map(renderAction).join('')}
    </div>
  `;
}

function renderAction(action: ViewAction): string {
  if (action.command) {
    return `
      <button class="action-chip" type="button" data-command="${escapeAttribute(action.command)}">
        /${escapeHtml(action.command)}
      </button>
    `;
  }

  if (action.href) {
    return `
      <a
        class="action-chip"
        href="${escapeAttribute(action.href)}"
        ${action.external ? 'target="_blank" rel="noreferrer"' : ''}
      >
        ${escapeHtml(action.label)}
      </a>
    `;
  }

  return '';
}

/** Shell for CodeMirror + vim (mounted from TerminalApp). */
export function renderEditor({ file, content }: { file: string; content: string }): string {
  const lines = content.split('\n').length;
  return `
    <div class="editor-container">
      <div class="editor-header">
        <span class="editor-file">${escapeHtml(file)}</span>
        <span class="editor-hints">Vim keys &middot; Ctrl+S save &middot; Esc close</span>
      </div>
      <div
        class="editor-codemirror-root"
        aria-label="Edit ${escapeHtml(file)}"
        data-initial-lines="${lines}"
      ></div>
      <div class="editor-status">${lines} lines</div>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
