import express from "express";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, "..");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const DEFAULT_OPENAI_API_KEY = "";
const DEFAULT_OPENAI_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const DEFAULT_OPENAI_MODEL = "glm-4.5-flash";

const jobs = new Map();
const JOB_EVENT_LIMIT = 2000;

function createJob(type) {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    type,
    createdAt: Date.now(),
    status: "running",
    events: [],
    listeners: new Set(),
    done: false,
    abortController: new AbortController(),
    currentChild: null,
  };
  jobs.set(id, job);
  setTimeout(() => jobs.delete(id), 60 * 60 * 1000);
  return job;
}

function emitJob(job, event) {
  const payload = { ts: Date.now(), ...event };
  if (payload.type === "status") job.status = payload.message || job.status;
  if (payload.type === "result") job.done = true;
  if (payload.type === "error") job.done = true;

  const line = JSON.stringify(payload) + "\n";
  job.events.push(line);
  if (job.events.length > JOB_EVENT_LIMIT) {
    job.events.splice(0, job.events.length - JOB_EVENT_LIMIT);
  }
  for (const res of job.listeners) {
    try {
      res.write(line);
    } catch {
      // ignore
    }
  }
  if (job.done) {
    for (const res of job.listeners) {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
    job.listeners.clear();
  }
}

function attachJobStream(job, res) {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  for (const line of job.events) {
    res.write(line);
  }
  if (job.done) {
    return res.end();
  }
  job.listeners.add(res);
  res.on("close", () => {
    job.listeners.delete(res);
  });
}

app.use(express.json({ limit: "2mb" }));
app.use("/static", express.static(path.join(__dirname, "static")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "templates", "index.html"));
});

app.get("/api/yaml-files", (req, res) => {
  const files = fs
    .readdirSync(ROOT_DIR, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => /\.ya?ml$/i.test(name));
  res.json({ files });
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "未选择文件" });
    }
    const original = req.file.originalname || "upload.yaml";
    const safeName = sanitizeFilename(original);
    if (!/\.ya?ml$/i.test(safeName)) {
      return res.status(400).json({ error: "仅支持 .yaml 或 .yml 文件" });
    }
    const finalName = ensureUniqueName(safeName);
    const filePath = path.join(ROOT_DIR, finalName);
    fs.writeFileSync(filePath, req.file.buffer);
    res.json({ ok: true, filename: finalName });
  } catch (err) {
    res.status(500).json({ error: err.message || "上传失败" });
  }
});

app.get("/api/download", (req, res) => {
  try {
    const filename = typeof req.query.filename === "string" ? req.query.filename : "";
    if (!filename) {
      return res.status(400).json({ error: "缺少文件名" });
    }
    const safeName = sanitizeFilename(filename);
    if (!/\.ya?ml$/i.test(safeName)) {
      return res.status(400).json({ error: "仅支持下载 YAML 文件" });
    }
    const filePath = safeResolveFile(safeName);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在" });
    }
    res.download(filePath, safeName);
  } catch (err) {
    res.status(500).json({ error: err.message || "下载失败" });
  }
});

app.get("/api/download-firmware", (req, res) => {
  try {
    const reqPath = typeof req.query.path === "string" ? req.query.path : "";
    if (!reqPath) {
      return res.status(400).json({ error: "缺少固件路径" });
    }
    const normalized = path.normalize(reqPath);
    if (!normalized.endsWith("firmware.bin")) {
      return res.status(400).json({ error: "仅支持下载 firmware.bin" });
    }
    const isSafe =
      normalized.startsWith(ROOT_DIR) ||
      normalized.includes(`${path.sep}.esphome${path.sep}`) ||
      normalized.includes(`${path.sep}.pioenvs${path.sep}`);
    if (!isSafe) {
      return res.status(400).json({ error: "固件路径不安全" });
    }
    if (!fs.existsSync(normalized)) {
      return res.status(404).json({ error: "固件不存在" });
    }
    res.download(normalized, "firmware.bin");
  } catch (err) {
    res.status(500).json({ error: err.message || "下载固件失败" });
  }
});

app.post("/api/ha-integration", async (req, res) => {
  const result = await generateHaIntegration(req.body);
  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }
  res.json(result);
});

app.post("/api/ha-integration-stream", async (req, res) => {
  const job = createJob("ha_integration");
  attachJobStream(job, res);
  emitJob(job, { type: "job", id: job.id });
  startHaIntegrationJob(job, req.body);
});

app.get("/api/job-status", (req, res) => {
  const jobId = typeof req.query.jobId === "string" ? req.query.jobId : "";
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: "任务不存在" });
  res.json({ id: job.id, running: !job.done, status: job.status });
});

app.get("/api/job-stream", (req, res) => {
  const jobId = typeof req.query.jobId === "string" ? req.query.jobId : "";
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).end();
    return;
  }
  attachJobStream(job, res);
});

app.post("/api/job-cancel", (req, res) => {
  const { jobId } = req.body || {};
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: "任务不存在" });
  try {
    job.abortController.abort();
    if (job.currentChild) {
      job.currentChild.kill();
    }
    emitJob(job, { type: "error", message: "任务已取消" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "取消失败" });
  }
});

app.post("/api/chat", (req, res) => {
  try {
    const { message, config, history, context, exec, exec_type, options, build } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "缺少消息内容" });
    }
    const execType = exec_type || (exec ? "edit" : null);
    if (execType === "edit") {
      handleChatExec(message, config, history, context, options, build)
        .then((result) => res.json(result))
        .catch((err) => res.status(500).json({ error: err.message || "AI 执行失败" }));
      return;
    }
    if (execType === "build") {
      handleChatBuild(message, config, context, build, options)
        .then((result) => res.json(result))
        .catch((err) => res.status(500).json({ error: err.message || "自动编译失败" }));
      return;
    }
    handleChat(message, config, history, context)
      .then((reply) => res.json({ reply }))
      .catch((err) => res.status(500).json({ error: err.message || "聊天失败" }));
  } catch (err) {
    res.status(500).json({ error: err.message || "聊天失败" });
  }
});

app.post("/api/preview", (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) {
      return res.status(400).json({ error: "缺少文件名" });
    }
    const filePath = path.join(ROOT_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在" });
    }
    const text = fs.readFileSync(filePath, "utf8");
    const doc = safeLoadYaml(text);
    const platform = detectPlatform(doc, text);
    const entities = extractEntities(doc);
    const firmwarePath = findFirmwareForYaml(text, filename);

    res.json({ platform, entities, firmwarePath });
  } catch (err) {
    res.status(500).json({ error: err.message || "解析失败" });
  }
});

app.post("/api/generate", (req, res) => {
  try {
    const { filename, selections, options } = req.body || {};
    if (!filename) {
      return res.status(400).json({ error: "缺少文件名" });
    }
    const filePath = path.join(ROOT_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在" });
    }

    const originalText = fs.readFileSync(filePath, "utf8");
    const doc = safeLoadYaml(originalText);
    const platform = detectPlatform(doc, originalText);
    if (!platform) {
      return res.status(400).json({ error: "无法识别芯片型号（未找到 esp32 或 esp8266 配置）" });
    }

    const normalizedSelections = normalizeSelections(platform, selections || {});
    const idResult = applyMissingIds(originalText, doc, platform, normalizedSelections);
    const homekitId = selectHomekitId(doc, idResult.idSet);
    const homekitConfig = buildHomekitConfig(platform, idResult.selections, homekitId);

    const commentLine = "# 自动插入的 HomeKit 配置";
    const homekitBlock = yaml.dump({ homekit: homekitConfig }, dumpOptions());

    let text = idResult.text.endsWith("\n") ? idResult.text : `${idResult.text}\n`;

    const removeResult = removeTopLevelBlock(text, "homekit");
    text = removeResult.text;

    const extInsertResult = ensureExternalComponents(text, platform);
    text = extInsertResult.text;

    const includeWebPanel = options?.include_web_panel !== false;
    let webResult = { text, added: false, updated: false, addedKeys: [] };
    if (includeWebPanel) {
      webResult = ensureWebServerBlock(text);
      text = webResult.text;
    }

    text = `${text}${text.endsWith("\n") ? "" : "\n"}${commentLine}\n${homekitBlock}`;

    // 添加 HomeKit 重置按钮
    text = addHomekitResetButton(text, platform, homekitId);

    const outputName = options?.outputName || buildOutputName(filename);
    const outputPath = path.join(ROOT_DIR, outputName);
    fs.writeFileSync(outputPath, text, "utf8");

    const warnings = [...idResult.warnings];
    if (removeResult.removed) warnings.push("检测到已有 homekit 配置，已替换为新配置");
    if (extInsertResult.added === false) warnings.push("external_components 已存在或已包含 HomeKit，本次未新增");
    if (includeWebPanel && webResult.added === false && webResult.updated !== true) {
      warnings.push("web_server 已存在，本次未新增");
    }
    if (includeWebPanel && webResult.updated === true) {
      warnings.push(`web_server 已补全：${webResult.addedKeys.join(", ")}`);
    }

    res.json({
      ok: true,
      platform,
      outputName,
      outputPath,
      outputText: text,
      warnings,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "生成失败" });
  }
});

