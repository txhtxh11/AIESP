const yamlSelect = document.getElementById("yamlSelect");
const loadBtn = document.getElementById("loadBtn");
const entityContainer = document.getElementById("entityContainer");
const platformChip = document.getElementById("platformChip");
const setupCodeField = document.getElementById("setupCodeField");
const generateBtn = document.getElementById("generateBtn");
const outputNameInput = document.getElementById("outputName");
const outputPreview = document.getElementById("outputPreview");
const statusEl = document.getElementById("status");
const fileSummary = document.getElementById("fileSummary");
const resultSummary = document.getElementById("resultSummary");
const uploadInput = document.getElementById("uploadInput");
const uploadBtn = document.getElementById("uploadBtn");
const downloadBtn = document.getElementById("downloadBtn");
const webPanelToggle = document.getElementById("webPanelToggle");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const apiBaseUrlInput = document.getElementById("apiBaseUrl");
const apiKeyInput = document.getElementById("apiKey");
const apiModelInput = document.getElementById("apiModel");
const aiConfigToggle = document.getElementById("aiConfigToggle");
const aiConfigPanel = document.getElementById("aiConfigPanel");
const aiConfigSave = document.getElementById("aiConfigSave");
const aiOutputNameInput = document.getElementById("aiOutputName");
const aiBuildMode = document.getElementById("aiBuildMode");
const aiBuildDevice = document.getElementById("aiBuildDevice");
const aiBuildAttempts = document.getElementById("aiBuildAttempts");
const aiBuildBtn = document.getElementById("aiBuildBtn");
const aiBuildSummary = document.getElementById("aiBuildSummary");
const firmwareDownloadBtn = document.getElementById("firmwareDownloadBtn");
const haAgentUrlInput = document.getElementById("haAgentUrl");
const haAgentKeyInput = document.getElementById("haAgentKey");
const haPluginSummary = document.getElementById("haPluginSummary");
const logFloat = document.getElementById("logFloat");
const logFloatBody = document.getElementById("logFloatBody");
const logFloatTitle = document.getElementById("logFloatTitle");
const logFloatHeader = document.getElementById("logFloatHeader");
const logFloatToggle = document.getElementById("logFloatToggle");
const logFloatClose = document.getElementById("logFloatClose");
const logFloatClear = document.getElementById("logFloatClear");
const logFloatStop = document.getElementById("logFloatStop");
let currentPlatform = null;
let currentEntities = null;
let currentFile = null;
let chatHistory = [];
let chatBusy = false;
let lastGeneratedFile = null;
let lastIntegrationInstruction = null;
let currentStreamController = null;
let currentJobId = null;

const sensorTypes = ["temperature", "humidity", "illuminance"];
const binaryTypes = ["contact", "motion", "smoke", "leak", "occupancy"];
const MAX_CHAT_HISTORY = 30;

init();

function init() {
  refreshFileList();
  restoreChatConfig();
  restoreChatHistory();
  restoreLastGenerated();
  restoreHaConfig();
  restoreIntegrationState();
  bindConfigAutosave();
  restoreActiveJob();
  restoreLogFloatPosition();
}

loadBtn.addEventListener("click", () => {
  const filename = yamlSelect.value;
  if (!filename) return;
  downloadBtn.disabled = true;
  downloadBtn.dataset.filename = "";
  firmwareDownloadBtn.disabled = true;
  firmwareDownloadBtn.dataset.path = "";
  setStatus("读取配置中...");
  fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        setStatus(data.error);
        return;
      }
      currentPlatform = data.platform;
      currentEntities = data.entities;
      currentFile = filename;
      renderEntities();
      const platformLabel = currentPlatform ? currentPlatform.toUpperCase() : "未知";
      platformChip.textContent = platformLabel;
      setupCodeField.classList.toggle("hidden", currentPlatform !== "esp8266");
      fileSummary.textContent = `已读取 ${filename}，请勾选需要的实体。`;
      setStatus("实体读取完成");
    })
    .catch((err) => {
      setStatus("读取失败");
      console.error(err);
    });
});

yamlSelect.addEventListener("change", () => {
  currentFile = yamlSelect.value || null;
});

uploadBtn.addEventListener("click", () => {
  const file = uploadInput.files && uploadInput.files[0];
  if (!file) {
    setStatus("请选择要上传的文件");
    return;
  }
  const form = new FormData();
  form.append("file", file);
  setStatus("上传中...");
  fetch("/api/upload", { method: "POST", body: form })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        setStatus(data.error);
        return;
      }
      refreshFileList(data.filename);
      setStatus(`上传完成：${data.filename}`);
    })
    .catch((err) => {
      setStatus("上传失败");
      console.error(err);
    });
});

