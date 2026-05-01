import type { CommandDefinition } from './types';
import { rankByFuzzyAndFrequency } from './fuzzy-rank';

const LIMIT = 14;

export type UsageSuggestRow = {
  completion: string;
  usage: string;
  description: string;
  commandName?: string;
};

export function usageTail(synopsis: string): string {
  return synopsis.replace(/^\S+\s*/, '').trim();
}

export function commandSynopsisNeedsArgs(synopsis: string): boolean {
  return usageTail(synopsis).length > 0;
}

export function extractFlagsFromUsage(synopsis: string): string[] {
  const spaced = synopsis.replace(/<[^>]+>/g, ' ');
  const out = new Set<string>();

  for (const m of spaced.matchAll(/--[a-zA-Z][\w-]*/g)) {
    const raw = m[0];
    const idx = m.index ?? 0;
    const after = synopsis.slice(idx, idx + raw.length + 2);
    if (after.includes(`${raw}=`) || /\b[a-z]+\s*=\s*</i.test(synopsis.slice(idx))) out.add(`${raw}=`);
    else out.add(raw);
  }

  for (const m of spaced.matchAll(/\[([^\[\]]+)\]/g)) {
    for (const piece of m[1].split('|')) {
      const t = piece.trim();
      if (t.startsWith('--')) {
        const eq = t.indexOf('=');
        if (eq >= 0) out.add(t.slice(0, eq + 1));
        else {
          const word = t.split(/\s+/)[0] ?? '';
          if (word.startsWith('--')) out.add(word);
        }
      } else if (/^-[a-zA-Z0-9](?:\s|$)/.test(`${t} `)) {
        out.add(t.trim().slice(0, 2));
      }
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

export function extractAngleChoices(synopsis: string): string[] {
  const out = new Set<string>();
  for (const m of synopsis.matchAll(/<([^>]+)>/g)) {
    const inner = m[1].trim();
    if (inner.includes('|')) {
      for (const part of inner.split('|')) {
        const t = part.trim();
        if (t && !/[<>]/.test(t)) out.add(t);
      }
    }
  }
  return [...out];
}

/** Choice tokens from [a|b|c] only when bracket contains |. */
export function extractBracketPipeChoices(synopsis: string): string[] {
  const out = new Set<string>();
  for (const m of synopsis.matchAll(/\[([^\[\]]+)\]/g)) {
    const inner = m[1];
    if (!inner.includes('|')) continue;
    for (const piece of inner.split('|')) {
      const t = piece.trim();
      if (t.startsWith('-')) continue;
      const head = t.split(/\s+/)[0] ?? '';
      if (head && /^[a-zA-Z0-9_-]+$/.test(head)) out.add(head);
    }
  }
  return [...out];
}

export function isFilePathCommand(name: string, synopsis: string): boolean {
  if (/path-fragment|source|destination|<\s*path/i.test(synopsis)) return true;
  return ['cat', 'head', 'tail', 'less', 'touch', 'rm', 'source', 'edit', 'mv', 'ln', 'grep', 'find'].includes(
    name,
  );
}

export function isDirPathCommand(name: string, synopsis: string): boolean {
  if (/\[path\]/.test(synopsis) && ['ls', 'cd', 'tree', 'mkdir'].includes(name)) return true;
  return ['ls', 'cd', 'tree', 'mkdir'].includes(name);
}

function buildBase(commandName: string, args: string[], trailingSpace: boolean): string {
  const parts = trailingSpace
    ? [commandName, ...args]
    : [commandName, ...args.slice(0, Math.max(0, args.length - 1))];
  return parts.filter(Boolean).join(' ');
}

function appendToken(base: string, token: string): string {
  const sep = base ? ' ' : '';
  const tail = token.endsWith('=') ? token : `${token} `;
  return `${base}${sep}${tail}`;
}

/** `--flag` / `--opt=` / short flags documented only in ARG_HINTS, not in usage. */
export function extractHintFlagTokens(hints: ReadonlyArray<{ token: string }>): string[] {
  const out = new Set<string>();
  for (const h of hints) {
    const t = h.token.trim();
    if (t.startsWith('--')) {
      const eq = t.indexOf('=');
      if (eq >= 0) out.add(t.slice(0, eq + 1));
      else out.add((t.split(/\s+/)[0] ?? t).replace(/[<>].*$/, ''));
    } else if (t.startsWith('-') && t.length >= 2 && t[1] !== '-') {
      out.add(t.slice(0, 2));
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

export function buildGenericUsageSuggestions(
  command: CommandDefinition,
  args: string[],
  trailingSpace: boolean,
  freq: Record<string, number>,
  pathRank: (
    fragment: string,
    paths: readonly string[],
    build: (p: string) => UsageSuggestRow,
  ) => UsageSuggestRow[],
  filePaths: readonly string[],
  dirPaths: readonly string[],
  homePaths: () => string[],
  hintFlagTokens: readonly string[] = [],
): UsageSuggestRow[] {
  const synopsis = command.usage;
  if (!usageTail(synopsis)) return [];

  const flags = [...new Set([...extractFlagsFromUsage(synopsis), ...hintFlagTokens])].sort((a, b) =>
    a.localeCompare(b),
  );
  const angleChoices = extractAngleChoices(synopsis);
  const bracketChoices = extractBracketPipeChoices(synopsis);
  const lastPartial = trailingSpace ? '' : (args[args.length - 1] ?? '');
  const name = command.name;

  const rank = (frag: string, keys: string[]) =>
    rankByFuzzyAndFrequency(
      frag,
      keys.map((key) => ({ key })),
      LIMIT,
      freq,
    ).map((x) => x.key);

  if (lastPartial.startsWith('-')) {
    const base = buildBase(name, args.slice(0, -1), true);
    const ranked = rank(lastPartial, flags);
    const out: UsageSuggestRow[] = [];
    for (const token of ranked) {
      out.push({
        completion: appendToken(base, token),
        usage: synopsis,
        description: token.endsWith('=') ? `Set ${token.replace(/=$/, '')}` : `Flag ${token}`,
        commandName: name,
      });
    }
    return out;
  }

  if (trailingSpace && flags.length && args.every((a) => a.startsWith('-'))) {
    const used = new Set(args);
    const nextFlags = flags.filter((f) => !used.has(f.replace(/=$/, '')) && !used.has(f));
    const base = buildBase(name, args, true);
    const out: UsageSuggestRow[] = [];
    for (const token of nextFlags.slice(0, LIMIT)) {
      out.push({
        completion: appendToken(base, token),
        usage: synopsis,
        description: token.endsWith('=') ? 'Flag (value after =)' : 'Flag',
        commandName: name,
      });
    }
    if (out.length) return out;
  }

  const choicePool = [...new Set([...angleChoices, ...bracketChoices])];
  if (choicePool.length) {
    const first = args[0]?.toLowerCase() ?? '';
    const firstConsumed =
      Boolean(trailingSpace && args.length > 0 && choicePool.some((c) => c.toLowerCase() === first));

    if (!firstConsumed) {
      const frag = trailingSpace ? '' : lastPartial;
      const base = buildBase(name, args, trailingSpace);
      const ranked = rank(frag, choicePool);
      if (ranked.length) {
        return ranked.map((token) => ({
          completion: appendToken(base, token),
          usage: synopsis,
          description: `Argument: ${token}`,
          commandName: name,
        }));
      }
    }
  }

  const filey = isFilePathCommand(name, synopsis);
  const diry = isDirPathCommand(name, synopsis);
  if (filey || diry) {
    const frag = trailingSpace ? '' : lastPartial;
    const wantDir = diry && !filey;
    const pool = wantDir
      ? [...new Set([...dirPaths, ...homePaths()])]
      : [...new Set([...filePaths, ...homePaths()])];
    const base = buildBase(name, args, trailingSpace);
    return pathRank(frag, pool, (path) => ({
      completion: base ? `${base} ${path}` : `${name} ${path}`,
      usage: synopsis,
      description: wantDir ? 'Directory path in the portfolio OS.' : 'File path in the portfolio OS.',
      commandName: name,
    }));
  }

  return [];
}

export function rankArgHintRows(
  commandName: string,
  args: string[],
  trailingSpace: boolean,
  hints: Array<{ token: string; description: string }>,
  freq: Record<string, number>,
): UsageSuggestRow[] {
  if (!hints.length) return [];
  if (!trailingSpace && args.length === 0) return [];

  const frag = trailingSpace ? '' : (args[args.length - 1] ?? '');
  const base = buildBase(commandName, args, trailingSpace);
  const ranked = rankByFuzzyAndFrequency(
    frag,
    hints.map((h) => ({ key: h.token, hint: h })),
    LIMIT,
    freq,
  );

  return ranked.map((x) => ({
    completion: appendToken(base, x.hint.token),
    usage: `${x.hint.token}: ${x.hint.description}`,
    description: x.hint.description,
    commandName,
  }));
}
