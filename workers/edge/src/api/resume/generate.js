import { apiHeaders, errorJson, latestResume, optionsResponse } from "../knowledge-store.js";

export async function onRequestOptions() {
  return optionsResponse("GET, OPTIONS");
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const format = String(url.searchParams.get("format") || "json").toLowerCase();
  const latest = await latestResume(env);

  if (!latest) {
    return errorJson("No stored resume markdown found.", 404);
  }

  if (format === "md" || format === "markdown") {
    return new Response(latest.markdown, {
      headers: {
        ...apiHeaders({
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": 'attachment; filename="chris-pecunies-resume.md"',
        }),
      },
    });
  }

  if (format === "pdf") {
    const pdf = renderSimpleResumePdf(latest.markdown);
    return new Response(pdf, {
      headers: apiHeaders({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="chris-pecunies-resume.generated.pdf"',
      }),
    });
  }

  return Response.json(
    {
      ok: true,
      format: "json",
      path: latest.path,
      updatedAt: latest.updatedAt,
      markdown: latest.markdown,
    },
    { headers: apiHeaders() },
  );
}

export async function onRequest() {
  return errorJson("Method not allowed.", 405);
}

function renderSimpleResumePdf(markdown) {
  const plain = markdownToPdfText(markdown);
  const lines = [];
  for (const raw of plain.split("\n")) {
    const line = raw.trimEnd();
    if (!line) {
      lines.push("");
      continue;
    }
    lines.push(...wrapLine(line, 92));
  }

  const pages = [];
  let current = [];
  for (const line of lines) {
    if (current.length >= 52) {
      pages.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) pages.push(current);

  const objects = [];
  const add = (value) => {
    objects.push(value);
    return objects.length;
  };

  const catalogId = add("");
  const pagesId = add("");
  const pageIds = [];
  const fontId = 3 + pages.length * 2;

  for (const pageLines of pages) {
    const content = [
      "BT",
      "/F1 10 Tf",
      "48 770 Td",
      "14 TL",
      ...pageLines.map((line) => `(${escapePdfText(line)}) Tj T*`),
      "ET",
    ].join("\n");
    const contentId = add(`<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`);
    const pageId = add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array([...pdf].map((ch) => ch.charCodeAt(0) & 0xff));
}

function markdownToPdfText(markdown) {
  return String(markdown || "")
    .replace(/^---[\s\S]*?\n---\s*/m, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1 <$2>")
    .normalize("NFKD")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapLine(line, width) {
  const words = String(line).split(/\s+/);
  const out = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= width) {
      current += ` ${word}`;
    } else {
      out.push(current);
      current = word;
    }
  }
  if (current) out.push(current);
  return out.length ? out : [""];
}

function escapePdfText(line) {
  return String(line).replace(/[\\()]/g, "\\$&");
}

function byteLength(value) {
  return new TextEncoder().encode(String(value)).length;
}