generateBtn.addEventListener("click", () => {
  if (!currentFile) {
    setStatus("请先读取 YAML");
    return;
  }
  const payload = {
    filename: currentFile,
    selections: collectSelections(),
    options: {
      outputName: outputNameInput.value.trim() || undefined,
      include_web_panel: Boolean(webPanelToggle?.checked),
    },
  };
  setStatus("生成中...");
  fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        setStatus(data.error);
        return;
      }
      outputPreview.value = data.outputText || "";
      downloadBtn.disabled = !data.outputName;
      downloadBtn.dataset.filename = data.outputName || "";
      const warnings = (data.warnings || []).join("；");
      resultSummary.textContent = `输出文件：${data.outputName}${warnings ? `。注意：${warnings}` : ""}`;
      setStatus("生成完成");
    })
    .catch((err) => {
      setStatus("生成失败");
      console.error(err);
    });
});

downloadBtn.addEventListener("click", () => {
  const name = downloadBtn.dataset.filename;
  if (!name) return;
  window.location.href = `/api/download?filename=${encodeURIComponent(name)}`;
});

firmwareDownloadBtn.addEventListener("click", () => {
  const path = firmwareDownloadBtn.dataset.path;
  if (!path) return;
  window.location.href = `/api/download-firmware?path=${encodeURIComponent(path)}`;
});

chatSend.addEventListener("click", () => {
  sendChat();
});

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendChat();
  }
});

aiConfigToggle.addEventListener("click", () => {
  aiConfigPanel.classList.toggle("hidden");
});

aiConfigSave.addEventListener("click", () => {
  persistChatConfig();
  persistHaConfig();
  aiConfigPanel.classList.add("hidden");
  setStatus("AI 配置已保存");
});



logFloatToggle.addEventListener("click", () => {
  logFloat.classList.toggle("hidden");
});

logFloatClose.addEventListener("click", () => {
  logFloat.classList.add("hidden");
});

logFloatClear.addEventListener("click", () => {
  logFloatBody.textContent = "";
});

logFloatStop.addEventListener("click", () => {
  if (currentJobId) {
    fetch("/api/job-cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: currentJobId }),
    }).catch(() => {});
  }
  if (currentStreamController) {
    currentStreamController.abort();
    currentStreamController = null;
    appendLogLine("[已停止] 编译任务已取消");
    aiBuildSummary.textContent = "已停止";
    clearActiveJobId();
  }
});

if (logFloatHeader) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  logFloatHeader.addEventListener("pointerdown", (event) => {
    if (event.target && event.target.closest("button")) return;
    dragging = true;
    logFloatHeader.setPointerCapture(event.pointerId);
    const rect = logFloat.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
  });

  logFloatHeader.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const left = startLeft + dx;
    const top = startTop + dy;
    const maxLeft = window.innerWidth - logFloat.offsetWidth - 8;
    const maxTop = window.innerHeight - logFloat.offsetHeight - 8;
    const clampedLeft = Math.max(8, Math.min(maxLeft, left));
    const clampedTop = Math.max(8, Math.min(maxTop, top));
    logFloat.style.left = `${clampedLeft}px`;
    logFloat.style.top = `${clampedTop}px`;
    logFloat.style.right = "auto";
    logFloat.style.bottom = "auto";
  });

  logFloatHeader.addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;
    saveLogFloatPosition();
  });

  logFloatHeader.addEventListener("pointercancel", () => {
    dragging = false;
  });
}

aiBuildBtn.addEventListener("click", () => {
  if (!currentFile) {
    setStatus("请先选择 YAML 文件");
    return;
  }
  persistChatConfig();
  const attempts = Math.max(1, Math.min(10, Number(aiBuildAttempts?.value || 3)));
  const mode = aiBuildMode?.value || "compile";
  aiBuildSummary.textContent = "自动编译修复中...";
  aiBuildBtn.disabled = true;
  aiBuildBtn.textContent = "运行中...";

  fetch("/api/auto-build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: currentFile,
      mode,
      attempts,
      device: aiBuildDevice?.value.trim() || undefined,
      config: {
        base_url: apiBaseUrlInput.value.trim(),
        api_key: apiKeyInput.value.trim(),
        model: apiModelInput.value.trim(),
      },
      options: {
        output_name: aiOutputNameInput?.value.trim() || undefined,
      },
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        aiBuildSummary.textContent = data.error;
        setStatus(data.error);
        return;
      }
      if (data.outputText) {
        outputPreview.value = data.outputText;
      }
      if (data.outputName) {
        downloadBtn.disabled = false;
        downloadBtn.dataset.filename = data.outputName;
        resultSummary.textContent = `AI 已生成：${data.outputName}`;
      }
      if (data.reply) {
        appendChat("ai", data.reply);
      }
      aiBuildSummary.textContent = data.status || "完成";
      setStatus("自动编译完成");
    })
    .catch(() => {
      aiBuildSummary.textContent = "自动编译失败";
      setStatus("自动编译失败");
    })
    .finally(() => {
      aiBuildBtn.disabled = false;
      aiBuildBtn.textContent = "自动编译修复";
    });
});


