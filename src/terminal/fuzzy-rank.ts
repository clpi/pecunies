/** Subsequence + containment fuzzy score; higher is better. */
export function fuzzyScore(query: string, target: string): number {
  if (!query) {
    return 1;
  }
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t === q) {
    return 2000;
  }
  if (t.startsWith(q)) {
    return 1500 - t.length;
  }
  const idx = t.indexOf(q);
  if (idx >= 0) {
    return 800 - idx - t.length * 0.01;
  }
  let qi = 0;
  let score = 0;
  let gaps = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += 5;
      qi++;
    } else if (qi > 0) {
      gaps++;
    }
  }
  if (qi < q.length) {
    return 0;
  }
  return 100 + score - gaps * 2 - t.length * 0.02;
}

export function readCommandFrequency(): Record<string, number> {
  try {
    const raw = localStorage.getItem('pecunies.cmdFreq');
    if (!raw) {
      return {};
    }
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function bumpCommandFrequency(commandName: string): void {
  const key = commandName.toLowerCase();
  if (!key) {
    return;
  }
  try {
    const map = readCommandFrequency();
    map[key] = (map[key] ?? 0) + 1;
    localStorage.setItem('pecunies.cmdFreq', JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function rankByFuzzyAndFrequency<T extends { key: string }>(
  query: string,
  items: T[],
  limit: number,
  freq: Record<string, number>,
): T[] {
  const q = query.trim();
  if (!q) {
    return [...items]
      .sort((a, b) => {
        const fa = freq[a.key.toLowerCase()] ?? 0;
        const fb = freq[b.key.toLowerCase()] ?? 0;
        if (fb !== fa) {
          return fb - fa;
        }
        return a.key.localeCompare(b.key);
      })
      .slice(0, limit);
  }

  const scored = items
    .map((item) => {
      const fs = fuzzyScore(q, item.key);
      const fr = freq[item.key.toLowerCase()] ?? 0;
      return { item, fs, fr };
    })
    .filter((x) => x.fs > 0);

  scored.sort((a, b) => {
    if (b.fs !== a.fs) {
      return b.fs - a.fs;
    }
    if (b.fr !== a.fr) {
      return b.fr - a.fr;
    }
    return a.item.key.localeCompare(b.item.key);
  });

  return scored.slice(0, limit).map((s) => s.item);
}
