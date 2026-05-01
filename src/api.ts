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

export type PostRecord = {
  title: string;
  slug: string;
  path: string;
  markdown: string;
  body?: string;
  description?: string;
  published?: string;
  updated?: string;
  tags?: string[];
  comments?: Array<{
    id?: number;
    name: string;
    message: string;
    at: string;
    replies?: Array<{
      id?: number;
      name: string;
      message: string;
      at: string;
    }>;
  }>;
};

export type SessionConfigState = {
  config: Record<string, unknown>;
  cwd?: string;
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

async function apiCrudFetch<T>(
  segments: string[],
  init?: RequestInit,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const path = segments
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiFetch(`/api/crud/${path}${suffix}`, init);
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export async function fetchCatalog(
  type?: EntityType,
): Promise<CatalogEntity[]> {
  const data = await apiCrudFetch<{ items?: CatalogEntity[] }>(
    [type ?? "catalog"],
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
    return await apiCrudFetch([type, slug]);
  } catch {
    return null;
  }
}

export async function upsertEntity(
  entity: CatalogEntity,
  sudoPassword: string,
): Promise<CatalogEntity> {
  const res = await apiCrudFetch<{ entity: CatalogEntity }>(
    [entity.type, entity.slug],
    {
      method: "PUT",
      body: JSON.stringify({ entity, sudoPassword }),
    },
  );
  return res.entity;
}

export async function deleteEntity(
  type: EntityType,
  slug: string,
  sudoPassword: string,
): Promise<void> {
  await apiCrudFetch([type, slug], {
    method: "DELETE",
    body: JSON.stringify({ sudoPassword }),
  });
}

export async function mutateTag(params: {
  type: EntityType;
  slug: string;
  tag: string;
  add: boolean;
  sudoPassword: string;
}): Promise<CatalogEntity> {
  const current = await fetchEntity(params.type, params.slug);
  if (!current) throw new Error("Entity not found.");
  const tags = new Set(current.item.tags.map((tag) => tag.toLowerCase()));
  const nextTag = params.tag.trim().toLowerCase();
  if (params.add) tags.add(nextTag);
  else tags.delete(nextTag);
  return upsertEntity(
    { ...current.item, tags: Array.from(tags).filter(Boolean) },
    params.sudoPassword,
  );
}

export async function createQuickLink(params: {
  title: string;
  url: string;
  sudoPassword: string;
}): Promise<CatalogEntity> {
  const safe = new URL(params.url);
  if (safe.protocol !== "http:" && safe.protocol !== "https:") {
    throw new Error("url must be http(s).");
  }
  return upsertEntity(
    {
      type: "link",
      slug:
        params.title
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || `link-${Date.now().toString(36)}`,
      title: params.title.trim(),
      category: "quick-link",
      description: `Quick link for ${params.title.trim()}.`,
      tags: ["links", "quick-link"],
      metadata: { url: safe.toString(), source: "quick-link" },
    },
    params.sudoPassword,
  );
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
  const data = await apiCrudFetch<{ comments: Comment[] }>(
    ["comments"],
    undefined,
    { targetType, targetSlug, parentId },
  );
  return data.comments ?? [];
}

export async function fetchPostComments(postSlug: string): Promise<Comment[]> {
  return fetchComments("post", postSlug);
}

export async function postComment(params: {
  targetType: string;
  targetSlug: string;
  body: string;
  authorUsername?: string;
  authorEmail?: string;
  parentId?: string;
}): Promise<Comment> {
  const data = await apiCrudFetch<{ comment: Comment }>(["comments"], {
    method: "POST",
    body: JSON.stringify(params),
  });
  return data.comment;
}

export async function postCommentToPost(params: {
  postSlug: string;
  body: string;
  authorUsername?: string;
  authorEmail?: string;
  parentId?: string;
}): Promise<Comment> {
  return postComment({
    targetType: "post",
    targetSlug: params.postSlug,
    body: params.body,
    authorUsername: params.authorUsername,
    authorEmail: params.authorEmail,
    parentId: params.parentId,
  });
}

export async function updateComment(
  commentId: string,
  body: string,
  sudoPassword: string,
): Promise<Comment> {
  const data = await apiCrudFetch<{ item?: Comment; comment?: Comment }>(
    ["comments", commentId],
    {
      method: "PUT",
      body: JSON.stringify({ body, sudoPassword }),
    },
  );
  const comment = data.item ?? data.comment;
  if (!comment) throw new Error("Comment update failed.");
  return comment;
}

export async function deleteComment(
  commentId: string,
  sudoPassword: string,
): Promise<void> {
  await apiCrudFetch(["comments", commentId], {
    method: "DELETE",
    body: JSON.stringify({ sudoPassword }),
  });
}

export async function deletePostComment(
  _postSlug: string,
  commentId: string,
  sudoPassword: string,
): Promise<void> {
  await deleteComment(commentId, sudoPassword);
}

// ─── Signals ─────────────────────────────────────────────────────────────────

export async function upsertSignal(params: {
  signalId: string;
  signalLabel: string;
  signalValue: string;
  signalDetail?: string;
  signalAccent?: string;
  signalMode?: number;
  sudoPassword: string;
}): Promise<CatalogEntity> {
  return upsertEntity(
    {
      type: "data",
      slug: `signal:${params.signalId}`,
      title: params.signalLabel,
      category: "signal",
      description: params.signalDetail || "",
      tags: ["signal"],
      metadata: {
        signalId: params.signalId,
        signalValue: params.signalValue,
        signalAccent: params.signalAccent || "#ffffff",
        signalMode: String(params.signalMode ?? 0),
      },
    },
    params.sudoPassword,
  );
}

export async function deleteSignal(
  signalId: string,
  sudoPassword: string,
): Promise<void> {
  await deleteEntity("data", `signal:${signalId}`, sudoPassword);
}

// ─── Command History ──────────────────────────────────────────────────────────

export async function fetchHistory(
  sessionId: string,
  limit = 50,
): Promise<HistoryEntry[]> {
  const data = await apiCrudFetch<{ history: HistoryEntry[] }>(
    ["history"],
    undefined,
    { session: sessionId, limit },
  );
  return data.history ?? [];
}

export async function recordCommand(
  sessionId: string,
  command: string,
): Promise<void> {
  await apiCrudFetch(["history"], {
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
  const data = await apiCrudFetch<{ item: CatalogEntity }>([
    "users",
    emailOrUsername.trim().toLowerCase(),
  ]);
  const item = data.item;
  if (!item) throw new Error("No matching user.");
  return {
    email: String(item.metadata?.email || "").trim(),
    username: String(item.metadata?.username || item.slug).trim(),
    fullName: item.title || String(item.metadata?.username || item.slug).trim(),
  };
}

export async function authSignup(params: {
  email: string;
  username: string;
  fullName?: string;
}): Promise<AuthUser> {
  const data = await apiCrudFetch<{ user: AuthUser }>(["users"], {
    method: "POST",
    body: JSON.stringify(params),
  });
  return data.user;
}

export async function fetchUsers(): Promise<CatalogEntity[]> {
  const data = await apiCrudFetch<{ users: CatalogEntity[] }>(["users"]);
  return data.users ?? [];
}

// ─── Content overrides (in-place editing) ─────────────────────────────────────

export async function fetchContentOverrides(): Promise<Record<string, string>> {
  const data = await apiCrudFetch<{ overrides: Record<string, string> }>(
    ["content"],
  );
  return data.overrides ?? {};
}

export async function saveContentOverride(
  key: string,
  value: string,
): Promise<void> {
  await apiCrudFetch(["content", key], {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

export async function fetchPosts(): Promise<PostRecord[]> {
  const data = await apiCrudFetch<{ posts: PostRecord[] }>(["posts"]);
  return data.posts ?? [];
}

export async function fetchPost(slug: string): Promise<PostRecord | null> {
  try {
    const data = await apiCrudFetch<{ item: PostRecord }>(["posts", slug]);
    return data.item ?? null;
  } catch {
    return null;
  }
}

export async function createPost(params: {
  title: string;
  markdown: string;
  description?: string;
  tags?: string[];
  slug?: string;
  published?: string;
  sudoPassword: string;
}): Promise<PostRecord> {
  const data = await apiCrudFetch<{ item?: PostRecord; post?: PostRecord }>(["posts"], {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!data.post && !data.item) throw new Error("Post creation failed.");
  return data.post ?? data.item ?? params as unknown as PostRecord;
}

export async function updatePost(
  slug: string,
  params: {
    markdown: string;
    title?: string;
    description?: string;
    tags?: string[];
    published?: string;
    sudoPassword: string;
  },
): Promise<PostRecord> {
  const data = await apiCrudFetch<{ item?: PostRecord; post?: PostRecord }>(
    ["posts", slug],
    {
      method: "PUT",
      body: JSON.stringify(params),
    },
  );
  const post = data.item ?? data.post;
  if (!post) throw new Error("Post update failed.");
  return post;
}

export async function deletePost(
  slug: string,
  sudoPassword: string,
): Promise<void> {
  await apiCrudFetch(["posts", slug], {
    method: "DELETE",
    body: JSON.stringify({ sudoPassword }),
  });
}

export async function recordPostView(pathOrSlug: string): Promise<void> {
  await apiCrudFetch(["post-events"], {
    method: "POST",
    body: JSON.stringify({ path: pathOrSlug, action: "view" }),
  }).catch(() => {
    /* non-critical, never throw */
  });
}

export async function recordMetric(route: string, sessionId?: string): Promise<void> {
  await apiCrudFetch(["metrics"], {
    method: "POST",
    body: JSON.stringify({ route, sessionId }),
  }).catch(() => {
    /* non-critical, never throw */
  });
}

export async function fetchSessionConfig(
  sessionId: string,
): Promise<SessionConfigState> {
  return apiCrudFetch<SessionConfigState>(["config"], undefined, { sessionId });
}

export async function setSessionConfig(
  sessionId: string,
  key: string,
  value: string,
): Promise<SessionConfigState> {
  return apiCrudFetch<SessionConfigState>(["config"], {
    method: "PUT",
    body: JSON.stringify({ sessionId, key, value }),
  });
}

export async function resetSessionConfig(
  sessionId: string,
): Promise<SessionConfigState> {
  return apiCrudFetch<SessionConfigState>(["config"], {
    method: "DELETE",
    body: JSON.stringify({ sessionId }),
  });
}

export async function recordScore(params: {
  game: string;
  score: number;
  name: string;
}): Promise<void> {
  await apiCrudFetch(["scores"], {
    method: "POST",
    body: JSON.stringify(params),
  }).catch(() => {
    /* non-critical, never throw */
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