function renderEntities() {
  entityContainer.innerHTML = "";
  if (!currentPlatform || !currentEntities) {
    return;
  }

  const groups = currentPlatform === "esp32"
    ? [
        { key: "light", label: "灯光" },
        { key: "switch", label: "开关" },
        { key: "sensor", label: "传感器" },
        { key: "fan", label: "风扇" },
        { key: "climate", label: "空调/温控" },
        { key: "lock", label: "门锁" },
      ]
    : [
        { key: "lights", label: "灯光", source: "light" },
        { key: "switches", label: "开关", source: "switch" },
        { key: "fans", label: "风扇", source: "fan" },
        { key: "sensors", label: "传感器", source: "sensor", withType: true },
        { key: "binary_sensors", label: "二进制传感器", source: "binary_sensor", withBinaryType: true },
      ];

  groups.forEach((group) => {
    const key = group.source || group.key;
    const items = currentEntities[key] || [];
    const section = document.createElement("div");
    section.className = "entity-group";

    const header = document.createElement("h3");
    header.textContent = `${group.label}（${items.length}）`;
    section.appendChild(header);

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "summary";
      empty.textContent = "没有可用实体";
      section.appendChild(empty);
    } else {
      items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "entity-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.group = group.key;
        checkbox.dataset.id = item.id;
        checkbox.dataset.index = item.index;

        const title = document.createElement("div");
        title.className = "entity-name";
        title.textContent = item.name || item.id || "未命名";

        const meta = document.createElement("div");
        meta.className = "entity-meta";
        const metaParts = [];
        if (item.id) metaParts.push(`id:${item.id}`);
        if (item.device_class) metaParts.push(`class:${item.device_class}`);
        if (item.platform) metaParts.push(`platform:${item.platform}`);
        if (!item.has_id) metaParts.push("将自动生成 id");
        meta.textContent = metaParts.join("  ");

        row.appendChild(checkbox);
        row.appendChild(title);

        if (group.withType) {
          const select = document.createElement("select");
          select.dataset.group = group.key;
          select.dataset.id = item.id;
          select.dataset.index = item.index;
          sensorTypes.forEach((type) => {
            const opt = document.createElement("option");
            opt.value = type;
            opt.textContent = type;
            if (item.default_type === type) opt.selected = true;
            select.appendChild(opt);
          });
          row.appendChild(select);
        } else if (group.withBinaryType) {
          const select = document.createElement("select");
          select.dataset.group = group.key;
          select.dataset.id = item.id;
          select.dataset.index = item.index;
          binaryTypes.forEach((type) => {
            const opt = document.createElement("option");
            opt.value = type;
            opt.textContent = type;
            if (item.default_binary_type === type) opt.selected = true;
            select.appendChild(opt);
          });
          row.appendChild(select);
        } else {
          row.appendChild(meta);
        }

        if (group.withType || group.withBinaryType) {
          row.appendChild(meta);
        }

        section.appendChild(row);
      });
    }

    entityContainer.appendChild(section);
  });
}

function collectSelections() {
  if (!currentPlatform) return {};
  const selections = {};

  if (currentPlatform === "esp32") {
    selections.light = collectChecked("light");
    selections.switch = collectChecked("switch");
    selections.sensor = collectChecked("sensor");
    selections.fan = collectChecked("fan");
    selections.climate = collectChecked("climate");
    selections.lock = collectChecked("lock");
    return selections;
  }

  selections.switches = collectChecked("switches");
  selections.lights = collectChecked("lights");
  selections.fans = collectChecked("fans");
  selections.sensors = collectTyped("sensors");
  selections.binary_sensors = collectTyped("binary_sensors");
  return selections;
}

function collectChecked(group) {
  const checks = Array.from(document.querySelectorAll(`input[data-group="${group}"]`));
  return checks
    .filter((c) => c.checked)
    .map((c) => ({
      id: c.dataset.id || "",
      index: c.dataset.index ? Number(c.dataset.index) : null,
    }))
    .filter((v) => v.id || Number.isInteger(v.index));
}

