/**
 * Sandbox Filesystem API — direct REST CRUD on @cloudflare/sandbox filesystem.
 *
 * Routes:
 *   GET    /api/sandbox-fs?path=/workspace/foo.txt       → read file
 *   GET    /api/sandbox-fs?list=/workspace                 → list directory
 *   POST   /api/sandbox-fs { action: "write", path, content, sessionId }
 *   POST   /api/sandbox-fs { action: "mkdir", path, sessionId }
 *   POST   /api/sandbox-fs { action: "delete", path, sessionId }
 *   POST   /api/sandbox-fs { action: "exists", path, sessionId }
 *   POST   /api/sandbox-fs { action: "exec", command, sessionId }
 */

import {
  deleteSandboxFile,
  execInSandbox,
  existsSandboxFile,
  listSandboxFiles,
  mkdirSandbox,
  readSandboxFile,
  writeSandboxFile,
} from "../sandbox.js";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: HEADERS });
}

function err(message, status = 400) {
  return json({ error: message, success: false }, status);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: HEADERS,
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.Sandbox) {
    return err("Sandbox binding is not configured.", 503);
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") || "default";
  const path = url.searchParams.get("path") || "";
  const list = url.searchParams.get("list") || "";

  if (path) {
    try {
      const content = await readSandboxFile(env, sessionId, path);
      return json({ path, content, success: true });
    } catch (e) {
      return err(`No file found at ${path}.`, 404);
    }
  }

  if (list) {
    try {
      const files = await listSandboxFiles(env, sessionId, list);
      return json({ path: list, files, success: true });
    } catch (e) {
      return err(`Unable to list ${list}.`, 500);
    }
  }

  return err("Provide ?path= or ?list= query parameter.", 400);
}

export async function onRequestPost({ request, env }) {
  if (!env.Sandbox) {
    return err("Sandbox binding is not configured.", 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body.", 400);
  }

  const sessionId = String(body?.sessionId || "default");
  const action = String(body?.action || "").toLowerCase();

  switch (action) {
    case "write": {
      const path = String(body?.path || "");
      if (!path) return err("path is required.", 400);
      try {
        await writeSandboxFile(env, sessionId, path, String(body?.content ?? ""));
        return json({ ok: true, path, action: "write", success: true });
      } catch (e) {
        return err(e instanceof Error ? e.message : "Write failed.", 500);
      }
    }

    case "mkdir": {
      const path = String(body?.path || "");
      if (!path) return err("path is required.", 400);
      try {
        await mkdirSandbox(env, sessionId, path, { recursive: true });
        return json({ ok: true, path, action: "mkdir", success: true });
      } catch (e) {
        return err(e instanceof Error ? e.message : "mkdir failed.", 500);
      }
    }

    case "delete": {
      const path = String(body?.path || "");
      if (!path) return err("path is required.", 400);
      try {
        await deleteSandboxFile(env, sessionId, path);
        return json({ ok: true, path, action: "delete", success: true });
      } catch (e) {
        return err(e instanceof Error ? e.message : "Delete failed.", 500);
      }
    }

    case "exists": {
      const path = String(body?.path || "");
      if (!path) return err("path is required.", 400);
      try {
        const ok = await existsSandboxFile(env, sessionId, path);
        return json({ path, exists: ok, success: true });
      } catch (e) {
        return err(e instanceof Error ? e.message : "Exists check failed.", 500);
      }
    }

    case "exec": {
      const command = String(body?.command || "");
      if (!command) return err("command is required.", 400);
      try {
        const result = await execInSandbox(env, sessionId, command, {
          cwd: String(body?.cwd || "/workspace"),
          timeout: Number(body?.timeout || 30000),
        });
        return json({ ...result, success: result.success });
      } catch (e) {
        if (e?.code === "CONTAINER_NOT_READY") {
          return err("Container is still provisioning. Retry in a few seconds.", 503);
        }
        return err(e instanceof Error ? e.message : "Execution failed.", 500);
      }
    }

    default:
      return err(
        `Unknown action: ${action}. Supported: write, mkdir, delete, exists, exec`,
        400,
      );
  }
}
