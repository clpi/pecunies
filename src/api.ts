/**
 * Typed API client for api.pecunies.com
 * All data reads/writes go through this module — never fetch catalog/tags/skills/etc. directly.
 */

export const API_BASE =
  typeof window !== "undefined" &&
  window.location.hostname.includes("localhost")
    ? "http://localhost:8787"
    : "https://api.pecunies.com";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type EntityType =
  | "tag"
  | "skill"
  | "tool"
  | "project"
  | "command"
  | "view"
  | "app"
  | "link"
  | "work"
  | "workflow"
  | "step"
  | "execution"
  | "agent"
  | "hook"
  | "trigger"
  | "user"
  | "job"
  | "systemprompt"
  | "data";

export type CatalogEntity = {
  type: EntityType;
  slug: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  yearsOfExperience?: number;
  summary?: string;
  avatar?: string;
  status?: string;
  metadata?: Record<string, string>;
  details?: string[];
  related?: { type: EntityType; slug: string; label?: string }[];
};

export type Comment = {
  id: string;
  targetType: string;
  targetSlug: string;
  parentId: string | null;
  author: string;
  body: string;
  createdAt: string;
  replyCount?: number;
};

export type AutocompleteSuggestion = {
  value: string;
  label: string;
  description: string;
  usage?: string;
  category?: string;
  yearsOfExperience?: number;
  count?: number;
  tags?: string[];
};

