# Terminal Features Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add 8 new features to the Pecunies terminal portfolio: head command, vim-like editor, open command, /etc themes folder, ~ shorthand, window title fix, active navbar coloring, and SVG logo.

**Architecture:** Frontend-only changes in app.ts, registry.ts, types.ts, render.ts, style.css, palette.ts, and index.html. Backend additions in os.js for head command and /etc/themes directory. The /edit command creates a new interactive editor view; /open is a smart router command.

**Tech Stack:** TypeScript frontend, Cloudflare Pages Functions (Node.js), CSS custom properties for theming.

---

### Task 1: Add `head` command (backend)

**Objective:** Add a `headFile` function in os.js and wire it into the command switch, mirroring `tailFile` but for first N lines.

**Files:**
- Modify: `functions/api/os.js`

**Changes:**

In the switch statement (~line 467), add after `case 'tail':`:
```js
    case 'head':
      return headFile(parsed.args, state, env);
```

Add function (after `tailFile`, ~line 1434):
```js
async function headFile(args, state, env) {
  const path = args.find((a) => !a.startsWith('-'));
  if (!path) return { output: 'Usage: head [-n N] <path>', status: 400 };
  const n = args.includes('-n') ? Number(args[args.indexOf('-n') + 1]) || 10 : 10;
  const normalized = normalizePath(path);
  const content = await readFile(normalized, env);
  if (content === null || content === undefined) return { output: `head: ${path}: no such file`, status: 404 };
  const lines = content.split('\n');
  return { output: lines.slice(0, n).join('\n') };
}
```

Add to MANUALS (~line 253):
```js
  head: 'head [-n N] <path>\nShow the first N lines of a file. Defaults to 10 lines.',
```

---

### Task 2: Add `head` command (frontend)

**Objective:** Register `/head` as an OS command with autocomplete support.

**Files:**
- Modify: `src/terminal/app.ts`
- Modify: `src/terminal/registry.ts`

**Changes in registry.ts** (near line 1122, after tail):
```typescript
  addOsCommand('head', {
    usage: 'head [-n N] <path>',
    group: 'OS',
    featured: false,
    description: 'Print the first N lines of a file (default 10).',
  });
```

**Changes in app.ts:**
- Add `'head'` to `ARG_COMMANDS` set (line 49-74)
- Add to autocomplete paths in `argumentSuggestions` (near line 912, alongside tail/less):
```typescript
    if (commandName === 'tail' || commandName === 'less' || commandName === 'head') {
```

---

### Task 3: Add `/edit` command with vim-like editor view

**Objective:** Create an interactive text editor that opens in the terminal view panel when `/edit <file>` is called. Supports syntax highlighting, saving via Ctrl+S, and escape to quit.

**Files:**
- Modify: `src/terminal/types.ts` — add new outcome kind
- Modify: `src/terminal/registry.ts` — add edit command
- Modify: `src/terminal/app.ts` — handle editor mode
- Modify: `src/terminal/render.ts` — render editor HTML
- Modify: `src/style.css` — editor styles

**Changes in types.ts:**
Add to `CommandOutcome` union:
```typescript
  | { kind: 'editor'; file: string; content: string; tone?: LogTone }
```

Add `EditorOutcome` type for the editor result:
No new type needed — the editor is handled within the app.

**Changes in registry.ts:**
```typescript
  commands.push({
    name: 'edit',
    aliases: ['vim', 'vi', 'nvim', 'nano'],
    usage: 'edit <path>',
    group: 'OS',
    featured: false,
    description: 'Open a vim-like text editor for a portfolio OS file.',
    execute(_context, args, raw) {
      const file = args[0];
      if (!file) {
        return { kind: 'system', text: 'Usage: edit <path>', tone: 'warn' };
      }
      // Will fetch content in app.ts when handling the outcome
      return { kind: 'editor', file, content: '', tone: 'info' };
    },
  });
```

**Changes in app.ts:**

Add editor state fields to class:
```typescript
  private editorFile: string | null = null;
  private editorContent: string = '';
  private editorElement: HTMLTextAreaElement | null = null;
```

In `applyOutcome`, handle `editor` kind (~line 590):
```typescript
    if (outcome.kind === 'editor') {
      this.chatMode = false;
      this.gameMode = null;
      this.pendingPrompt = null;
      this.editorFile = outcome.file;
      this.promptLabel.textContent = `edit:${outcome.file}>`;
      this.routeIndicator.textContent = `edit ${outcome.file}`;
      this.themeIndicator.textContent = 'editor';
      this.lines.push(this.responseLine(`Editing ${outcome.file}. Ctrl+S to save, Esc to close.`, outcome.tone ?? 'info'));

      // Fetch file content from OS
      void this.loadEditorContent(outcome.file);
      return;
    }
```