function collectTyped(group) {
  const checks = Array.from(document.querySelectorAll(`input[data-group="${group}"]`));
  const results = [];
  checks.forEach((check) => {
    if (!check.checked) return;
    const index = check.dataset.index ? Number(check.dataset.index) : null;
    const select = document.querySelector(`select[data-group="${group}"][data-index="${check.dataset.index}"]`);
    results.push({ id: check.dataset.id || "", index, type: select ? select.value : undefined });
  });
  return results;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function sendChat() {
  const message = chatInput.value.trim();
  if (!message) return;
  persistChatConfig();
  persistHaConfig();
  const execParse = parseExecInstruction(message);
  if (!execParse.execType && isIntegrationFollowUp(message) && lastIntegrationInstruction) {
    execParse.execType = "ha_integration";
    execParse.instruction = lastIntegrationInstruction;
  }
  if (execParse.execType === "build" && !currentFile) {
    if (lastGeneratedFile) {
      currentFile = lastGeneratedFile;
      refreshFileList(lastGeneratedFile);
    } else {
      setStatus("请先选择 YAML 文件");
      return;
    }
  }
  if (execParse.execType === "ha_integration") {
    if (chatBusy) return;
    chatBusy = true;
    chatSend.disabled = true;
    chatHistory.push({ role: "user", content: message });
    trimChatHistory();
    persistChatHistory();
    appendChat("user", message);
    chatInput.value = "";
    lastIntegrationInstruction = execParse.instruction || message;
    persistIntegrationState();
    startHaIntegrationGenerate("chat", execParse.instruction)
      .finally(() => {
        chatBusy = false;
        chatSend.disabled = false;
      });
    return;
  }
  if (chatBusy) return;
  chatBusy = true;
  chatSend.disabled = true;
  chatHistory.push({ role: "user", content: message });
  trimChatHistory();
  persistChatHistory();
  appendChat("user", message);
  chatInput.value = "";
  if (execParse.execType === "build") {
    appendChat("ai", "开始编译...");
    startStreamBuild(execParse.instruction)
      .finally(() => {
        chatBusy = false;
        chatSend.disabled = false;
      });
    return;
  }
  if (execParse.execType === "edit" && !currentFile) {
    appendChat("ai", "开始生成并编译...");
    startStreamGenerate(execParse.instruction)
      .finally(() => {
        chatBusy = false;
        chatSend.disabled = false;
      });
    return;
  }
  appendChat("ai", "处理中...");
  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: execParse.instruction,
      exec_type: execParse.execType,
      history: chatHistory,
      context: {
        filename: currentFile || "",
      },
      build: {
        mode: aiBuildMode?.value || "compile",
        attempts: Number(aiBuildAttempts?.value || 3),
        device: aiBuildDevice?.value.trim() || undefined,
      },
      options: {
        output_name: aiOutputNameInput?.value.trim() || undefined,
      },
      config: {
        base_url: apiBaseUrlInput.value.trim(),
        api_key: apiKeyInput.value.trim(),
        model: apiModelInput.value.trim(),
      },
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        appendChat("ai", data.error);
        return;
      }
      if (data.outputText) {
        outputPreview.value = data.outputText;
      }
      if (data.outputName) {
        downloadBtn.disabled = false;
        downloadBtn.dataset.filename = data.outputName;
        resultSummary.textContent = `AI 已生成：${data.outputName}`;
        currentFile = data.outputName;
        lastGeneratedFile = data.outputName;
        persistLastGenerated();
        refreshFileList(data.outputName);
      }
      if (data.firmwarePath) {
        firmwareDownloadBtn.disabled = false;
        firmwareDownloadBtn.dataset.path = data.firmwarePath;
        appendChat("ai", `固件路径：${data.firmwarePath}`);
      }
      const reply = data.reply || "（空响应）";
      chatHistory.push({ role: "assistant", content: reply });
      trimChatHistory();
      persistChatHistory();
      appendChat("ai", reply);
      if (execParse.execType && data.outputText) {
        const preview = buildPreview(data.outputText, 30);
        appendChat("ai", `预览（前 30 行）:\n${preview}`);
      }
    })
    .catch(() => appendChat("ai", "AI 服务不可用"))
    .finally(() => {
      chatBusy = false;
      chatSend.disabled = false;
    });
}

function bindConfigAutosave() {
  const inputs = [
    apiBaseUrlInput,
    apiModelInput,
    apiKeyInput,
    aiOutputNameInput,
    haAgentUrlInput,
    haAgentKeyInput,
  ].filter(Boolean);

  const handler = () => {
    persistChatConfig();
    persistHaConfig();
  };

  inputs.forEach((el) => {
    el.addEventListener("change", handler);
    el.addEventListener("blur", handler);
  });
}

