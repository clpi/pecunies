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
    ['resume', 'Resume'],
    ['experience', 'Work'],
    ['skills', 'Skills'],
    ['projects', 'Projects'],
    ['contact', 'Contact'],
    ['pdf', 'PDF'],
    ['chat', 'Chat'],
  ]);

  const navOrder = new Set(['resume', 'experience', 'skills', 'projects', 'contact', 'pdf', 'chat']);
  const navLinks = featuredCommands
    .filter((command) => navOrder.has(command.name))
    .map(
      (command) => `
        <button class="nav-link" type="button" data-command="${escapeAttribute(command.name)}">
          ${escapeHtml(labels.get(command.name) ?? command.name)}
        </button>
      `,
    )
    .join('');

  return `
    <canvas class="field-canvas" id="field-canvas" aria-hidden="true"></canvas>
    <div class="ambient-noise" aria-hidden="true"></div>
    <div class="scanlines" aria-hidden="true"></div>

    <header class="site-nav" aria-label="Primary navigation">
      <button class="brand-mark" type="button" data-command="resume">
        <span class="brand-dot" aria-hidden="true"></span>
        <span>${escapeHtml(resumeData.name)}</span>
      </button>
      <nav class="nav-links" aria-label="Portfolio sections">
        ${navLinks}
      </nav>
    </header>

    <div class="site-shell">
      <section class="terminal-shell" id="terminal-shell">
        <header class="terminal-header">
          <div class="terminal-controls" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="terminal-state">
            <span id="route-indicator">~/resume</span>
            <span id="theme-indicator">palette:auto</span>
          </div>
          <button class="ghost-button" type="button" data-command="clear">clear</button>
        </header>

        <div class="terminal-body">
          <div class="terminal-output">
            <div class="banner-line">
              <span class="prompt-prefix" id="terminal-prompt-label">chris@pecunies:~$</span>
              <span class="banner-command" id="prompt-scramble" data-scramble>${escapeHtml(resumeData.commandBanner)}</span>
            </div>

            <div class="terminal-status" id="status-scramble" data-scramble>
              ${escapeHtml(resumeData.statement)}
            </div>

            <article class="viewer-panel" id="active-view"></article>
            <ol class="terminal-log" id="terminal-log" aria-live="polite"></ol>
          </div>

          <div class="autocomplete-panel" id="autocomplete-panel" hidden>
            <div class="autocomplete-list" id="autocomplete-list"></div>
          </div>

          <div class="terminal-prompt-bar">
            <form class="terminal-form" id="terminal-form" autocomplete="off">
              <label class="sr-only" for="terminal-input">Terminal command input</label>
              <span class="prompt-prefix">chris@pecunies:~$</span>
              <input
                class="terminal-input"
                id="terminal-input"
                name="command"
                type="text"
                spellcheck="false"
                placeholder="help"
                aria-label="Type a command"
              />
              <button class="submit-button" type="submit">Run</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  `;
}

export function renderLog(lines: SessionLine[]): string {
  return lines
    .map((line) => {
      if (line.kind === 'command') {
        return `
          <li class="log-line log-line-command">
            <span class="log-prefix">chris@pecunies:~$</span>
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
  }
}

function renderStat(stat: ViewStat): string {
  return `
    <article class="terminal-stat">
      <span>${escapeHtml(stat.label)}</span>
      <strong>${escapeHtml(stat.value)}</strong>
      ${stat.detail ? `<small>${escapeHtml(stat.detail)}</small>` : ''}
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
  return `
    <article class="command-card">
      <div class="command-copy">
        <p class="command-name">/${escapeHtml(item.name)}</p>
        <p class="command-desc">${escapeHtml(item.description)}</p>
      </div>
      <div class="command-meta">
        <code>${escapeHtml(item.usage)}</code>
        <button class="ghost-button" type="button" data-command="${escapeAttribute(item.command)}">run</button>
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