Add methods:
```typescript
  private async loadEditorContent(file: string): Promise<void> {
    try {
      const response = await fetch('/api/os', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId, command: `cat ${file}` }),
      });
      const payload = await response.json() as OsResponse;
      this.editorContent = payload.output ?? '';
    } catch {
      this.editorContent = '';
    }
    this.renderEditor();
  }

  private renderEditor(): void {
    this.viewElement.innerHTML = renderEditor({
      file: this.editorFile ?? '',
      content: this.editorContent,
    });
    this.editorElement = this.viewElement.querySelector('.editor-textarea');
    this.editorElement?.focus();

    // Ctrl+S to save
    this.editorElement?.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        void this.saveEditor();
      }
      if (e.key === 'Escape') {
        this.closeEditor();
      }
    });
  }

  private async saveEditor(): Promise<void> {
    if (!this.editorFile || !this.editorElement) return;
    const content = this.editorElement.value;
    try {
      await fetch('/api/os', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          command: `write ${this.editorFile} ${encodeURIComponent(content)}`,
        }),
      });
      this.lines.push(this.responseLine(`Saved ${this.editorFile}.`, 'success'));
    } catch {
      this.lines.push(this.responseLine(`Failed to save ${this.editorFile}.`, 'warn'));
    }
    this.renderLog();
    this.editorElement?.focus();
  }

  private closeEditor(): void {
    this.editorFile = null;
    this.editorContent = '';
    this.editorElement = null;
    this.promptLabel.textContent = 'chris@pecunies:~$';
    this.viewElement.innerHTML = '';
    this.routeIndicator.textContent = '~';
    this.themeIndicator.textContent = 'palette:auto';
    this.inputElement.focus();
  }
```

In `parseCommand`, prevent editor input from being parsed as commands when in editor mode:
In `execute`, add early-return check:
```typescript
    if (this.editorFile) {
      // In editor mode, don't parse commands; let the editor handle input
      this.inputElement.focus();
      return;
    }
```

**Changes in render.ts:**
Add function:
```typescript
type EditorRenderOptions = { file: string; content: string };

export function renderEditor({ file, content }: EditorRenderOptions): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  return `
    <div class="editor-container">
      <div class="editor-header">
        <span class="editor-file">${escapeHtml(file)}</span>
        <span class="editor-hints">Ctrl+S save · Esc close</span>
      </div>
      <textarea
        class="editor-textarea"
        spellcheck="false"
        aria-label="Edit ${escapeHtml(file)}"
        data-lang="${escapeAttribute(ext)}"
      >${escapeHtml(content)}</textarea>
      <div class="editor-status">${content.split('\n').length} lines</div>
    </div>
  `;
}
```

**Changes in style.css:**
```css
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 400px;
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
  font-size: 0.72rem;
}

.editor-file {
  color: var(--accent);
  font-weight: 600;
}

.editor-hints {
  color: var(--muted);
  font-size: 0.65rem;
}

.editor-textarea {
  flex: 1;
  padding: 12px;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1.55;
  border: 0;
  outline: none;
  resize: none;
  tab-size: 2;
}

.editor-textarea:focus {
  background: rgba(255, 255, 255, 0.015);
}

.editor-status {
  padding: 4px 12px;
  background: var(--panel);
  border-top: 1px solid var(--line);
  font-size: 0.65rem;
  color: var(--muted);
}
```

---

### Task 4: Add `/open` smart opener command

**Objective:** `/open <path>` intelligently routes: .md files → less (with markdown rendering), man pages → man, code files → edit, posts → edit, URLs → window.open, directories → ls.

**Files:**
- Modify: `src/terminal/registry.ts`
- Modify: `src/terminal/app.ts`