function appendChat(role, text) {
  const msg = document.createElement("div");
  msg.className = `chat-message ${role}`;
  const roleEl = document.createElement("div");
  roleEl.className = "role";
  roleEl.textContent = role === "user" ? "你" : "AI";
  const useCodeBlock = role === "ai" && (text.includes("\n") || text.trim().startsWith("-"));
  const body = useCodeBlock ? document.createElement("pre") : document.createElement("div");
  if (useCodeBlock) {
    body.className = "chat-code";
  }
  body.textContent = text;
  msg.appendChild(roleEl);
  msg.appendChild(body);
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}


async function startStreamBuild(message) {
  return startStream("编译日志：", "/api/auto-build-stream", {
    filename: currentFile,
    message,
    mode: aiBuildMode?.value || "compile",
    attempts: Number(aiBuildAttempts?.value || 3),
    device: aiBuildDevice?.value.trim() || undefined,
    config: {
      base_url: apiBaseUrlInput.value.trim(),
      api_key: apiKeyInput.value.trim(),
      model: apiModelInput.value.trim(),
    },
    options: {
      output_name: aiOutputNameInput?.value.trim() || undefined,
    },
  });
}

async function startStreamGenerate(message) {
  return startStream("生成与编译日志：", "/api/auto-generate-stream", {
    instruction: message,
    mode: aiBuildMode?.value || "compile",
    attempts: Number(aiBuildAttempts?.value || 3),
    device: aiBuildDevice?.value.trim() || undefined,
    config: {
      base_url: apiBaseUrlInput.value.trim(),
      api_key: apiKeyInput.value.trim(),
      model: apiModelInput.value.trim(),
    },
    options: {
      output_name: aiOutputNameInput?.value.trim() || undefined,
    },
  });
}