app.post("/api/auto-build", async (req, res) => {
  try {
    const { filename, mode, attempts, device, config, options } = req.body || {};
    if (!filename || typeof filename !== "string") {
      return res.status(400).json({ error: "缺少文件名" });
    }
    const filePath = path.join(ROOT_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在" });
    }
    const maxAttempts = Math.max(1, Math.min(10, Number(attempts || 3)));
    const runMode = mode === "run" ? "run" : "compile";
    const result = await autoBuildLoop({
      filename,
      filePath,
      runMode,
      device,
      maxAttempts,
      config,
      options,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "自动编译失败" });
  }
});

app.post("/api/auto-build-stream", async (req, res) => {
  const job = createJob("build");
  attachJobStream(job, res);
  emitJob(job, { type: "job", id: job.id });
  startBuildJob(job, req.body);
});

app.post("/api/auto-generate-stream", async (req, res) => {
  const job = createJob("generate");
  attachJobStream(job, res);
  emitJob(job, { type: "job", id: job.id });
  startGenerateJob(job, req.body);
});

app.listen(PORT, () => {
  console.log(`Web panel running at http://localhost:${PORT}`);
  console.log(`Workspace: ${ROOT_DIR}`);
});

function safeLoadYaml(text) {
  try {
    const doc = yaml.load(text, { schema: buildYamlSchema() });
    if (!doc || typeof doc !== "object") return {};
    return doc;
  } catch (err) {
    return {};
  }
}

function detectPlatform(doc, rawText = "") {
  if (doc && typeof doc === "object") {
    if (doc.esp32) return "esp32";
    if (doc.esp8266) return "esp8266";
    if (doc.esp8226) return "esp8266";
    const platformValue = typeof doc.esphome?.platform === "string" ? doc.esphome.platform.toLowerCase() : "";
    if (platformValue.includes("esp32")) return "esp32";
    if (platformValue.includes("esp8266")) return "esp8266";
    if (platformValue.includes("esp8226")) return "esp8266";
  }

  if (rawText && typeof rawText === "string") {
    if (/(^|\n)\s*esp32\s*:/i.test(rawText)) return "esp32";
    if (/(^|\n)\s*esp8266\s*:/i.test(rawText)) return "esp8266";
    if (/(^|\n)\s*esp8226\s*:/i.test(rawText)) return "esp8266";
  }
  return null;
}

function extractEntities(doc) {
  return {
    switch: extractEntityList(doc?.switch),
    light: extractEntityList(doc?.light),
    fan: extractEntityList(doc?.fan),
    sensor: extractEntityList(doc?.sensor),
    binary_sensor: extractEntityList(doc?.binary_sensor),
    climate: extractEntityList(doc?.climate),
    lock: extractEntityList(doc?.lock),
  };
}

function extractEntityList(section) {
  const list = normalizeList(section);
  return list
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const id = typeof item.id === "string" ? item.id : "";
      const name = typeof item.name === "string" ? item.name : "";
      const deviceClass = typeof item.device_class === "string" ? item.device_class : "";
      const platform = typeof item.platform === "string" ? item.platform : "";
      return {
        index,
        id,
        name,
        device_class: deviceClass,
        platform,
        has_id: Boolean(id),
        default_type: guessType(deviceClass),
        default_binary_type: guessBinaryType(deviceClass),
      };
    })
    .filter(Boolean);
}

function normalizeList(section) {
  if (!section) return [];
  if (Array.isArray(section)) return section;
  return [section];
}

function guessType(deviceClass) {
  const map = {
    temperature: "temperature",
    humidity: "humidity",
    illuminance: "illuminance",
  };
  return map[deviceClass] || "temperature";
}

function guessBinaryType(deviceClass) {
  const map = {
    door: "contact",
    opening: "contact",
    window: "contact",
    garage_door: "contact",
    motion: "motion",
    occupancy: "occupancy",
    presence: "occupancy",
    smoke: "smoke",
    safety: "smoke",
    moisture: "leak",
    water: "leak",
    leak: "leak",
  };
  return map[deviceClass] || "contact";
}

function normalizeSelections(platform, selections) {
  const result = {};
  
  if (platform === "esp32") {
    result.light = ensureEntityArray(selections.light);
    result.switch = ensureEntityArray(selections.switch);
    result.sensor = ensureEntityArray(selections.sensor);
    result.fan = ensureEntityArray(selections.fan);
    result.climate = ensureEntityArray(selections.climate);
    result.lock = ensureEntityArray(selections.lock);
  } else {
    result.switches = ensureEntityArray(selections.switches);
    result.lights = ensureEntityArray(selections.lights);
    result.fans = ensureEntityArray(selections.fans);
    result.sensors = ensureTypedEntityArray(selections.sensors);
    result.binary_sensors = ensureTypedEntityArray(selections.binary_sensors);
  }
  
  // 添加配对码
  if (selections.setup_code && typeof selections.setup_code === "string") {
    result.setup_code = selections.setup_code.trim();
  }
  
  return result;
}

function ensureEntityArray(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((v) => {
      if (typeof v === "string") return { id: v };
      if (!v || typeof v !== "object") return null;
      const id = typeof v.id === "string" ? v.id : "";
      const index = Number.isInteger(v.index) ? v.index : null;
      return { id, index };
    })
    .filter((v) => v && (v.id || Number.isInteger(v.index)));
}

function ensureTypedEntityArray(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((v) => {
      if (!v || typeof v !== "object") return null;
      const id = typeof v.id === "string" ? v.id : "";
      const index = Number.isInteger(v.index) ? v.index : null;
      const type = typeof v.type === "string" ? v.type : "";
      return { id, index, type };
    })
    .filter((v) => v && (v.id || Number.isInteger(v.index)));
}

function buildHomekitConfig(platform, selections, homekitId) {
  const cfg = {};
  
  if (homekitId) cfg.id = homekitId;
  
  // 添加配对码
  if (selections.setup_code) {
    cfg.setup_code = selections.setup_code;
  }
  
  if (platform === "esp32") {
    if (selections.light.length) cfg.light = selections.light.map((item) => ({ id: item.id }));
    if (selections.switch.length) cfg.switch = selections.switch.map((item) => ({ id: item.id }));
    if (selections.sensor.length) cfg.sensor = selections.sensor.map((item) => ({ id: item.id }));
    if (selections.fan.length) cfg.fan = selections.fan.map((item) => ({ id: item.id }));
    if (selections.climate.length) cfg.climate = selections.climate.map((item) => ({ id: item.id }));
    if (selections.lock.length) cfg.lock = selections.lock.map((item) => ({ id: item.id }));
    return cfg;
  }

  if (selections.switches.length) cfg.switches = selections.switches.map((s) => s.id);
  if (selections.lights.length) cfg.lights = selections.lights.map((s) => s.id);
  if (selections.fans.length) cfg.fans = selections.fans.map((s) => s.id);
  if (selections.sensors.length) cfg.sensors = selections.sensors.map((s) => ({ id: s.id, type: s.type || "temperature" }));
  if (selections.binary_sensors.length) cfg.binary_sensors = selections.binary_sensors.map((s) => ({ id: s.id, type: s.type || "contact" }));
  return cfg;
}

function dumpOptions() {
  return {
    lineWidth: 120,
    noRefs: true,
    quotingType: '"',
  };
}

function buildOutputName(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return `${base}.homekit${ext || ".yaml"}`;
}

