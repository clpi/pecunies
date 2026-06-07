/**
 * @cloudflare/sandbox integration for terminal code execution.
 *
 * Provides isolated container-based code execution for terminal commands
 * like `exec`, `python`, `node`, `run`, `sh`, and `bash`.
 *
 * Uses the Sandbox SDK from @cloudflare/sandbox which runs containers
 * backed by Durable Objects. Each session gets its own isolated environment
 * with persistent state (files, installed packages) across commands.
 *
 * Architecture:
 *   - getSandbox() creates/reuses a Sandbox DO by ID (lazy-loaded)
 *   - Sessions provide per-user isolation within a sandbox
 *   - User code is written to a file then executed (no command injection)
 *   - proxyToSandbox() handles preview URL WebSocket proxying (lazy-loaded)
 *   - CONTAINER_NOT_READY errors are retried automatically
 *
 * Note: The Sandbox class is re-exported statically (required by Workers
 * for Durable Object bindings). All other SDK functions are imported
 * dynamically to avoid pulling node:path/posix and heavy deps into the
 * top-level module scope, which would crash Workers at startup.
 */

// Re-export Sandbox DO class statically — required by Workers for DO bindings.
// This must be a static export; Cloudflare validates it at deploy time.
export { Sandbox } from "@cloudflare/sandbox";

// Lazy import cache for the heavy SDK (avoids top-level node:path import)
type SandboxSDK = typeof import("@cloudflare/sandbox");
let _sdk: SandboxSDK | null = null;
async function loadSDK(): Promise<SandboxSDK> {
  if (!_sdk) {
    _sdk = await import("@cloudflare/sandbox");
  }
  return _sdk;
}

export type Env = {
  Sandbox?: DurableObjectNamespace;
};

// ── Configuration ──────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const CONTAINER_NOT_READY = "CONTAINER_NOT_READY";

// ── Proxy Handler ──────────────────────────────────────────────────────

/**
 * MUST be called at the top of the fetch handler.
 * Handles preview URL WebSocket connections for sandbox port exposure.
 * Returns a Response if it handled the request, null otherwise.
 */
export async function handleSandboxProxy(
  request: Request,
  env: Env,
): Promise<Response | null> {
  if (!env.Sandbox) return null;
  const { proxyToSandbox } = await loadSDK();
  return proxyToSandbox(request, env);
}

// ── Helper: require sandbox binding ────────────────────────────────────

class SandboxNotConfiguredError extends Error {
  constructor() {
    super("Sandbox binding is not configured. Add the Sandbox DO binding in wrangler.jsonc.");
    this.name = "SandboxNotConfiguredError";
  }
}

async function getSandboxOrThrow(env: Env, sessionId: string): Promise<import("@cloudflare/sandbox").Sandbox> {
  if (!env.Sandbox) throw new SandboxNotConfiguredError();
  const { getSandbox } = await loadSDK();
  return getSandbox(env.Sandbox!, `session-${sessionId}`, {
    normalizeId: true,
    sleepAfter: "30m",
    keepAlive: false,
  });
}

// ── Sandbox API ────────────────────────────────────────────────────────

/**
 * Execute a shell command in the sandbox, with automatic retry on
 * CONTAINER_NOT_READY (cold start provisioning).
 */
export async function execInSandbox(
  env: Env,
  sessionId: string,
  command: string,
  options?: { cwd?: string; env?: Record<string, string>; timeout?: number },
): Promise<{ stdout: string; stderr: string; exitCode: number; success: boolean }> {
  const sandbox = await getSandboxOrThrow(env, sessionId);
  const result = await retryOnNotReady(() =>
    sandbox.exec(command, {
      cwd: options?.cwd,
      env: options?.env,
      timeout: options?.timeout ?? 30000,
    }),
  );
  return result;
}

/**
 * Execute Python code in the sandbox.
 * Writes code to a temp file, then executes it (safe from injection).
 */
export async function execPython(
  env: Env,
  sessionId: string,
  code: string,
  options?: { timeout?: number },
): Promise<{ stdout: string; stderr: string; exitCode: number; success: boolean }> {
  const sandbox = await getSandboxOrThrow(env, sessionId);
  const filePath = `/workspace/_terminal_exec_${Date.now()}.py`;

  // Write code to file first (security best practice)
  await retryOnNotReady(() => sandbox.writeFile(filePath, code));

  // Execute the file
  const result = await retryOnNotReady(() =>
    sandbox.exec(`python3 ${filePath}`, {
      cwd: "/workspace",
      timeout: options?.timeout ?? 30000,
    }),
  );

  // Clean up temp file
  try { await sandbox.deleteFile(filePath); } catch { /* best-effort */ }

  return result;
}

