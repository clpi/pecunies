import { apiHeaders, errorJson } from "./knowledge-store.js";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestPost({ request, env }) {
  const sudoPassword = env.PECUNIES_SUDO_PASSWD;
  const configured = !!sudoPassword;

  try {
    const body = await request.json();
    const password = body.password || body.sudoPassword;

    if (!password) {
      return Response.json({ ok: false, configured }, { headers: apiHeaders() });
    }

    const trimmed = password.trim();
    const ok = configured && trimmed === sudoPassword;

    return Response.json({ ok, configured }, { headers: apiHeaders() });
  } catch (e) {
    return errorJson(String(e.message || e), 500);
  }
}

export async function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: jsonHeaders });
}