function applyMissingIds(text, doc, platform, selections) {
  const warnings = [];
  const idSet = collectExistingIds(doc);
  const insertPlan = {};

  const addPlan = (sectionKey, list, prefix) => {
    list.forEach((item) => {
      if (!item || item.id) return;
      if (!Number.isInteger(item.index)) {
        warnings.push(`实体缺少 id 且无法定位：${sectionKey}`);
        return;
      }
      const newId = generateId(idSet, `${prefix}_${item.index + 1}`);
      item.id = newId;
      idSet.add(newId);
      if (!insertPlan[sectionKey]) insertPlan[sectionKey] = new Map();
      insertPlan[sectionKey].set(item.index, newId);
    });
  };

  if (platform === "esp32") {
    addPlan("light", selections.light, "hk_light");
    addPlan("switch", selections.switch, "hk_switch");
    addPlan("sensor", selections.sensor, "hk_sensor");
    addPlan("fan", selections.fan, "hk_fan");
    addPlan("climate", selections.climate, "hk_climate");
    addPlan("lock", selections.lock, "hk_lock");
  } else {
    addPlan("switch", selections.switches, "hk_switch");
    addPlan("light", selections.lights, "hk_light");
    addPlan("fan", selections.fans, "hk_fan");
    addPlan("sensor", selections.sensors, "hk_sensor");
    addPlan("binary_sensor", selections.binary_sensors, "hk_binary");
  }

  const insertResult = insertIdsIntoText(text, insertPlan);
  return {
    text: insertResult.text,
    selections,
    idSet,
    warnings: warnings.concat(insertResult.warnings),
  };
}

function selectHomekitId(doc, idSet) {
  const existing = typeof doc?.homekit?.id === "string" ? doc.homekit.id.trim() : "";
  if (existing) return existing;
  return generateId(idSet, "my_hk");
}

function collectExistingIds(node, set = new Set()) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectExistingIds(item, set));
    return set;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "id" && typeof value === "string" && value.trim()) {
        set.add(value.trim());
      }
      collectExistingIds(value, set);
    }
  }
  return set;
}

function generateId(idSet, base) {
  let candidate = sanitizeId(base);
  if (!candidate) candidate = "hk_entity";
  if (!idSet.has(candidate)) return candidate;
  let i = 2;
  while (idSet.has(`${candidate}_${i}`)) i += 1;
  return `${candidate}_${i}`;
}

function sanitizeId(input) {
  if (!input) return "";
  let id = String(input).toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  id = id.replace(/^_+|_+$/g, "");
  if (!id) return "";
  if (!/^[a-z_]/.test(id)) id = `id_${id}`;
  return id;
}

function insertIdsIntoText(text, insertPlan) {
  const warnings = [];
  const lines = text.split(/\r?\n/);
  const operations = [];

  for (const [sectionKey, map] of Object.entries(insertPlan)) {
    const items = parseSectionItems(lines, sectionKey);
    if (!items.length) {
      warnings.push(`未找到配置块：${sectionKey}`);
      continue;
    }
    for (const [index, id] of map.entries()) {
      if (index >= items.length) {
        warnings.push(`无法定位 ${sectionKey} 第 ${index + 1} 项`);
        continue;
      }
      const item = items[index];
      if (item.hasId) continue;
      const indent = `${item.indent}  `;
      operations.push({
        line: item.start + 1,
        content: `${indent}id: ${id}`,
      });
    }
  }

  operations.sort((a, b) => b.line - a.line);
  for (const op of operations) {
    lines.splice(op.line, 0, op.content);
  }

  return { text: lines.join("\n"), warnings };
}

function parseSectionItems(lines, sectionKey) {
  const keyRegex = new RegExp(`^${escapeRegex(sectionKey)}:\\s*(#.*)?$`);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (keyRegex.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return [];

  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "" || line.trim().startsWith("#")) {
      end += 1;
      continue;
    }
    if (/^\S/.test(line)) break;
    end += 1;
  }

  const items = [];
  let i = start + 1;
  while (i < end) {
    const line = lines[i];
    const m = line.match(/^(\s*)-\s*(.*)$/);
    if (m) {
      const indent = m[1];
      const itemStart = i;
      let j = i + 1;
      while (j < end) {
        const m2 = lines[j].match(/^(\s*)-\s*(.*)$/);
        if (m2 && m2[1].length === indent.length) break;
        j += 1;
      }
      const blockLines = lines.slice(itemStart, j);
      const hasId = blockLines.some((l) => {
        if (new RegExp(`^${escapeRegex(indent)}-\\s*id:\\s*`).test(l)) return true;
        const idMatch = l.match(/^(\s*)id:\s*\S+/);
        return idMatch && idMatch[1].length > indent.length;
      });
      items.push({ start: itemStart, end: j, indent, hasId });
      i = j;
      continue;
    }
    i += 1;
  }

  return items;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildYamlSchema() {
  const passThrough = (tag) =>
    new yaml.Type(tag, {
      kind: "scalar",
      construct: (data) => data ?? "",
    });
  const passThroughSeq = (tag) =>
    new yaml.Type(tag, {
      kind: "sequence",
      construct: (data) => data ?? [],
    });
  const types = [
    passThrough("!lambda"),
    passThrough("!<!lambda>"),
    passThrough("!secret"),
    passThrough("!include"),
    passThrough("!include_dir_list"),
    passThrough("!include_dir_merge_list"),
    passThrough("!include_dir_merge_named"),
    passThroughSeq("!include_dir_list"),
    passThroughSeq("!include_dir_merge_list"),
    passThroughSeq("!include_dir_merge_named"),
  ];
  return yaml.DEFAULT_SCHEMA.extend(types);
}

function removeTopLevelBlock(text, key) {
  const lines = text.split(/\r?\n/);
  const keyRegex = new RegExp(`^${key}:\\s*(#.*)?$`);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (keyRegex.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return { text, removed: false };

  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "" || line.trim().startsWith("#")) {
      end += 1;
      continue;
    }
    if (/^\S/.test(line)) break;
    end += 1;
  }

  lines.splice(start, end - start);
  return { text: lines.join("\n"), removed: true };
}

function ensureExternalComponents(text, platform) {
  const localPath = platform === "esp32" ? "./homekit-esp32" : "./homekit-esp8266";
  if (text.includes(localPath)) {
    return { text, added: false };
  }

  const lines = text.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /^external_components:\s*(#.*)?$/.test(l));

  const entryLines = buildExternalComponentEntryLines(platform);

  if (startIdx === -1) {
    const block = ["# 自动插入的组件源配置", "external_components:", ...entryLines].join("\n");
    return { text: `${text}${text.endsWith("\n") ? "" : "\n"}${block}\n`, added: true };
  }

  let endIdx = startIdx + 1;
  while (endIdx < lines.length) {
    const line = lines[endIdx];
    if (line.trim() === "" || line.trim().startsWith("#")) {
      endIdx += 1;
      continue;
    }
    if (/^\S/.test(line)) break;
    endIdx += 1;
  }

  const blockLines = lines.slice(startIdx, endIdx);
   if (blockLines.some(l => l.includes(localPath))) {
    return { text, added: false };
  }

  return { text, added: false };
}

function buildExternalComponentEntryLines(platform) {
  const listIndent = "  ";
  const sourceIndent = "    ";
  const componentsIndent = "    ";
  const componentItemIndent = "      ";
  const localRepo = platform === "esp32" ? "./homekit-esp32" : "./homekit-esp8266";
  const components = platform === "esp32" ? ["homekit", "homekit_base"] : ["homekit"];

  const lines = [
    `${listIndent}- source: ${localRepo}`,
    `${componentsIndent}components:`,
  ];

  for (const c of components) {
    lines.push(`${componentItemIndent}- ${c}`);
  }

  return lines;
}

function ensureCorrectExternalComponents(text, platform) {
  const localRepo = platform === "esp32" ? "./homekit-esp32" : "./homekit-esp8266";
  const lines = text.split(/\r?\n/);
  const result = [];
  let foundCorrect = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*external_components:\s*($|#)/.test(line)) {
      let extEnd = i + 1;
      while (extEnd < lines.length) {
        const l = lines[extEnd];
        if (l.trim() === "" || l.trim().startsWith("#")) { extEnd++; continue; }
        if (/^\S/.test(l)) break;
        extEnd++;
      }
      const block = lines.slice(i, extEnd).join("\n");

      if (block.includes(localRepo) || block.includes("./homekit-esp")) {
        foundCorrect = true;
        result.push(...lines.slice(i, extEnd));
        i = extEnd - 1;
        continue;
      }

      if (!foundCorrect && block.includes("external_components")) {
        const fixedBlock = [
          "external_components:",
          `  - source: ${localRepo}`,
          `    components:`,
          `      - homekit`,
        ].join("\n");
        result.push(fixedBlock);
        foundCorrect = true;
        i = extEnd - 1;
        continue;
      }

      result.push(line);
      i = extEnd - 1;
      continue;
    }

    result.push(line);
  }

  if (!foundCorrect) {
    const fixedBlock = [
      "",
      "external_components:",
      `  - source: ${localRepo}`,
      `    components:`,
      `      - homekit`,
    ].join("\n");
    result.push(fixedBlock);
  }

  return result.join("\n");
}