async function startStream(label, endpoint, payload) {
  openLogFloat(label);
  aiBuildSummary.textContent = "进行中...";
  logFloatBody.textContent = "";
  const controller = new AbortController();
  currentStreamController = controller;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  if (!res.ok || !res.body) {
    appendLogLine("[错误] 无法建立日志流");
    return;
  }

  const reader = res.body.getReader();
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
      try {
        const evt = JSON.parse(line);
        if (evt.type === "job") {
          setActiveJobId(evt.id);
        } else if (evt.type === "log") {
          appendLogChunk(logFloatBody, evt.data);
        } else if (evt.type === "status") {
          appendLogLine(`[状态] ${evt.message}`);
        } else if (evt.type === "result") {
          if (evt.outputText) outputPreview.value = evt.outputText;
          if (evt.outputName) {
            downloadBtn.disabled = false;
            downloadBtn.dataset.filename = evt.outputName;
            resultSummary.textContent = `AI 已生成：${evt.outputName}`;
            currentFile = evt.outputName;
            lastGeneratedFile = evt.outputName;
            persistLastGenerated();
            refreshFileList(evt.outputName);
          }
          if (evt.firmwarePath) {
            firmwareDownloadBtn.disabled = false;
            firmwareDownloadBtn.dataset.path = evt.firmwarePath;
            appendLogLine(`[固件] ${evt.firmwarePath}`);
          }
          if (evt.log) {
            appendLogLine("[错误摘要] 末尾 200 行:");
            appendLogChunk(logFloatBody, `${evt.log}\n`);
          }
          aiBuildSummary.textContent = evt.ok ? "完成" : "失败";
          clearActiveJobId();
        } else if (evt.type === "error") {
          appendLogLine(`[错误] ${evt.message || "自动编译失败"}`);
          aiBuildSummary.textContent = "失败";
          clearActiveJobId();
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  currentStreamController = null;
}

function appendLogChunk(logBox, chunk) {
  const maxLines = 200;
  const text = logBox.textContent + chunk;
  const lines = text.split(/\r?\n/);
  if (lines.length > maxLines) {
    logBox.textContent = lines.slice(-maxLines).join("\n");
  } else {
    logBox.textContent = text;
  }
  logBox.scrollTop = logBox.scrollHeight;
}

function appendLogLine(line) {
  appendLogChunk(logFloatBody, `${line}\n`);
}

function openLogFloat(title) {
  if (logFloatTitle) logFloatTitle.textContent = title;
  logFloat.classList.remove("hidden");
}

function saveLogFloatPosition() {
  try {
    const rect = logFloat.getBoundingClientRect();
    localStorage.setItem("log_float_left", String(rect.left));
    localStorage.setItem("log_float_top", String(rect.top));
  } catch {
    // ignore
  }
}

function restoreLogFloatPosition() {
  try {
    const left = Number(localStorage.getItem("log_float_left"));
    const top = Number(localStorage.getItem("log_float_top"));
    if (Number.isFinite(left) && Number.isFinite(top)) {
      logFloat.style.left = `${left}px`;
      logFloat.style.top = `${top}px`;
      logFloat.style.right = "auto";
      logFloat.style.bottom = "auto";
    }
  } catch {
    // ignore
  }
}

function setActiveJobId(id) {
  currentJobId = id;
  try {
    localStorage.setItem("active_job_id", id);
  } catch {
    // ignore
  }
}

function clearActiveJobId() {
  currentJobId = null;
  try {
    localStorage.removeItem("active_job_id");
  } catch {
    // ignore
  }
}

function restoreActiveJob() {
  let jobId = "";
  try {
    jobId = localStorage.getItem("active_job_id") || "";
  } catch {
    jobId = "";
  }
  if (!jobId) return;
  fetch(`/api/job-status?jobId=${encodeURIComponent(jobId)}`)
    .then((res) => res.json())
    .then((data) => {
      if (data && data.running) {
        connectJobStream(jobId);
      } else {
        clearActiveJobId();
      }
    })
    .catch(() => clearActiveJobId());
}

async function connectJobStream(jobId) {
  openLogFloat("编译日志（恢复）");
  aiBuildSummary.textContent = "恢复中...";
  const controller = new AbortController();
  currentStreamController = controller;
  const res = await fetch(`/api/job-stream?jobId=${encodeURIComponent(jobId)}`, {
    method: "GET",
    signal: controller.signal,
  });
  if (!res.ok || !res.body) {
    appendLogLine("[错误] 无法恢复日志流");
    return;
  }
  const reader = res.body.getReader();
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
      try {
        const evt = JSON.parse(line);
        if (evt.type === "log") {
          appendLogChunk(logFloatBody, evt.data);
        } else if (evt.type === "status") {
          appendLogLine(`[状态] ${evt.message}`);
        } else if (evt.type === "result") {
          if (evt.outputText) outputPreview.value = evt.outputText;
          if (evt.outputName) {
            downloadBtn.disabled = false;
            downloadBtn.dataset.filename = evt.outputName;
            resultSummary.textContent = `AI 已生成：${evt.outputName}`;
            currentFile = evt.outputName;
            lastGeneratedFile = evt.outputName;
            persistLastGenerated();
            refreshFileList(evt.outputName);
          }
          if (evt.firmwarePath) {
            firmwareDownloadBtn.disabled = false;
            firmwareDownloadBtn.dataset.path = evt.firmwarePath;
            appendLogLine(`[固件] ${evt.firmwarePath}`);
          }
          if (evt.log) {
            appendLogLine("[错误摘要] 末尾 200 行:");
            appendLogChunk(logFloatBody, `${evt.log}\n`);
          }
          aiBuildSummary.textContent = evt.ok ? "完成" : "失败";
          clearActiveJobId();
        } else if (evt.type === "error") {
          appendLogLine(`[错误] ${evt.message || "自动编译失败"}`);
          aiBuildSummary.textContent = "失败";
          clearActiveJobId();
        }
      } catch {
        // ignore
      }
    }
  }
  currentStreamController = null;
}

function refreshFileList(selectName) {
  setStatus("加载文件列表中...");
  fetch("/api/yaml-files")
    .then((res) => res.json())
    .then((data) => {
      yamlSelect.innerHTML = "";
      if (!data.files || data.files.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "未找到 YAML 文件";
        yamlSelect.appendChild(opt);
        setStatus("没有 YAML 文件可用");
        return;
      }
      data.files.forEach((file) => {
        const opt = document.createElement("option");
        opt.value = file;
        opt.textContent = file;
        if (selectName && file === selectName) opt.selected = true;
        yamlSelect.appendChild(opt);
      });
      setStatus("请选择 YAML 并读取实体");
    })
    .catch(() => setStatus("加载失败"));
}

function buildPreview(text, maxLines) {
  const lines = String(text || "").split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n");
}

function parseExecInstruction(message) {
  const text = String(message || "").trim();
  const buildKeywords = ["编译", "构建", "build", "运行", "run", "烧录", "上传", "刷写"];
  const editKeywords = ["改", "修改", "修", "生成", "配置"];
  const pluginKeywords = ["插件", "集成", "integration", "hacs"];
  const createKeywords = ["生成", "创建", "编写", "写", "开发", "制作", "做"];
  const hasPlugin = pluginKeywords.some((k) => text.toLowerCase().includes(k.toLowerCase()));
  const hasCreate = createKeywords.some((k) => text.includes(k));
  if (hasPlugin && hasCreate) return { execType: "ha_integration", instruction: text };
  const isBuild = buildKeywords.some((k) => text.toLowerCase().includes(k.toLowerCase()));
  if (isBuild) return { execType: "build", instruction: text };
  const isEdit = editKeywords.some((k) => text.includes(k));
  if (isEdit) return { execType: "edit", instruction: text };
  return { execType: null, instruction: text };
}

