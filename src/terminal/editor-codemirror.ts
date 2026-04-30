import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { vim } from '@replit/codemirror-vim';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { oneDark } from '@codemirror/theme-one-dark';

function languageForPath(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'md' || ext === 'markdown') {
    return markdown();
  }
  if (ext === 'css' || ext === 'scss') {
    return css();
  }
  if (ext === 'json') {
    return javascript({ jsx: false, typescript: false });
  }
  if (['ts', 'tsx', 'mts', 'cts'].includes(ext)) {
    return javascript({ jsx: ext === 'tsx', typescript: true });
  }
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
    return javascript({ jsx: ext === 'jsx', typescript: false });
  }
  if (['py', 'rs', 'go', 'zig', 'sh', 'bash', 'zsh', 'fish', 'toml', 'yaml', 'yml'].includes(ext)) {
    return javascript({ jsx: false, typescript: false });
  }
  return javascript({ jsx: false, typescript: false });
}

export type CodeMirrorMount = {
  view: EditorView;
  destroy: () => void;
};

export function mountVimEditor(
  host: HTMLElement,
  file: string,
  content: string,
  onDocChange?: () => void,
): CodeMirrorMount {
  const lang = languageForPath(file);
  const state = EditorState.create({
    doc: content,
    extensions: [
      basicSetup,
      oneDark,
      vim(),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          onDocChange?.();
        }
      }),
      lang,
      EditorView.theme({
        '&': { height: 'min(58vh, 520px)', fontSize: '13px' },
        '.cm-scroller': { fontFamily: 'var(--font-mono, monospace)', overflow: 'auto' },
        '.cm-content': { minHeight: '240px', padding: '10px 0' },
        '.cm-gutters': { backgroundColor: 'rgba(0,0,0,0.35)', border: 'none' },
      }),
      EditorView.lineWrapping,
    ],
  });

  const view = new EditorView({ state, parent: host });

  return {
    view,
    destroy: () => {
      view.destroy();
    },
  };
}

export function getEditorText(mount: CodeMirrorMount): string {
  return mount.view.state.doc.toString();
}