export type HistoryEntry = {
  id: string;
  session_id: string;
  command: string;
  executed_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(err?.error ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export async function fetchCatalog(
  type?: EntityType,
): Promise<CatalogEntity[]> {
  const url = type ? `/api/catalog?type=${type}` : `/api/catalog`;
  const data = await apiFetch<{ items?: CatalogEntity[]; types?: unknown[] }>(
    url,
  );
  return data.items ?? [];
}

export async function fetchEntity(
  type: EntityType,
  slug: string,
): Promise<{
  item: CatalogEntity;
  usedBy: CatalogEntity[];
  topUses: CatalogEntity[];
} | null> {
  try {
    return await apiFetch(`/api/${type}/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function upsertEntity(
  entity: CatalogEntity,
  sudoPassword: string,
): Promise<CatalogEntity> {
  const res = await apiFetch<{ entity: CatalogEntity }>(
    `/api/${entity.type}/${entity.slug}`,
    {
      method: "POST",
      body: JSON.stringify({ action: "update", entity, sudoPassword }),
    },
  );
  return res.entity;
}

export async function deleteEntity(
  type: EntityType,
  slug: string,
  sudoPassword: string,
): Promise<void> {
  await apiFetch(`/api/${type}/${slug}`, {
    method: "POST",
    body: JSON.stringify({ action: "delete", type, slug, sudoPassword }),
  });
}

export async function mutateTag(params: {
  type: EntityType;
  slug: string;
  tag: string;
  add: boolean;
}): Promise<CatalogEntity> {
  const data = await apiFetch<{ entity: CatalogEntity }>(`/api/mutate`, {
    method: "POST",
    body: JSON.stringify({
      action: params.add ? "tag_add" : "tag_remove",
      type: params.type,
      slug: params.slug,
      tag: params.tag,
    }),
  });
  return data.entity;
}

export async function createQuickLink(params: {
  title: string;
  url: string;
}): Promise<CatalogEntity> {
  const data = await apiFetch<{ entity: CatalogEntity }>(`/api/mutate`, {
    method: "POST",
    body: JSON.stringify({
      action: "quick_link_create",
      title: params.title,
      url: params.url,
    }),
  });
  return data.entity;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function fetchTags(): Promise<CatalogEntity[]> {
  return fetchCatalog("tag");
}

export async function fetchTagWithUses(slug: string): Promise<{
  item: CatalogEntity;
  usedBy: CatalogEntity[];
  topUses: CatalogEntity[];
} | null> {
  return fetchEntity("tag", slug);
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export async function fetchSkills(): Promise<CatalogEntity[]> {
  return fetchCatalog("skill");
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function fetchComments(
  targetType: string,
  targetSlug: string,
  parentId?: string,
): Promise<Comment[]> {
  const params = new URLSearchParams({ type: targetType, slug: targetSlug });
  if (parentId) params.set("parent", parentId);
  const data = await apiFetch<{ comments: Comment[] }>(
    `/api/comments?${params}`,
  );
  return data.comments ?? [];
}

export async function postComment(params: {
  targetType: string;
  targetSlug: string;
  body: string;
  authorUsername?: string;
  authorEmail?: string;
  parentId?: string;
}): Promise<Comment> {
  const data = await apiFetch<{ comment: Comment }>(`/api/comments`, {
    method: "POST",
    body: JSON.stringify({ action: "create", ...params }),
  });
  return data.comment;
}

// ─── Signals ─────────────────────────────────────────────────────────────────

export async function upsertSignal(params: {
  signalId: string;
  signalLabel: string;
  signalValue: string;
  signalDetail?: string;
  signalAccent?: string;
  signalMode?: number;
}): Promise<CatalogEntity> {
  const data = await apiFetch<{ entity: CatalogEntity }>(`/api/mutate`, {
    method: "POST",
    body: JSON.stringify({ action: "signal_upsert", ...params }),
  });
  return data.entity;
}

export async function deleteSignal(signalId: string): Promise<void> {
  await apiFetch<{ ok: true }>(`/api/mutate`, {
    method: "POST",
    body: JSON.stringify({ action: "signal_delete", signalId }),
  });
}

export async function deleteComment(
  commentId: string,
  sudoPassword: string,
): Promise<void> {
  await apiFetch(`/api/comments`, {
    method: "POST",
    body: JSON.stringify({ action: "delete", commentId, sudoPassword }),
  });
}

// ─── Command History ──────────────────────────────────────────────────────────

export async function fetchHistory(
  sessionId: string,
  limit = 50,
): Promise<HistoryEntry[]> {
  const data = await apiFetch<{ history: HistoryEntry[] }>(
    `/api/history?session=${encodeURIComponent(sessionId)}&limit=${limit}`,
  );
  return data.history ?? [];
}

export async function recordCommand(
  sessionId: string,
  command: string,
): Promise<void> {
  await apiFetch(`/api/history`, {
    method: "POST",
    body: JSON.stringify({ sessionId, command }),
  }).catch(() => {
    /* non-critical, never throw */
  });
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

export async function fetchAutocompleteSuggestions(
  scope: "command" | "tag" | "skill",
  prefix: string,
): Promise<AutocompleteSuggestion[]> {
  const params = new URLSearchParams({ scope, q: prefix });
  const data = await apiFetch<{ suggestions: AutocompleteSuggestion[] }>(
    `/api/autocomplete?${params}`,
  );
  return data.suggestions ?? [];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type AuthUser = { email: string; username: string; fullName: string };

export async function authLogin(emailOrUsername: string): Promise<AuthUser> {
  const data = await apiFetch<{ user: AuthUser }>(`/api/auth`, {
    method: "POST",
    body: JSON.stringify({ action: "login", email: emailOrUsername }),
  });
  return data.user;
}

export async function authSignup(params: {
  email: string;
  username: string;
  fullName?: string;
}): Promise<AuthUser> {
  const data = await apiFetch<{ user: AuthUser }>(`/api/auth`, {
    method: "POST",
    body: JSON.stringify({ action: "signup", ...params }),
  });
  return data.user;
}

export async function fetchUsers(): Promise<CatalogEntity[]> {
  const data = await apiFetch<{ users: CatalogEntity[] }>(`/api/auth`);
  return data.users ?? [];
}

// ─── Content overrides (in-place editing) ─────────────────────────────────────

export async function fetchContentOverrides(): Promise<Record<string, string>> {
  const data = await apiFetch<{ overrides: Record<string, string> }>(
    `/api/content`,
  );
  return data.overrides ?? {};
}

export async function saveContentOverride(
  key: string,
  value: string,
): Promise<void> {
  await apiFetch(`/api/content`, {
    method: "PUT",
    body: JSON.stringify({ key, value }),
  });
}

// ─── Sudo auth ────────────────────────────────────────────────────────────────

export async function verifySudoPassword(
  password: string,
): Promise<{ ok: boolean; configured?: boolean }> {
  const trimmed = password.trim();
  const body = JSON.stringify({ password: trimmed, sudoPassword: trimmed });
  try {
    const data = await apiFetch<{ ok: boolean; configured?: boolean }>(
      `/api/sudo`,
      {
        method: "POST",
        body,
      },
    );
    return { ok: data.ok ?? false, configured: data.configured };
  } catch {
    const data = await apiFetch<{ ok: boolean; configured?: boolean }>(
      `/api/auth/sudo`,
      {
        method: "POST",
        body,
      },
    );
    return { ok: data.ok ?? false, configured: data.configured };
  }
}

// ─── Tag usage ────────────────────────────────────────────────────────────────

export type TagUsage = {
  slug: string;
  description?: string;
  count: number;
  uses: Array<{ label: string; type: string; command: string }>;
  related: string[];
};

export async function fetchTagUsage(slug: string): Promise<TagUsage> {
  const data = await apiFetch<{ usage: TagUsage }>(
    `/api/tags/${encodeURIComponent(slug)}/usage`,
  );
  return data.usage ?? { slug, count: 0, uses: [], related: [] };
}