function isIntegrationFollowUp(message) {
  const text = String(message || "").trim();
  if (!text) return false;
  const followupKeywords = ["重新生成", "重做", "再来", "按你说的", "继续", "完善", "补全", "改进"];
  return followupKeywords.some((k) => text.includes(k));
}

function restoreChatConfig() {
  try {
    const baseUrl = localStorage.getItem("ai_base_url") || "";
    const model = localStorage.getItem("ai_model") || "";
    const apiKey = localStorage.getItem("ai_api_key") || "";
    const outputName = localStorage.getItem("ai_output_name") || "";
    const buildMode = localStorage.getItem("ai_build_mode") || "compile";
    const buildAttempts = localStorage.getItem("ai_build_attempts") || "3";
    const buildDevice = localStorage.getItem("ai_build_device") || "";
    if (apiBaseUrlInput) apiBaseUrlInput.value = baseUrl;
    if (apiModelInput) apiModelInput.value = model;
    if (apiKeyInput) apiKeyInput.value = apiKey;
    if (aiOutputNameInput) aiOutputNameInput.value = outputName;
    if (aiBuildMode) aiBuildMode.value = buildMode;
    if (aiBuildAttempts) aiBuildAttempts.value = buildAttempts;
    if (aiBuildDevice) aiBuildDevice.value = buildDevice;
  } catch {
    // ignore
  }
}

function persistChatConfig() {
  try {
    if (apiBaseUrlInput) localStorage.setItem("ai_base_url", apiBaseUrlInput.value.trim());
    if (apiModelInput) localStorage.setItem("ai_model", apiModelInput.value.trim());
    if (apiKeyInput) localStorage.setItem("ai_api_key", apiKeyInput.value.trim());
    if (aiOutputNameInput) localStorage.setItem("ai_output_name", aiOutputNameInput.value.trim());
    if (aiBuildMode) localStorage.setItem("ai_build_mode", aiBuildMode.value);
    if (aiBuildAttempts) localStorage.setItem("ai_build_attempts", aiBuildAttempts.value);
    if (aiBuildDevice) localStorage.setItem("ai_build_device", aiBuildDevice.value.trim());
  } catch {
    // ignore
  }
}

function buildHaIntegrationPayload(instructionOverride) {
  const baseUrl = normalizeHaUrl(haAgentUrlInput?.value.trim() || "");
  if (!baseUrl) {
    return { error: "请先填写 HA Agent 地址" };
  }
  const agentKey = haAgentKeyInput?.value.trim() || "";
  const apiKey = apiKeyInput?.value.trim() || "";
  if (!apiKey) {
    return { error: "请先填写 API Key" };
  }

  const instruction = String(instructionOverride || "").trim();
  if (!instruction) {
    return { error: "请描述要生成的插件需求" };
  }

  const payload = {
    ha: {
      base_url: baseUrl,
      agent_key: agentKey,
    },
    instruction,
    options: {},
    config: {
      base_url: apiBaseUrlInput?.value.trim() || "",
      api_key: apiKey,
      model: apiModelInput?.value.trim() || "",
    },
  };
  return { payload };
}

function normalizeHaUrl(value) {
  let url = String(value || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, "");
}

function startHaIntegrationGenerate(source, instructionOverride) {
  persistHaConfig();
  const payloadResult = buildHaIntegrationPayload(instructionOverride);
  if (payloadResult.error) {
    const msg = payloadResult.error;
    if (haPluginSummary) haPluginSummary.textContent = msg;
    setStatus(msg);
    openLogFloat("插件生成日志");
    appendLogLine(`[错误] ${msg}`);
    return Promise.resolve();
  }

  if (haPluginSummary) haPluginSummary.textContent = "生成中...";
  setStatus("生成 HA 插件中...");

  return startHaIntegrationStream(payloadResult.payload, source);
}

function formatIntegrationPreview(preview) {
  const blocks = preview.map((item) => {
    const header = `--- ${item.path} ---`;
    const body = item.content || "";
    return `${header}\n${body}`;
  });
  return `生成文件预览（部分）：\n${blocks.join("\n\n")}`;
}

function trimHistoryForIntegration(history) {
  if (!Array.isArray(history)) return [];
  const max = 12;
  return history
    .slice(-max)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content : "",
    }))
    .filter((m) => m.content);
}