**Changes in registry.ts:**
```typescript
  commands.push({
    name: 'open',
    aliases: ['xdg-open', 'launch'],
    usage: 'open <path|url>',
    group: 'Utility',
    featured: true,
    description: 'Open a file, directory, or URL with the appropriate handler.',
    execute(_context, args) {
      const target = args[0];
      if (!target) {
        return { kind: 'system', text: 'Usage: open <path|url>', tone: 'warn' };
      }

      // URL detection
      if (/^(https?:|mailto:|ftp:)/.test(target)) {
        return { kind: 'system', text: `Opening ${target} in new tab...`, tone: 'info' };
        // Note: actual window.open is handled in app.ts via a special mechanism
      }

      // Directory detection (trailing slash or known dirs)
      const normalized = target.replace(/\/$/, '');
      if (DIRECTORY_PATHS.includes(normalized + '/') || DIRECTORY_PATHS.includes(normalized)) {
        return { kind: 'os', command: `ls ${target}` };
      }

      // Post files
      if (target.startsWith('/posts/') || target.startsWith('posts/')) {
        return { kind: 'editor', file: target.startsWith('/') ? target : '/' + target, content: '', tone: 'info' };
      }

      // Markdown files — view with less-style rendering
      if (target.endsWith('.md')) {
        return { kind: 'os', command: `cat --pretty ${target}` };
      }

      // man pages — open man
      if (target.startsWith('/system/man') || target === 'man.txt') {
        return { kind: 'os', command: `cat ${target}` };
      }

      // Code files (by extension) → edit
      const codeExts = ['.ts', '.js', '.py', '.go', '.rs', '.zig', '.sh', '.json', '.css', '.html', '.c', '.cpp', '.java', '.rb', '.lua', '.nix', '.yaml', '.yml', '.toml', '.xml'];
      if (codeExts.some((ext) => target.endsWith(ext))) {
        return { kind: 'editor', file: target.startsWith('/') ? target : '/' + target, content: '', tone: 'info' };
      }

      // Default: try to cat the file
      return { kind: 'os', command: `cat --pretty ${target}` };
    },
  });
```

**Changes in app.ts:**
In `applyOutcome`, for system outcomes that are URL opens, detect them:
```typescript
    if (outcome.kind === 'system') {
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? 'info'));
      // Handle URL open
      if (outcome.text.startsWith('Opening ') && outcome.text.includes('new tab')) {
        const url = outcome.text.match(/Opening (.+) in new tab/)?.[1];
        if (url) window.open(url, '_blank', 'noopener');
      }
      // ...
    }
```

Add DIRECTORY_PATHS to the top of registry.ts (already defined in app.ts but need to import or duplicate the list).

Actually, let's simplify — make open detect URLs client-side and use a new outcome `{ kind: 'url', url: string }`:

In `types.ts`:
```typescript
  | { kind: 'url'; url: string; text: string; tone?: LogTone }
```

In registry.ts open execute:
```typescript
      if (/^(https?:|mailto:|ftp:)/.test(target)) {
        return { kind: 'url', url: target, text: `Opening ${target} in new tab...`, tone: 'info' };
      }
```

In app.ts `applyOutcome`:
```typescript
    if (outcome.kind === 'url') {
      window.open(outcome.url, '_blank', 'noopener');
      this.lines.push(this.responseLine(outcome.text, outcome.tone ?? 'info'));
      return;
    }
```

---

### Task 5: Add `/etc` folder and `/etc/themes` with theme JSON files

**Objective:** Add `/etc` and `/etc/themes` directories (sudo protected) containing theme definition JSON files.

**Files:**
- Modify: `functions/api/os.js`

**Changes in os.js:**

Add to DIRECTORIES:
```js
  '/etc': ['themes/'],
  '/etc/themes': ['red.json', 'amber.json', 'frost.json', 'ivory.json', 'magenta.json', 'blue.json', 'green.json'],
```