/**
 * Execute JavaScript code in the sandbox.
 * Writes code to a temp file, then executes it with node.
 */
export async function execNode(
  env: Env,
  sessionId: string,
  code: string,
  options?: { timeout?: number },
): Promise<{ stdout: string; stderr: string; exitCode: number; success: boolean }> {
  const sandbox = await getSandboxOrThrow(env, sessionId);
  const filePath = `/workspace/_terminal_exec_${Date.now()}.js`;

  await retryOnNotReady(() => sandbox.writeFile(filePath, code));

  const result = await retryOnNotReady(() =>
    sandbox.exec(`node ${filePath}`, {
      cwd: "/workspace",
      timeout: options?.timeout ?? 15000,
    }),
  );

  try { await sandbox.deleteFile(filePath); } catch { /* best-effort */ }

  return result;
}

/**
 * Run a script file that already exists in the sandbox filesystem.
 */
export async function execFile(
  env: Env,
  sessionId: string,
  filePath: string,
  options?: { args?: string; timeout?: number },
): Promise<{ stdout: string; stderr: string; exitCode: number; success: boolean }> {
  const sandbox = await getSandboxOrThrow(env, sessionId);

  const ext = filePath.split(".").pop()?.toLowerCase();
  let interpreter: string;
  switch (ext) {
    case "py": interpreter = "python3"; break;
    case "js": case "mjs": interpreter = "node"; break;
    case "sh": case "bash": default: interpreter = "bash"; break;
  }

  const cmd = options?.args
    ? `${interpreter} ${filePath} ${options.args}`
    : `${interpreter} ${filePath}`;

  return retryOnNotReady(() =>
    sandbox.exec(cmd, {
      cwd: "/workspace",
      timeout: options?.timeout ?? 30000,
    }),
  );
}

/**
 * Write a file to the sandbox filesystem.
 */
export async function writeSandboxFile(
  env: Env,
  sessionId: string,
  path: string,
  content: string,
): Promise<void> {
  const sandbox = await getSandboxOrThrow(env, sessionId);
  await retryOnNotReady(() => sandbox.writeFile(path, content));
}

/**
 * Read a file from the sandbox filesystem.
 */
export async function readSandboxFile(
  env: Env,
  sessionId: string,
  path: string,
): Promise<string> {
  const sandbox = await getSandboxOrThrow(env, sessionId);
  const result = await retryOnNotReady(() => sandbox.readFile(path));
  return result.content;
}

/**
 * List files in the sandbox filesystem.
 */
export async function listSandboxFiles(
  env: Env,
  sessionId: string,
  path: string = "/workspace",
): Promise<string[]> {
  const sandbox = await getSandboxOrThrow(env, sessionId);
  const result = await retryOnNotReady(() => sandbox.listFiles(path));
  return result.files?.map((f: { name: string }) => f.name) ?? [];
}

/**
 * Delete a file from the sandbox filesystem.
 */
export async function deleteSandboxFile(
  env: Env,
  sessionId: string,
  path: string,
): Promise<void> {
  const sandbox = await getSandboxOrThrow(env, sessionId);
  await retryOnNotReady(() => sandbox.deleteFile(path));
}

/**
 * Create a directory in the sandbox filesystem.
 */
export async function mkdirSandbox(
  env: Env,
  sessionId: string,
  path: string,
  options?: { recursive?: boolean },
): Promise<void> {
  const sandbox = await getSandboxOrThrow(env, sessionId);
  await retryOnNotReady(() => sandbox.mkdir(path, { recursive: options?.recursive ?? false }));
}

/**
 * Check if a file exists in the sandbox filesystem.
 */