async function startHaIntegrationStream(payload, source) {
  if (haPluginSummary) haPluginSummary.textContent = "生成中...";
  setStatus("生成 HA 插件中...");
  openLogFloat("插件生成日志");
  logFloatBody.textContent = "";
  appendLogLine("[状态] 开始生成插件...");

  const res = await fetch("/api/ha-integration-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      history: trimHistoryForIntegration(chatHistory),
    }),
  });

  if (!res.ok || !res.body) {
    const msg = "无法建立生成流";
    if (haPluginSummary) haPluginSummary.textContent = msg;
    setStatus(msg);
    appendLogLine(`[错误] ${msg}`);
    return;
  }

  const reader = res.body.getReader();
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
      try {
        const evt = JSON.parse(line);
        if (evt.type === "status") {
          const msg = `[状态] ${evt.message}`;
          if (haPluginSummary) haPluginSummary.textContent = msg;
          setStatus(msg);
          appendLogLine(msg);
        } else if (evt.type === "log") {
          appendLogChunk(logFloatBody, evt.data || "");
        } else if (evt.type === "result") {
          const warnings = Array.isArray(evt.warnings) && evt.warnings.length ? `，注意：${evt.warnings.join("；")}` : "";
          const msg = `已生成插件：${evt.domain || ""}，路径：${evt.path || ""}${warnings}`;
          if (haPluginSummary) haPluginSummary.textContent = msg;
          setStatus(msg);
          appendLogLine(msg);
          if (Array.isArray(evt.preview) && evt.preview.length) {
            const previewText = formatIntegrationPreview(evt.preview);
            appendLogChunk(logFloatBody, `${previewText}\n`);
          }
        } else if (evt.type === "error") {
          const data = evt.data || {};
          const detail = Array.isArray(data.errors) && data.errors.length ? `：${data.errors.join("；")}` : "";
          const msg = `[错误] ${evt.message || "生成失败"}${detail}`;
          if (haPluginSummary) haPluginSummary.textContent = msg;
          setStatus(msg);
          appendLogLine(msg);
          if (Array.isArray(data.preview) && data.preview.length) {
            const previewText = formatIntegrationPreview(data.preview);
            appendLogChunk(logFloatBody, `${previewText}\n`);
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }
}

function restoreHaConfig() {
  try {
    const haUrl = localStorage.getItem("ha_agent_url") || "";
    const haKey = localStorage.getItem("ha_agent_key") || "";
    if (haAgentUrlInput) haAgentUrlInput.value = haUrl;
    if (haAgentKeyInput) haAgentKeyInput.value = haKey;
  } catch {
    // ignore
  }
}

function persistHaConfig() {
  try {
    if (haAgentUrlInput) localStorage.setItem("ha_agent_url", haAgentUrlInput.value.trim());
    if (haAgentKeyInput) localStorage.setItem("ha_agent_key", haAgentKeyInput.value.trim());
  } catch {
    // ignore
  }
}

function restoreIntegrationState() {
  try {
    lastIntegrationInstruction = localStorage.getItem("ha_integration_instruction") || null;
  } catch {
    lastIntegrationInstruction = null;
  }
}

function persistIntegrationState() {
  try {
    if (lastIntegrationInstruction) {
      localStorage.setItem("ha_integration_instruction", lastIntegrationInstruction);
    }
  } catch {
    // ignore
  }
}

function restoreLastGenerated() {
  try {
    lastGeneratedFile = localStorage.getItem("last_generated_yaml") || null;
  } catch {
    lastGeneratedFile = null;
  }
}

function persistLastGenerated() {
  try {
    if (lastGeneratedFile) {
      localStorage.setItem("last_generated_yaml", lastGeneratedFile);
    }
  } catch {
    // ignore
  }
}

function trimChatHistory() {
  if (chatHistory.length <= MAX_CHAT_HISTORY) return;
  chatHistory = chatHistory.slice(-MAX_CHAT_HISTORY);
}

function restoreChatHistory() {
  try {
    const raw = localStorage.getItem("ai_chat_history");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    chatHistory = parsed
      .filter((m) => m && typeof m === "object")
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: typeof m.content === "string" ? m.content : "",
      }))
      .filter((m) => m.content);
    chatBox.innerHTML = "";
    chatHistory.forEach((m) => appendChat(m.role === "assistant" ? "ai" : "user", m.content));
  } catch {
    // ignore
  }
}

function persistChatHistory() {
  try {
    localStorage.setItem("ai_chat_history", JSON.stringify(chatHistory));
  } catch {
    // ignore
  }
}