Add to FILES (after the existing entries):
```js
  '/etc/themes/red.json': JSON.stringify({
    name: 'red',
    label: 'Red Signal',
    accent: '#ff6a66',
    accentStrong: '#ff3347',
    accentSoft: 'rgba(255, 106, 102, 0.13)',
    panel: 'rgba(13, 10, 11, 0.58)',
    panelStrong: 'rgba(22, 14, 16, 0.74)',
    text: '#f2eff0',
    muted: '#988f92',
    depth: '#030203',
    mode: 0,
  }, null, 2),
  '/etc/themes/amber.json': JSON.stringify({
    name: 'amber', label: 'Amber Phosphor', accent: '#f5b84b', accentStrong: '#ffd27a',
    accentSoft: 'rgba(245, 184, 75, 0.13)', panel: 'rgba(9, 10, 12, 0.56)',
    panelStrong: 'rgba(14, 15, 17, 0.72)', text: '#eceff1', muted: '#8b9299',
    depth: '#020305', mode: 1,
  }, null, 2),
  '/etc/themes/frost.json': JSON.stringify({
    name: 'frost', label: 'Blue Frost', accent: '#8bcaff', accentStrong: '#5da7ff',
    accentSoft: 'rgba(139, 220, 255, 0.14)', panel: 'rgba(8, 10, 13, 0.55)',
    panelStrong: 'rgba(13, 16, 19, 0.72)', text: '#f0f4f6', muted: '#8c99a3',
    depth: '#020305', mode: 2,
  }, null, 2),
  '/etc/themes/ivory.json': JSON.stringify({
    name: 'ivory', label: 'White Signal', accent: '#f4f7f8', accentStrong: '#ffffff',
    accentSoft: 'rgba(244, 247, 248, 0.12)', panel: 'rgba(10, 10, 11, 0.56)',
    panelStrong: 'rgba(16, 16, 18, 0.72)', text: '#f4f7f8', muted: '#92989d',
    depth: '#020305', mode: 3,
  }, null, 2),
  '/etc/themes/magenta.json': JSON.stringify({
    name: 'magenta', label: 'Magenta Pulse', accent: '#e066ff', accentStrong: '#d633ff',
    accentSoft: 'rgba(224, 102, 255, 0.13)', panel: 'rgba(12, 10, 13, 0.56)',
    panelStrong: 'rgba(18, 14, 19, 0.72)', text: '#f4f0f5', muted: '#9a92a3',
    depth: '#030205', mode: 0,
  }, null, 2),
  '/etc/themes/blue.json': JSON.stringify({
    name: 'blue', label: 'Deep Blue', accent: '#66b3ff', accentStrong: '#3385ff',
    accentSoft: 'rgba(102, 179, 255, 0.13)', panel: 'rgba(8, 10, 14, 0.56)',
    panelStrong: 'rgba(12, 16, 22, 0.72)', text: '#f0f2f6', muted: '#8c96a8',
    depth: '#020305', mode: 2,
  }, null, 2),
  '/etc/themes/green.json': JSON.stringify({
    name: 'green', label: 'Signal Green', accent: '#66ff99', accentStrong: '#33ff77',
    accentSoft: 'rgba(102, 255, 153, 0.13)', panel: 'rgba(9, 12, 10, 0.56)',
    panelStrong: 'rgba(14, 19, 16, 0.72)', text: '#f0f5f2', muted: '#8ca392',
    depth: '#020503', mode: 1,
  }, null, 2),
```

Add `/etc` to the sudo-protected paths. In `catPath`, add protection:
```js
  // /etc/ requires elevated to read
  if (normalized.startsWith('/etc/') && !options.elevated) {
    return { output: `cat: ${normalized}: permission denied; use sudo`, status: 403 };
  }
```

In `listPath`, add /etc protection similarly. In `directoryEntries`, filter out /etc from non-elevated listing.

Add to FILE_PATHS and DIRECTORY_PATHS in app.ts:
- `'/etc'` and `'/etc/themes'` to DIRECTORY_PATHS
- All theme JSON paths to FILE_PATHS
- Add `/etc` and `/etc/themes` to the TAGS `system` category in os.js

---

### Task 6: Add `~` shorthand → `/home`

**Objective:** Replace `~` with `/home` in file paths within command arguments.

**Files:**
- Modify: `src/terminal/app.ts`

**Changes:**

In `parseCommand` method (~line 676), add tilde expansion before splitting:
```typescript
  private parseCommand(rawInput: string): { name: string; args: string[] } {
    // Expand ~ to /home in paths
    const expanded = rawInput.replace(/(?:^|\s)(~)(?:\/|$|\s)/g, (match, tilde, offset) => {
      const before = offset > 0 ? rawInput[offset - 1] : ' ';
      const after = offset + 1 < rawInput.length ? rawInput[offset + 1] : ' ';
      // Replace ~ with /home, preserving the following slash if present
      const rest = match.slice(1); // remove leading space if any
      return (offset > 0 && before !== ' ' ? ' ' : '') + '/home' + (match.endsWith('/') ? '/' : rest.startsWith('~') ? '' : rest.replace('~', ''));
    });
    // Simpler: just replace ~ that appears as a standalone path component
    const tildeExpanded = rawInput.replace(/(?<=^|\s)~(?=\/|\s|$)/g, '/home');
    const normalized = tildeExpanded.replace(/^\//, '').replace(/^\.\//, '').trim();
    const [name = '', ...args] = normalized.split(/\s+/);
    return { name: name.toLowerCase(), args };
  }
```

Also expand `~` in the autocomplete suggestions where paths are used.

---

### Task 7: Fix window title — remove `~/` prefix

**Objective:** The route indicator currently shows `~/resume`; change to just `resume`.

**Files:**
- Modify: `src/terminal/app.ts`

**Changes:**

Search for all instances of `routeIndicator.textContent = ` and remove the `~/` prefix:

Current patterns and replacements:
- `this.routeIndicator.textContent = '~/${outcome.view.route}'` → `this.routeIndicator.textContent = outcome.view.route`
- `this.routeIndicator.textContent = '~/chat'` → `this.routeIndicator.textContent = 'chat'`
- `this.routeIndicator.textContent = '~/${outcome.game}'` → `this.routeIndicator.textContent = outcome.game`
- `this.routeIndicator.textContent = '~'` → `this.routeIndicator.textContent = ''`
- `this.routeIndicator.textContent = 'edit ${outcome.file}'` — keep as-is (already fine)
- In renderShell (render.ts), the initial `~/resume` → `resume`

Changes in app.ts:
- Line 531: `'~/chat'` → `'chat'`
- Line 555: `` `~/${outcome.game}` `` → `` outcome.game ``
- Line 606: `` `~/${outcome.view.route}` `` → `` outcome.view.route ``
- Line 1086: `'~'` → `''`

Changes in render.ts:
- Line 71: `~/resume` → `resume`

---

### Task 8: Active navbar element coloring

**Objective:** When a view is active, highlight its corresponding navbar button with the theme's accent color. When in chat/editor/game mode, no navbar item is highlighted.

**Files:**
- Modify: `src/terminal/app.ts`
- Modify: `src/style.css`

**Changes in app.ts:**

Add a private method `highlightNavLink` and call it whenever the active view changes:
```typescript
  private highlightNavLink(route: string | null): void {
    // Remove active class from all nav links
    this.root.querySelectorAll('.nav-link').forEach((el) => {
      el.classList.remove('is-active');
    });

    if (!route) return;

    // Find and highlight the matching nav link
    const navLink = this.root.querySelector(`.nav-link[data-nav="${route}"]`);
    if (navLink) {
      navLink.classList.add('is-active');
    }
  }
```

Call this in `applyOutcome`:
- For view outcomes: `this.highlightNavLink(outcome.view.route);`
- For chat outcomes: `this.highlightNavLink(null);` (no highlight)
- For game outcomes: `this.highlightNavLink(null);`
- For editor outcomes: `this.highlightNavLink(null);`
- For clear: `this.highlightNavLink(null);`

**Changes in style.css:**
```css
.nav-link.is-active {
  color: var(--accent);
  border-color: var(--line-strong);
  background: var(--accent-soft);
}
```

---

### Task 9: Create SVG logo/favicon

**Objective:** Redesign favicon.svg — a rounded circle matching the brand-dot style, with green inner circle.

**Files:**
- Modify: `public/favicon.svg`

**New content:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0a1a14"/>
      <stop offset="100%" stop-color="#020503"/>
    </radialGradient>
  </defs>
  <!-- Outer rounded square -->
  <rect width="64" height="64" rx="16" fill="url(#bg)"/>
  <!-- Outer ring -->
  <circle cx="32" cy="32" r="18" fill="none" stroke="rgba(102,255,153,0.3)" stroke-width="2"/>
  <!-- Inner green dot matching brand-dot style -->
  <circle cx="32" cy="32" r="7" fill="#66ff99"/>
  <!-- Glow effect -->
  <circle cx="32" cy="32" r="7" fill="none" stroke="#33ff77" stroke-width="1.5" opacity="0.6">
    <animate attributeName="r" values="7;9;7" dur="3s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.6;0.2;0.6" dur="3s" repeatCount="indefinite"/>
  </circle>
  <!-- Outer glow ring -->
  <circle cx="32" cy="32" r="14" fill="none" stroke="#66ff99" stroke-width="0.5" opacity="0.2"/>
</svg>
```

Also add a favicon link for light/dark in index.html if desired. The current index.html already has `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`.

---

### Verification

After implementing all tasks:

1. **Build and test:**
   ```bash
   cd /Users/clp/clp/pecunies && npm run build
   ```

2. **Test each feature:**
   - `/head /README.md` → shows first 10 lines
   - `/head -n 3 /README.md` → shows first 3 lines  
   - `/edit /guest/test.md` → opens editor, Ctrl+S saves, Esc closes
   - `/open https://github.com` → opens in new tab
   - `/open /README.md` → cats with pretty rendering
   - `/open /posts/terminal-portfolio-changelog.md` → opens editor
   - `/open /resume` → ls listing
   - `ls /etc/themes` → requires sudo
   - `sudo ls /etc/themes` → lists theme JSON files
   - `cat ~/test.md` → resolves to `/home/test.md`
   - Window title shows `resume` not `~/resume`
   - Navbar Resume button is accented when resume view is open
   - New favicon visible in browser tab

3. **No regressions:** All existing commands should still work (cat, tail, less, ls, man, games, chat, etc.)
