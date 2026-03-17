import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 8091;
const CONFIG_DIR = process.env.CONFIG_DIR || "/config";
const AGENT_KEY = process.env.AGENT_KEY || "";

app.use(express.json({ limit: "4mb" }));

function authOk(req) {
  if (!AGENT_KEY) return true;
  const key = req.header("x-agent-key") || "";
  return key === AGENT_KEY;
}

function deny(res) {
  res.status(401).json({ error: "unauthorized" });
}

function normalizeIncomingPath(p) {
  const raw = String(p || "");
  if (!raw) return "";
  if (raw === "/config" || raw.startsWith("/config/")) {
    return path.join(CONFIG_DIR, raw.replace(/^\/config/, ""));
  }
  return raw;
}

function isAllowedPath(p) {
  const resolved = path.resolve(normalizeIncomingPath(p));
  const allow = path.resolve(CONFIG_DIR);
  return resolved === allow || resolved.startsWith(allow + path.sep);
}

function backupPath(p) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${p}.bak.${ts}`;
}

function readKnownFiles() {
  const targets = [
    path.join(CONFIG_DIR, "configuration.yaml"),
    path.join(CONFIG_DIR, "automations.yaml"),
    path.join(CONFIG_DIR, "scripts.yaml"),
    path.join(CONFIG_DIR, "scenes.yaml"),
  ];
  const out = [];
  for (const p of targets) {
    if (fs.existsSync(p)) {
      out.push({ path: p, content: fs.readFileSync(p, "utf8") });
    }
  }
  return out;
}

app.get("/health", (req, res) => {
  if (!authOk(req)) return deny(res);
  res.json({ ok: true, config_dir: CONFIG_DIR });
});

app.get("/files", (req, res) => {
  if (!authOk(req)) return deny(res);
  res.json({ files: readKnownFiles() });
});

app.post("/write", (req, res) => {
  if (!authOk(req)) return deny(res);
  const files = Array.isArray(req.body?.files) ? req.body.files : [];

  // debug log
  try {
    console.log("CONFIG_DIR=", CONFIG_DIR);
    console.log("FILES=", JSON.stringify(files));
  } catch {}

  if (!files.length) return res.status(400).json({ error: "no files" });

  const written = [];
  for (const item of files) {
    const p = normalizeIncomingPath(String(item?.path || ""));
    const content = String(item?.content || "");
    if (!p) continue;
    if (!isAllowedPath(p)) continue;
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(p)) {
      const bak = backupPath(p);
      fs.copyFileSync(p, bak);
      written.push({ path: p, backup: bak });
    } else {
      written.push({ path: p, backup: "" });
    }
    fs.writeFileSync(p, content, "utf8");
  }

  if (!written.length) return res.status(403).json({ error: "path not allowed" });
  res.json({ ok: true, written });
});

app.listen(PORT, () => {
  console.log(`ha-agent listening on ${PORT}`);
});
