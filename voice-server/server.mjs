import { spawn } from "node:child_process";
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Authenticated wrapper around the official HeadTTS REST server.
// The raw HeadTTS service listens on 127.0.0.1:8882 only; this proxy enforces
// the bearer token that the Cloudflare Worker sends.

const __dirname = dirname(fileURLToPath(import.meta.url));
const token = process.env.HEADTTS_SERVER_TOKEN;
if (!token) {
  console.error("HEADTTS_SERVER_TOKEN is required.");
  process.exit(1);
}
const port = Number(process.env.PORT || 8890);
const configPath = join(__dirname, "headtts-node.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.server.port = 8882;
const headtts = spawn(process.execPath, [join(__dirname, "node_modules/@met4citizen/headtts/modules/headtts-node.mjs"), "--config", configPath], {
  stdio: "inherit",
  env: { ...process.env }
});

process.on("SIGTERM", () => { headtts.kill("SIGTERM"); process.exit(0); });
process.on("SIGINT", () => { headtts.kill("SIGTERM"); process.exit(0); });

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });
  if (req.method !== "POST" || !req.url.startsWith("/v1/synthesize")) return json(res, 404, { error: "Not found" });
  if (req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { error: "Unauthorized" });
  let body = "";
  req.on("data", chunk => {
    body += chunk;
    if (body.length > 12000) { req.destroy(); json(res, 413, { error: "Request too large" }); }
  });
  req.on("end", async () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch (_) { return json(res, 400, { error: "Invalid JSON" }); }
    if (!parsed.input || String(parsed.input).length > 500) return json(res, 400, { error: "input is required (max 500 characters)" });
    try {
      const upstream = await fetch("http://127.0.0.1:8882/v1/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      res.end(text);
    } catch (error) {
      json(res, 502, { error: "HeadTTS service unavailable" });
    }
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Elpis HeadTTS proxy listening on http://127.0.0.1:${port}`);
});