async function autoBuildLoop({
  filename,
  filePath,
  runMode,
  device,
  maxAttempts,
  config = {},
  options = {},
  onLog,
  onStatus,
  abortSignal,
  onChild,
}) {
  const apiKey = String(config?.api_key || process.env.OPENAI_API_KEY || "");
  const baseUrl = String(config?.base_url || process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  const model = String(config?.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || "";
  const disableStore = String(process.env.OPENAI_DISABLE_RESPONSE_STORAGE || "").toLowerCase() === "true";

  if (!apiKey) {
    throw new Error("未配置 API Key");
  }

  const basename = path.basename(filename);
  
  let workName;
  let sourcePath = filePath;
  
  // 检查是否存在对应的 .homekit.yaml 文件
  if (!options?.output_name && !isGeneratedFileName(basename)) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const homekitName = `${base}.homekit${ext || ".yaml"}`;
    const homekitPath = path.join(ROOT_DIR, homekitName);
    
    if (fs.existsSync(homekitPath)) {
      // 使用 .homekit.yaml 作为源文件和工作文件
      workName = homekitName;
      sourcePath = homekitPath;
    }
  }
  
  if (!workName) {
    // 如果未确定工作文件名，使用标准逻辑
    if (options?.output_name) {
      workName = normalizeYamlName(options.output_name);
    } else if (isGeneratedFileName(basename)) {
      workName = basename;
    } else {
      workName = normalizeYamlName(buildAiOutputName(filename));
    }
  }
  
  const workPath = path.join(ROOT_DIR, workName);
  
  // 检查源文件是否存在
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`找不到源文件: ${sourcePath}`);
  }
  
  // 如果源文件和工作文件不同，则复制
  if (path.resolve(sourcePath) !== path.resolve(workPath)) {
    fs.copyFileSync(sourcePath, workPath);
  }

  if (onStatus) onStatus(`最大尝试次数：${maxAttempts}`);
  let lastLog = "";
  let netRetries = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (abortSignal?.aborted) {
      throw new Error("任务已取消");
    }
    if (onStatus) onStatus(`开始第 ${attempt} 次编译...`);
    const runResult = await runEsphome(runMode, workName, device, onLog, abortSignal, onChild);
    lastLog = runResult.output;
    if (runResult.aborted) {
      throw new Error("任务已取消");
    }
    if (runResult.ok) {
      const firmwarePath = findFirmwarePath(runResult.output, workName);
      return {
        ok: true,
        status: `编译成功（第 ${attempt} 次）`,
        outputName: workName,
        outputPath: workPath,
        outputText: safeReadFile(workPath),
        firmwarePath,
        reply: `编译成功：${workName}${firmwarePath ? `，固件：${firmwarePath}` : ""}`,
      };
    }

    if (isNetworkError(lastLog) && netRetries < 3) {
      netRetries += 1;
      if (onStatus) onStatus(`网络下载失败，自动重试（${netRetries}/3）...`);
      await sleep(2000 * netRetries);
      attempt -= 1;
      continue;
    }

    const errorSnippet = tailLines(lastLog, 200);
    if (onStatus) onStatus("错误摘要（末尾 200 行）:");
    if (onLog) onLog(`${errorSnippet}\n`);
    const currentYaml = fs.readFileSync(workPath, "utf8");
    if (onStatus) onStatus(`编译失败，AI 正在修复（第 ${attempt} 次）...`);
    if (abortSignal?.aborted) {
      throw new Error("任务已取消");
    }
    const newYaml = await fixYamlWithAI({
      baseUrl,
      apiKey,
      model,
      reasoningEffort,
      disableStore,
      currentYaml,
      errorSnippet,
      attempt,
    });
    fs.writeFileSync(workPath, newYaml, "utf8");
  }

  return {
    ok: false,
    status: `超过最大尝试次数（${maxAttempts} 次）仍未成功`,
    outputName: workName,
    outputPath: workPath,
    outputText: safeReadFile(workPath),
    reply: "已停止自动编译，请查看最后一次错误日志。",
    log: tailLines(lastLog, 200),
  };
}

async function startBuildJob(job, payload = {}) {
  try {
    const { filename, mode, attempts, device, config, options } = payload || {};
    if (!filename || typeof filename !== "string") {
      return emitJob(job, { type: "error", message: "缺少文件名" });
    }
    const filePath = path.join(ROOT_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return emitJob(job, { type: "error", message: "文件不存在" });
    }

    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const platform = base.includes("8266") ? "esp8266" : "esp32";
    let yamlText = fs.readFileSync(filePath, "utf8");
    yamlText = ensureCorrectExternalComponents(yamlText, platform);
    fs.writeFileSync(filePath, yamlText, "utf8");

    const maxAttempts = Math.max(1, Math.min(10, Number(attempts || 3)));
    const runMode = mode === "run" ? "run" : "compile";

    let lastLogAt = Date.now();
    const heartbeat = setInterval(() => {
      if (Date.now() - lastLogAt > 3000) {
        emitJob(job, { type: "status", message: "编译中...（暂无新日志）" });
        lastLogAt = Date.now();
      }
    }, 1500);

    const result = await autoBuildLoop({
      filename,
      filePath,
      runMode,
      device,
      maxAttempts,
      config,
      options,
      abortSignal: job.abortController.signal,
      onChild: (child) => {
        job.currentChild = child;
      },
      onLog: (chunk) => {
        lastLogAt = Date.now();
        emitJob(job, { type: "log", data: chunk });
      },
      onStatus: (message) => {
        emitJob(job, { type: "status", message });
      },
    });
    clearInterval(heartbeat);
    emitJob(job, { type: "result", ...result });
  } catch (err) {
    emitJob(job, { type: "error", message: err.message || "自动编译失败" });
  }
}

async function startGenerateJob(job, payload = {}) {
  try {
    const { instruction, mode, attempts, device, config, options } = payload || {};
    if (!instruction || typeof instruction !== "string") {
      return emitJob(job, { type: "error", message: "缺少生成指令" });
    }
    emitJob(job, { type: "status", message: "开始生成配置..." });
    const output = await generateYamlWithAI(instruction, config);
    const safeName = normalizeYamlName(options?.output_name || "generated.ai.yaml");
    const outputName = ensureUniqueName(safeName);
    const outputPath = path.join(ROOT_DIR, outputName);
    fs.writeFileSync(outputPath, output.outputText, "utf8");
    emitJob(job, { type: "status", message: `生成完成：${outputName}，开始编译...` });

    const maxAttempts = Math.max(1, Math.min(10, Number(attempts || 3)));
    const runMode = mode === "run" ? "run" : "compile";
    let lastLogAt = Date.now();
    const heartbeat = setInterval(() => {
      if (Date.now() - lastLogAt > 3000) {
        emitJob(job, { type: "status", message: "编译中...（暂无新日志）" });
        lastLogAt = Date.now();
      }
    }, 1500);

    const result = await autoBuildLoop({
      filename: outputName,
      filePath: outputPath,
      runMode,
      device,
      maxAttempts,
      config,
      options: { output_name: outputName },
      abortSignal: job.abortController.signal,
      onChild: (child) => {
        job.currentChild = child;
      },
      onLog: (chunk) => {
        lastLogAt = Date.now();
        emitJob(job, { type: "log", data: chunk });
      },
      onStatus: (message) => {
        emitJob(job, { type: "status", message });
      },
    });
    clearInterval(heartbeat);
    emitJob(job, { type: "result", ...result });
  } catch (err) {
    emitJob(job, { type: "error", message: err.message || "生成失败" });
  }
}

async function runEsphome(mode, filename, device, onLog, abortSignal, onChild) {
  const { spawn } = await import("child_process");
  return new Promise((resolve) => {
    const args = mode === "run" ? ["run", filename] : ["compile", filename];
    if (mode === "run" && device) {
      args.push("--device", device);
    }
    const child = spawn("esphome", args, { cwd: ROOT_DIR, shell: true });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill();
    }, 10 * 60 * 1000);

    child.stdout.on("data", (d) => {
      const chunk = d.toString();
      output += chunk;
      if (onLog) onLog(chunk);
    });
    child.stderr.on("data", (d) => {
      const chunk = d.toString();
      output += chunk;
      if (onLog) onLog(chunk);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, output });
    });
  });
}