export async function existsSandboxFile(
  env: Env,
  sessionId: string,
  path: string,
): Promise<boolean> {
  try {
    await readSandboxFile(env, sessionId, path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Destroy a sandbox session, freeing all resources.
 */
export async function destroySandbox(
  env: Env,
  sessionId: string,
): Promise<void> {
  const sandbox = await getSandboxOrThrow(env, sessionId);
  await sandbox.destroy();
}

// ── Terminal Command Handler ───────────────────────────────────────────

export interface SandboxCommandResult {
  output: string;
  error?: string;
  exitCode?: number;
  success: boolean;
}

/**
 * Route terminal sandbox commands to the appropriate handler.
 * Used by both the /api/sandbox endpoint and the OS handler.
 */
export async function handleSandboxCommand(
  env: Env,
  command: string,
  args: string,
  sessionId: string,
): Promise<SandboxCommandResult> {
  switch (command) {
    case "exec":
    case "sh":
    case "bash": {
      if (!args.trim()) {
        return {
          output: `Usage: ${command} <shell-command>\nExecute a shell command in an isolated Cloudflare Sandbox container.`,
          success: true,
        };
      }
      const result = await execInSandbox(env, sessionId, args, {
        cwd: "/workspace",
      });
      return {
        output: result.stdout || result.stderr || `(exit code ${result.exitCode})`,
        error: result.stderr || undefined,
        exitCode: result.exitCode,
        success: result.success,
      };
    }

    case "python": {
      if (!args.trim()) {
        return {
          output: "Usage: python <code | -f file.py>\nExecute Python code in the sandbox.\nUse -f to run a .py file from /workspace.",
          success: true,
        };
      }
      if (args.startsWith("-f ")) {
        const filePath = args.slice(3).trim();
        const result = await execFile(env, sessionId, filePath);
        return {
          output: result.stdout || result.stderr || `(exit code ${result.exitCode})`,
          error: result.stderr || undefined,
          exitCode: result.exitCode,
          success: result.success,
        };
      }
      const result = await execPython(env, sessionId, args);
      return {
        output: result.stdout || result.stderr || `(exit code ${result.exitCode})`,
        error: result.stderr || undefined,
        exitCode: result.exitCode,
        success: result.success,
      };
    }

    case "node": {
      if (!args.trim()) {
        return {
          output: "Usage: node <code>\nExecute JavaScript code in the sandbox.",
          success: true,
        };
      }
      const result = await execNode(env, sessionId, args);
      return {
        output: result.stdout || result.stderr || `(exit code ${result.exitCode})`,
        error: result.stderr || undefined,
        exitCode: result.exitCode,
        success: result.success,
      };
    }

    case "run": {
      if (!args.trim()) {
        return {
          output: "Usage: run <file>\nExecute a script file in the sandbox. Supports .py, .js, .sh files.",
          success: true,
        };
      }
      const result = await execFile(env, sessionId, args);
      return {
        output: result.stdout || result.stderr || `(exit code ${result.exitCode})`,
        error: result.stderr || undefined,
        exitCode: result.exitCode,
        success: result.success,
      };
    }

    default:
      return {
        output: `Unknown sandbox command: ${command}`,
        error: `Unknown command: ${command}`,
        success: false,
      };
  }
}

// ── API Endpoint Handler ───────────────────────────────────────────────

/**
 * Handle POST /api/sandbox requests.
 */
export async function handleSandboxApi(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (!env.Sandbox) {
    return new Response(JSON.stringify({
      error: "Sandbox not configured. Add the Sandbox DO binding in wrangler.jsonc.",
      success: false,
    }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    const body = await request.json() as {
      sessionId?: string;
      command?: string;
      args?: string;
      code?: string;
      language?: string;
      action?: string;
    };

    const sessionId = body.sessionId || "default";
    const action = body.action || body.command;

    switch (action) {
      case "exec":
      case "sh":
      case "bash": {
        const result = await execInSandbox(env, sessionId, body.args || "", {
          cwd: "/workspace",
        });
        return Response.json(result);
      }

      case "python": {
        const code = body.code || body.args || "";
        const result = await execPython(env, sessionId, code);
        return Response.json(result);
      }

      case "node": {
        const code = body.code || body.args || "";
        const result = await execNode(env, sessionId, code);
        return Response.json(result);
      }

      case "run": {
        const result = await execFile(env, sessionId, body.args || "");
        return Response.json(result);
      }

      case "read": {
        const content = await readSandboxFile(env, sessionId, body.args || "/workspace");
        return Response.json({ content, success: true });
      }

      case "write": {
        await writeSandboxFile(env, sessionId, body.args || "/workspace/file.txt", body.code || "");
        return Response.json({ success: true, path: body.args });
      }

      case "ls": {
        const files = await listSandboxFiles(env, sessionId, body.args || "/workspace");
        return Response.json({ files, success: true });
      }

      case "destroy": {
        await destroySandbox(env, sessionId);
        return Response.json({ success: true, message: "Sandbox destroyed" });
      }

      default:
        return Response.json(
          { error: `Unknown action: ${action}. Supported: exec, python, node, run, read, write, ls, destroy` },
          { status: 400 },
        );
    }
  } catch (err: any) {
    const message = err?.message || String(err);
    const code = err?.code || "UNKNOWN";

    if (code === CONTAINER_NOT_READY) {
      return Response.json(
        { error: "Sandbox container is still provisioning. Please retry in a few seconds.", code: CONTAINER_NOT_READY, success: false },
        { status: 503 },
      );
    }

    if (err instanceof SandboxNotConfiguredError) {
      return Response.json(
        { error: message, code: "SANDBOX_NOT_CONFIGURED", success: false },
        { status: 503 },
      );
    }

    return Response.json(
      { error: message, code, success: false },
      { status: 500 },
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

async function retryOnNotReady<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: any;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (err?.code === CONTAINER_NOT_READY && i < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}