async function fixYamlWithAI({ baseUrl, apiKey, model, reasoningEffort, disableStore, currentYaml, errorSnippet, attempt }) {
  const system = [
    "你是 ESPHome 配置修复助手。",
    "根据编译错误修复 YAML。",
    "必须输出完整 YAML，不能包含 Markdown 或多余解释。",
    "不要修改 external_components 配置块，即使配置格式看起来不对也不要改动。",
    "尽量保持原有结构与顺序，仅做必要修改。",
    "每处修改前加一行中文注释，说明改动原因。",
  ].join(" ");

  const input = [
    { role: "system", content: system },
    {
      role: "user",
      content: `这是第 ${attempt} 次修复。\n\n编译错误日志：\n${errorSnippet}\n\n当前 YAML：\n${currentYaml}\n\n请输出修复后的完整 YAML。`,
    },
  ];

  const data = await callOpenAI(baseUrl, apiKey, model, input, reasoningEffort, disableStore);
  const reply = extractOutputText(data);
  let outputText = stripCodeFence(reply || "");
  if (!outputText.trim()) {
    throw new Error("AI 未返回有效 YAML");
  }
  outputText = ensureCorrectExternalComponents(outputText, "esp8266");
  return outputText;
}

async function callOpenAI(baseUrl, apiKey, model, input, reasoningEffort, disableStore) {
  const isZAI = baseUrl.includes("bigmodel.cn") || baseUrl.includes("api.z.ai");
  
  if (isZAI) {
    const messages = input.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
    const systemMsg = input.find(m => m.role === "system");
    if (systemMsg) messages.unshift({ role: "system", content: systemMsg.content });
    
    const body = { model, messages, temperature: 0.7 };
    
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI 请求失败: ${resp.status} ${text}`);
    }

    const data = await resp.json();
    return { output_text: data.choices?.[0]?.message?.content || "" };
  }

  const body = {
    model,
    input,
    store: !disableStore,
  };
  if (reasoningEffort) {
    body.reasoning = { effort: reasoningEffort };
  }

  const resp = await fetch(`${baseUrl}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI 请求失败: ${resp.status} ${text}`);
  }

  return resp.json();
}

async function callOpenAIStream(baseUrl, apiKey, model, input, reasoningEffort, disableStore, onEvent) {
  const isZAI = baseUrl.includes("bigmodel.cn") || baseUrl.includes("api.z.ai");
  
  if (isZAI) {
    const messages = input.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
    const systemMsg = input.find(m => m.role === "system");
    if (systemMsg) messages.unshift({ role: "system", content: systemMsg.content });
    
    const body = { model, messages, temperature: 0.7, stream: true };
    
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok || !resp.body) {
      const text = await resp.text();
      throw new Error(`OpenAI 请求失败: ${resp.status} ${text}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        if (onEvent) {
          onEvent(parsed);
        }
      }
    }
    return;
  }

  const body = {
    model,
    input,
    store: !disableStore,
    stream: true,
  };
  if (reasoningEffort) {
    body.reasoning = { effort: reasoningEffort };
  }

  const resp = await fetch(`${baseUrl}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text();
    throw new Error(`OpenAI 请求失败: ${resp.status} ${text}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (onEvent) {
        onEvent(parsed);
      }
    }
  }
}

function tailLines(text, count) {
  const lines = String(text || "").split(/\r?\n/);
  return lines.slice(-count).join("\n");
}

function isNetworkError(log) {
  const text = String(log || "");
  return /ConnectTimeout|MaxRetryError|timed out|Connection to github\.com timed out|HTTP(S)?ConnectionPool/i.test(text);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findFirmwarePath(log, fallbackName = "") {
  const text = String(log || "");
  const buildPathMatch = text.match(/Build path:\s*(.+)$/mi);
  const buildPath = buildPathMatch ? buildPathMatch[1].trim() : "";
  const envMatch = text.match(/Processing\s+([^\s(]+)\s+\(board/i);
  const envName = envMatch ? envMatch[1].trim() : "";
  const buildingMatch = text.match(/Building\s+(.+firmware\.bin)/i);
  const buildingPath = buildingMatch ? buildingMatch[1].trim() : "";

  const candidates = [];

  if (buildingPath) {
    if (path.isAbsolute(buildingPath)) {
      candidates.push(buildingPath);
    } else if (buildPath) {
      candidates.push(path.resolve(buildPath, buildingPath));
    } else {
      candidates.push(path.resolve(ROOT_DIR, buildingPath));
    }
  }

  if (buildPath) {
    candidates.push(path.join(buildPath, "firmware.bin"));
    if (envName) {
      candidates.push(path.join(buildPath, ".pioenvs", envName, "firmware.bin"));
    }
  }

  if (envName) {
    candidates.push(path.join(ROOT_DIR, ".pioenvs", envName, "firmware.bin"));
    candidates.push(path.join(ROOT_DIR, ".esphome", "build", envName, ".pioenvs", envName, "firmware.bin"));
    candidates.push(path.join(ROOT_DIR, ".esphome", "build", envName, "firmware.bin"));
  }

  if (fallbackName) {
    const base = path.basename(fallbackName, path.extname(fallbackName));
    candidates.push(path.join(ROOT_DIR, ".esphome", "build", base, ".pioenvs", base, "firmware.bin"));
    candidates.push(path.join(ROOT_DIR, ".esphome", "build", base, "firmware.bin"));
  }

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }

  const searchRoot = path.join(ROOT_DIR, ".esphome", "build");
  const found = findLatestFirmware(searchRoot, 3);
  return found || "";
}

function findFirmwareForYaml(yamlText, filename = "") {
  // 尝试从YAML中提取设备名称
  let deviceName = "";
  try {
    const doc = safeLoadYaml(yamlText);
    if (doc && doc.esphome && doc.esphome.name) {
      deviceName = doc.esphome.name;
    }
  } catch {
    // 忽略解析错误
  }
  
  // 如果没有从YAML中获取到名称，使用文件名
  if (!deviceName && filename) {
    deviceName = path.basename(filename, path.extname(filename));
  }
  
  if (!deviceName) {
    return "";
  }
  
  // 尝试常见的固件路径
  const candidates = [
    path.join(ROOT_DIR, ".esphome", "build", deviceName, ".pioenvs", deviceName, "firmware.bin"),
    path.join(ROOT_DIR, ".esphome", "build", deviceName, "firmware.bin"),
    path.join(ROOT_DIR, ".pioenvs", deviceName, "firmware.bin"),
  ];
  
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  
  return "";
}

function findLatestFirmware(root, depth) {
  try {
    if (!fs.existsSync(root) || depth < 0) return "";
    let latest = { path: "", mtime: 0 };
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        const nested = findLatestFirmware(full, depth - 1);
        if (nested) {
          const stat = fs.statSync(nested);
          if (stat.mtimeMs > latest.mtime) {
            latest = { path: nested, mtime: stat.mtimeMs };
          }
        }
      } else if (entry.isFile() && entry.name.toLowerCase() === "firmware.bin") {
        const stat = fs.statSync(full);
        if (stat.mtimeMs > latest.mtime) {
          latest = { path: full, mtime: stat.mtimeMs };
        }
      }
    }
    return latest.path;
  } catch {
    return "";
  }
}

function safeReadFile(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function ensureWebServerBlock(text) {
  if (!/(^|\n)\s*web_server\s*:/m.test(text)) {
    const block = [
      "# 自动插入的 Web 面板配置",
      "web_server:",
      "  id: my_web",
      "  port: 80",
      "  js_include: \"v2/www.js\"",
      "  js_url: \"\"",
      "  version: 2",
    ].join("\n");
    const next = `${text}${text.endsWith("\n") ? "" : "\n"}${block}\n`;
    return { text: next, added: true, updated: false, addedKeys: [] };
  }

  const lines = text.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /^web_server\s*:\s*(#.*)?$/.test(l));
  if (startIdx === -1) {
    return { text, added: false, updated: false, addedKeys: [] };
  }

  let endIdx = startIdx + 1;
  while (endIdx < lines.length) {
    const line = lines[endIdx];
    if (line.trim() === "" || line.trim().startsWith("#")) {
      endIdx += 1;
      continue;
    }
    if (/^\S/.test(line)) break;
    endIdx += 1;
  }

  const blockLines = lines.slice(startIdx + 1, endIdx);
  let indent = "  ";
  for (const line of blockLines) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const m = line.match(/^(\s+)/);
    if (m) {
      indent = m[1];
      break;
    }
  }

  const hasKey = (key) =>
    blockLines.some((line) => {
      if (line.trim().startsWith("#")) return false;
      return line.trimStart().startsWith(`${key}:`);
    });

  const toAdd = [];
  if (!hasKey("js_include")) toAdd.push(`js_include: \"v2/www.js\"`);
  if (!hasKey("js_url")) toAdd.push(`js_url: \"\"`);
  if (!hasKey("version")) toAdd.push("version: 2");

  if (toAdd.length === 0) {
    return { text, added: false, updated: false, addedKeys: [] };
  }

  const insertLines = [
    `${indent}# 自动补全 Web 面板参数`,
    ...toAdd.map((line) => `${indent}${line}`),
  ];

  lines.splice(endIdx, 0, ...insertLines);
  return { text: lines.join("\n"), added: false, updated: true, addedKeys: toAdd.map((l) => l.split(":")[0]) };
}

function sanitizeFilename(name) {
  const base = path.basename(name);
  return base.replace(/[^\w.\-]+/g, "_");
}

function ensureUniqueName(name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let candidate = name;
  let i = 2;
  while (fs.existsSync(path.join(ROOT_DIR, candidate))) {
    candidate = `${base}_${i}${ext}`;
    i += 1;
  }
  return candidate;
}

function safeResolveFile(name) {
  const base = path.basename(name);
  if (base !== name) return null;
  const filePath = path.resolve(ROOT_DIR, base);
  if (!filePath.startsWith(ROOT_DIR)) return null;
  return filePath;
}

function normalizeBaseUrl(value) {
  let url = String(value || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, "");
}

async function haFetchJson(baseUrl, agentKey, endpoint, options = {}) {
  const url = `${normalizeBaseUrl(baseUrl)}${endpoint}`;
  const headers = { ...(options.headers || {}) };
  if (agentKey) {
    headers["x-agent-key"] = agentKey;
  }
  const resp = await fetch(url, { ...options, headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HA Agent 请求失败: ${resp.status} ${text}`);
  }
  return resp.json();
}

async function fetchHaConfigDir(baseUrl, agentKey) {
  const healthResp = await haFetchJson(baseUrl, agentKey, "/health", { method: "GET" });
  const configDir = typeof healthResp?.config_dir === "string" ? healthResp.config_dir : "/config";
  return configDir;
}

function normalizeDomain(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidDomain(domain) {
  return /^[a-z0-9_]+$/.test(domain);
}

function stripIntegrationPrefix(p, domain) {
  let out = String(p || "").replace(/\\/g, "/");
  out = out.replace(/^\/+/, "");
  const prefixes = [
    `config/custom_components/${domain}/`,
    `custom_components/${domain}/`,
    `${domain}/`,
  ];
  for (const prefix of prefixes) {
    if (out.startsWith(prefix)) {
      out = out.slice(prefix.length);
      break;
    }
  }
  return out;
}

function normalizeIntegrationFiles(files, domain) {
  const cleaned = [];
  const warnings = [];
  const seen = new Set();
  const list = Array.isArray(files) ? files : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    let p = String(item.path || "").trim();
    const content = String(item.content || "");
    if (!p) continue;
    p = stripIntegrationPrefix(p, domain);
    p = p.replace(/\\/g, "/").replace(/^\/+/, "");
    p = path.posix.normalize(p);
    if (!p || p === "." || p.startsWith("..") || p.includes("../")) {
      warnings.push(`跳过不安全路径: ${item.path}`);
      continue;
    }
    if (seen.has(p)) continue;
    seen.add(p);
    cleaned.push({ path: p, content });
  }
  return { files: cleaned, warnings };
}

function isFunctionalIntegrationFile(filePath) {
  const p = String(filePath || "").toLowerCase();
  if (!p) return false;
  if (p === "manifest.json" || p === "__init__.py" || p === "config_flow.py" || p === "strings.json") {
    return false;
  }
  if (p.startsWith("translations/")) return false;
  if (p === "services.yaml") return true;
  if (p.endsWith(".py")) return true;
  return false;
}

function extractDomainFromManifest(files) {
  const manifest = Array.isArray(files) ? files.find((f) => f.path === "manifest.json") : null;
  if (!manifest) return "";
  try {
    const parsed = JSON.parse(String(manifest.content || "{}"));
    return typeof parsed?.domain === "string" ? parsed.domain : "";
  } catch {
    return "";
  }
}

function formatHistoryForPrompt(history, maxChars = 4000) {
  if (!Array.isArray(history)) return "";
  let out = "";
  for (const item of history) {
    if (!item || typeof item !== "object") continue;
    const role = item.role === "assistant" ? "assistant" : "user";
    const content = String(item.content || "").trim();
    if (!content) continue;
    const line = `${role}: ${content}\n`;
    if (out.length + line.length > maxChars) break;
    out += line;
  }
  return out.trim();
}

function finalizeIntegrationFiles({ domain, files }) {
  const normalized = normalizeIntegrationFiles(files, domain);
  const cleaned = normalized.files;
  const warnings = [...normalized.warnings];
  const errors = [];
  const hasManifest = cleaned.some((f) => f.path === "manifest.json");
  const hasInit = cleaned.some((f) => f.path === "__init__.py");
  if (!hasManifest) errors.push("缺少 manifest.json");
  if (!hasInit) errors.push("缺少 __init__.py");
  const hasFunctional = cleaned.some((f) => isFunctionalIntegrationFile(f.path));
  if (!hasFunctional) errors.push("只生成了骨架文件，请至少生成一个平台文件或服务");
  return { files: cleaned, warnings, errors };
}

function buildFilePreview(files, maxFiles = 12, maxLines = 200, maxChars = 20000) {
  const preview = [];
  let totalChars = 0;
  const list = Array.isArray(files) ? files : [];
  for (const file of list.slice(0, maxFiles)) {
    const text = String(file.content || "");
    const lines = text.split(/\r?\n/);
    let clipped = lines.slice(0, maxLines).join("\n");
    if (lines.length > maxLines) clipped += "\n...（内容过长已截断）";
    if (totalChars + clipped.length > maxChars) {
      const remain = Math.max(0, maxChars - totalChars);
      clipped = clipped.slice(0, remain);
      preview.push({ path: file.path, content: clipped });
      break;
    }
    preview.push({ path: file.path, content: clipped });
    totalChars += clipped.length;
  }
  return preview;
}

async function generateIntegrationWithAI({ baseUrl, apiKey, model, reasoningEffort, disableStore, instruction, options, onDelta, history }) {
  const domain = normalizeDomain(options?.domain || "");
  const name = String(options?.name || "").trim();
  const version = String(options?.version || "").trim();
  const description = String(options?.description || "").trim();
  const includeConfigFlow = Boolean(options?.include_config_flow);

  const system = [
    "You are a Home Assistant custom integration generator.",
    "Return STRICT JSON only. No Markdown, no extra text.",
    "JSON schema: {\"domain\":\"...\",\"name\":\"...\",\"files\":[{\"path\":\"manifest.json\",\"content\":\"...\"},...],\"notes\":[]}.",
    "files.path must be relative to the integration root and must NOT include custom_components or domain prefixes.",
    "Use ASCII only.",
    "domain must match ^[a-z0-9_]+$ and must match manifest.json domain.",
    "manifest.json must be valid JSON and include: domain, name, version, documentation, codeowners, integration_type.",
    "Your output MUST include at least one functional file beyond skeleton (e.g., services.yaml + handler, or a platform file like sensor.py/switch.py).",
  ].join(" ");

  const historyText = formatHistoryForPrompt(history, 4000);
  const userParts = [
    `Request: ${instruction || "Generate a minimal Home Assistant integration."}`,
    `domain: ${domain || "(decide)"}`,
    `name: ${name || "(decide)"}`,
    `version: ${version || "(default 0.1.0)"}`,
    `description: ${description || ""}`,
    `include_config_flow: ${includeConfigFlow ? "true" : "false"}`,
  ];
  if (historyText) {
    userParts.push(`Conversation context:\n${historyText}`);
  }

  const input = [
    { role: "system", content: system },
    { role: "user", content: userParts.join("\n") },
  ];

  let outputText = "";
  let completedResponse = null;
  if (onDelta) {
    await callOpenAIStream(baseUrl, apiKey, model, input, reasoningEffort, disableStore, (evt) => {
      if (!evt || typeof evt !== "object") return;
      if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
        outputText += evt.delta;
        onDelta(evt.delta);
        return;
      }
      if (evt.type === "response.output_text.done" && typeof evt.text === "string") {
        if (!outputText) outputText = evt.text;
        return;
      }
      if (evt.type === "response.completed" && evt.response) {
        completedResponse = evt.response;
        return;
      }
      if (evt.type === "error") {
        const msg = evt.error?.message || "OpenAI 流式输出错误";
        throw new Error(msg);
      }
    });
    if (!outputText && completedResponse) {
      outputText = extractOutputText(completedResponse);
    }
  } else {
    const data = await callOpenAI(baseUrl, apiKey, model, input, reasoningEffort, disableStore);
    const reply = extractOutputText(data);
    outputText = reply || "";
  }

  outputText = stripCodeFence(outputText || "");

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (err) {
    throw new Error("AI 返回内容不是合法 JSON");
  }

  return {
    domain: parsed?.domain || domain,
    name: parsed?.name || name,
    files: Array.isArray(parsed?.files) ? parsed.files : [],
    notes: Array.isArray(parsed?.notes) ? parsed.notes : [],
  };
}

async function generateHaIntegration(payload = {}, onStatus, onDelta) {
  try {
    const { ha, config, instruction, options, history } = payload || {};
    const haBaseUrl = normalizeBaseUrl(ha?.base_url || process.env.HA_AGENT_URL || "");
    if (!haBaseUrl) {
      return { ok: false, status: 400, error: "缺少 HA Agent 地址" };
    }
    const agentKey = String(ha?.agent_key || process.env.HA_AGENT_KEY || "");

    const apiKey = String(config?.api_key || process.env.OPENAI_API_KEY || "");
    const baseUrl = String(config?.base_url || process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
    const model = String(config?.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
    const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || "";
    const disableStore = String(process.env.OPENAI_DISABLE_RESPONSE_STORAGE || "").toLowerCase() === "true";

    if (!apiKey) {
      return { ok: false, status: 400, error: "未配置 API Key" };
    }

    const requestedDomain = normalizeDomain(options?.domain);
    if (options?.domain && !isValidDomain(requestedDomain)) {
      return { ok: false, status: 400, error: "插件域名不合法（仅允许 a-z, 0-9, _）" };
    }

    if (onStatus) onStatus("调用 AI 生成插件...");
    const aiResult = await generateIntegrationWithAI({
      baseUrl,
      apiKey,
      model,
      reasoningEffort,
      disableStore,
      instruction: String(instruction || "").trim(),
      options: {
        domain: requestedDomain || options?.domain || "",
      },
      onDelta,
      history,
    });

    if (onStatus) onStatus("解析 AI 输出...");
    let domain = requestedDomain || normalizeDomain(aiResult.domain || "");
    if (!domain) {
      domain = normalizeDomain(extractDomainFromManifest(aiResult.files || []));
    }
    if (!domain || !isValidDomain(domain)) {
      return { ok: false, status: 400, error: "AI 未返回有效插件域名" };
    }

    const filePlan = finalizeIntegrationFiles({
      domain,
      files: aiResult.files || [],
    });

    const preview = buildFilePreview(filePlan.files, 12, 200, 20000);

    if (!filePlan.files.length) {
      return { ok: false, status: 500, error: "AI 未返回有效文件内容" };
    }

    if (filePlan.errors && filePlan.errors.length) {
      return {
        ok: false,
        status: 400,
        error: "AI 输出不完整",
        errors: filePlan.errors,
        domain,
        file_count: filePlan.files.length,
        paths: filePlan.files.map((f) => f.path),
        preview,
      };
    }

    if (onStatus) onStatus("写入 Home Assistant...");
    const configDir = await fetchHaConfigDir(haBaseUrl, agentKey);
    const baseDir = path.posix.join(configDir, "custom_components", domain);
    const writePayload = {
      files: filePlan.files.map((file) => ({
        path: path.posix.join(baseDir, file.path),
        content: file.content,
      })),
    };

    const writeResp = await haFetchJson(haBaseUrl, agentKey, "/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(writePayload),
    });

    if (onStatus) onStatus("完成");
    return {
      ok: true,
      domain,
      path: baseDir,
      written: writeResp?.written || [],
      warnings: filePlan.warnings || [],
      file_count: filePlan.files.length,
      paths: filePlan.files.map((f) => f.path),
      preview,
      message: `已生成并写入插件：${domain}`,
    };
  } catch (err) {
    return { ok: false, status: 500, error: err.message || "生成插件失败" };
  }
}

async function startHaIntegrationJob(job, payload = {}) {
  try {
    const result = await generateHaIntegration(
      payload,
      (message) => {
        emitJob(job, { type: "status", message });
      },
      (delta) => {
        emitJob(job, { type: "log", data: delta });
      },
    );
    if (result.ok) {
      emitJob(job, { type: "result", ...result });
      return;
    }
    emitJob(job, { type: "error", message: result.error || "生成失败", data: result });
  } catch (err) {
    emitJob(job, { type: "error", message: err.message || "生成失败" });
  }
}

function loadChatFileContext(context = {}) {
  const filename = typeof context?.filename === "string" ? context.filename : "";
  if (!filename) return null;
  const filePath = safeResolveFile(filename);
  if (!filePath || !fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, "utf8");
  const maxChars = 20000;
  if (text.length > maxChars) {
    return {
      filename,
      text: `${text.slice(0, maxChars)}\n...\n（内容过长，已截断）`,
      truncated: true,
    };
  }
  return { filename, text, truncated: false };
}

async function handleChat(message, config = {}, history = [], context = {}) {
  const apiKey = String(config?.api_key || process.env.OPENAI_API_KEY || "");
  const baseUrl = String(config?.base_url || process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  const model = String(config?.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || "";
  const disableStore = String(process.env.OPENAI_DISABLE_RESPONSE_STORAGE || "").toLowerCase() === "true";

  if (!apiKey) {
    return buildChatFallback(message, context);
  }

  const cleanedHistory = Array.isArray(history)
    ? history
        .filter((m) => m && typeof m === "object")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: typeof m.content === "string" ? m.content : "",
        }))
        .filter((m) => m.content)
    : [];

  const fileContext = loadChatFileContext(context);
  const systemParts = [
    "你是一个聊天助手，提供修改建议与排错思路；当用户需要时可以指导如何修改，并说明系统会自动生成/编译。",
    "不要声称你已直接改写用户文件，但可以明确说明“系统将生成新文件/自动编译”。",
    "如果已提供文件内容，请直接基于内容回答，禁止要求用户再次粘贴文件。",
    "回答要简短清晰，必须用分点列出，每点一行，行首使用“- ”，避免超长段落。",
  ];
  if (fileContext) {
    const note = fileContext.truncated ? "（内容过长已截断）" : "";
    systemParts.push(`当前已打开文件: ${fileContext.filename} ${note}`.trim());
    systemParts.push(`文件内容:\n${fileContext.text}`);
  }

  const input = [
    {
      role: "system",
      content: systemParts.join("\n\n"),
    },
    ...cleanedHistory,
    { role: "user", content: message },
  ];

  const data = await callOpenAI(baseUrl, apiKey, model, input, reasoningEffort, disableStore);
  const reply = extractOutputText(data);
  return reply || "（空响应）";
}

async function handleChatExec(message, config = {}, history = [], context = {}, options = {}, build = {}) {
  const apiKey = String(config?.api_key || process.env.OPENAI_API_KEY || "");
  const baseUrl = String(config?.base_url || process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  const model = String(config?.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || "";
  const disableStore = String(process.env.OPENAI_DISABLE_RESPONSE_STORAGE || "").toLowerCase() === "true";

  if (!apiKey) {
    throw new Error("未配置 API Key");
  }

  const fileContext = loadChatFileContext(context);
  if (!fileContext) {
    return handleChatGenerate(message, config, history, options, build);
  }

  const cleanedHistory = Array.isArray(history)
    ? history
        .filter((m) => m && typeof m === "object")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: typeof m.content === "string" ? m.content : "",
        }))
        .filter((m) => m.content)
    : [];

  const system = [
    "你是 ESPHome 配置助手，需要根据用户指令修改 YAML。",
    "必须输出完整 YAML，不能包含 Markdown 或多余解释。",
    "尽量保持原有结构与顺序，仅做必要修改。",
    "每处修改前加一行中文注释，说明改动原因。",
  ].join(" ");

  const input = [
    { role: "system", content: system },
    ...cleanedHistory,
    {
      role: "user",
      content: `修改指令：${message}\n\n原始 YAML：\n${fileContext.text}\n\n请输出修改后的完整 YAML。`,
    },
  ];

  const data = await callOpenAI(baseUrl, apiKey, model, input, reasoningEffort, disableStore);
  const reply = extractOutputText(data);
  const outputText = stripCodeFence(reply || "");
  if (!outputText.trim()) {
    throw new Error("AI 未返回有效 YAML");
  }

  const safeName = normalizeYamlName(options?.output_name || buildAiOutputName(fileContext.filename));
  const outputName = ensureUniqueName(safeName);
  const outputPath = path.join(ROOT_DIR, outputName);
  fs.writeFileSync(outputPath, outputText, "utf8");

  return {
    reply: `已生成文件：${outputName}`,
    outputName,
    outputPath,
    outputText,
  };
}

async function handleChatGenerate(message, config = {}, history = [], options = {}, build = {}) {
  const output = await generateYamlWithAI(message, config, history);
  const outputText = output.outputText;
  if (!outputText.trim()) {
    throw new Error("AI 未返回有效 YAML");
  }

  const safeName = normalizeYamlName(options?.output_name || "generated.ai.yaml");
  const outputName = ensureUniqueName(safeName);
  const outputPath = path.join(ROOT_DIR, outputName);
  fs.writeFileSync(outputPath, outputText, "utf8");

  const autoCompile = build?.auto_compile !== false;
  if (!autoCompile) {
    return {
      reply: `已生成文件：${outputName}`,
      outputName,
      outputPath,
      outputText,
    };
  }

  const compileMode = build?.mode === "run" ? "run" : "compile";
  const attempts = Math.max(1, Math.min(10, Number(build?.attempts || 3)));
  const device = typeof build?.device === "string" && build.device.trim() ? build.device.trim() : undefined;

  const result = await autoBuildLoop({
    filename: outputName,
    filePath: outputPath,
    runMode: compileMode,
    device,
    maxAttempts: attempts,
    config,
    options: { output_name: outputName },
  });

  return {
    ...result,
    reply: result.ok
      ? `已生成并编译：${result.outputName}${result.firmwarePath ? `，固件：${result.firmwarePath}` : ""}`
      : `已生成文件：${outputName}，但编译失败：${result.status}`,
  };
}

async function generateYamlWithAI(message, config = {}, history = []) {
  const apiKey = String(config?.api_key || process.env.OPENAI_API_KEY || "");
  const baseUrl = String(config?.base_url || process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  const model = String(config?.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || "";
  const disableStore = String(process.env.OPENAI_DISABLE_RESPONSE_STORAGE || "").toLowerCase() === "true";

  if (!apiKey) {
    throw new Error("未配置 API Key");
  }

  const cleanedHistory = Array.isArray(history)
    ? history
        .filter((m) => m && typeof m === "object")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: typeof m.content === "string" ? m.content : "",
        }))
        .filter((m) => m.content)
    : [];

  const system = [
    "你是 ESPHome 配置生成助手。",
    "根据用户需求生成完整 YAML。",
    "必须输出完整 YAML，不能包含 Markdown 或多余解释。",
    "尽量使用合理默认值，保持结构清晰。",
    "关键新增部分前加中文注释说明用途。",
  ].join(" ");

  const input = [
    { role: "system", content: system },
    ...cleanedHistory,
    { role: "user", content: `需求：${message}\n\n请输出完整的 ESPHome YAML。` },
  ];

  const data = await callOpenAI(baseUrl, apiKey, model, input, reasoningEffort, disableStore);
  const reply = extractOutputText(data);
  const outputText = stripCodeFence(reply || "");
  return { outputText, reply };
}

async function handleChatBuild(message, config = {}, context = {}, build = {}, options = {}) {
  const fileContext = loadChatFileContext(context);
  if (!fileContext) {
    throw new Error("请先选择 YAML 文件");
  }
  const filePath = safeResolveFile(fileContext.filename);
  if (!filePath) {
    throw new Error("文件路径无效");
  }

  const lowered = String(message || "").toLowerCase();
  const compileOnly = lowered.includes("只编译") || lowered.includes("仅编译") || lowered.includes("compile");
  const inferredMode = compileOnly ? "compile" : "run";
  const attempts = Math.max(1, Math.min(10, Number(build?.attempts || 3)));
  const device = typeof build?.device === "string" && build.device.trim() ? build.device.trim() : undefined;

  const result = await autoBuildLoop({
    filename: fileContext.filename,
    filePath,
    runMode: build?.mode === "compile" ? "compile" : inferredMode,
    device,
    maxAttempts: attempts,
    config,
    options,
  });
  const modeUsed = build?.mode === "compile" ? "compile" : inferredMode;

  return {
    ...result,
    reply: result.ok
      ? `已执行 esphome ${modeUsed}，生成文件：${result.outputName}`
      : `自动编译失败：${result.status}`,
  };
}

function extractOutputText(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.output_text === "string") return data.output_text;
  const outputs = Array.isArray(data.output) ? data.output : [];
  for (const item of outputs) {
    if (item && item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part && part.type === "output_text" && typeof part.text === "string") {
          return part.text;
        }
      }
    }
  }
  return "";
}

function buildChatFallback(message, context = {}) {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();
  if (!text) return "你还没输入内容。";
  const fileContext = loadChatFileContext(context);
  if (fileContext) {
    return `我已读取当前文件：${fileContext.filename}。你可以直接说要改哪一部分或遇到的错误，我会给出具体修改建议，并说明系统会生成新文件/自动编译。`;
  }
  if (lower.includes("homekit") && lower.includes("8266")) {
    return "ESP8266 的 HomeKit 用法是复数键：switches/lights/fans/sensors/binary_sensors，并且填实体的 id。";
  }
  if (lower.includes("web_server") || lower.includes("www.js")) {
    return "web_server 面板需要 js_include 指向你的 www.js，并确保 version=2。需要的话我可以帮你检查配置。";
  }
  if (lower.includes("报错") || lower.includes("error")) {
    return "把报错贴给我，我可以帮你定位，并给出对应的修改建议。";
  }
  return `我可以解释与给出修改建议，并说明系统如何自动生成/编译。你问的是：${text}`;
}

function stripCodeFence(text) {
  const trimmed = String(text || "").trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```$/m, "").trim();
  }
  return trimmed;
}

function normalizeYamlName(name) {
  const safe = sanitizeFilename(name || "");
  if (!safe) return "output.ai.yaml";
  const collapsed = safe.replace(/(\.ai)+(?=\.ya?ml$)/i, ".ai");
  if (!/\.ya?ml$/i.test(collapsed)) return `${collapsed}.yaml`;
  return collapsed;
}

function buildAiOutputName(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return `${base}.ai${ext || ".yaml"}`;
}

function isGeneratedFileName(filename) {
  const name = String(filename || "").toLowerCase();
  return name.includes(".homekit.") || name.includes(".ai.");
}

function addHomekitResetButton(text, platform, homekitId) {
  const hkId = homekitId || "my_hk";
  let result = text;
  
  // 添加 button 重置部分（如果不存在）
  if (!/(^|\n)\s*button\s*:/m.test(result)) {
    result += `
# HomeKit 重置按钮
button:
  - platform: template
    name: "重置 HomeKit"
    id: reset_homekit
    on_press:
      - homekit.reset_storage: ${hkId}`;
  } else if (!/(^|\n)\s*-\s*platform:\s*template.*重置 HomeKit/m.test(result)) {
    // 如果已有 button 部分但没有重置按钮，在适当位置添加
    // 简化：在 button: 后添加
    result = result.replace(/(^|\n\s*)button:\s*(?:\n\s*#.*)?/m, `$&
  - platform: template
    name: "重置 HomeKit"
    id: reset_homekit
    on_press:
      - homekit.reset_storage: ${hkId}`);
  }
  
  // 添加 text_sensor 显示配对码部分（如果不存在）
  if (!/(^|\n)\s*text_sensor\s*:/m.test(result)) {
    result += `
# 显示 HomeKit 配对码
text_sensor:
  - platform: template
    name: "HomeKit 配对码"
    id: id_homekit_setup_code
    update_interval: 1h
    lambda: |-
      std::string code = id(${hkId})->get_setup_code();
      if (code.empty()) {
        return {"等待生成"};
      }
      return {code};`;
  }
  
  return result;
}
