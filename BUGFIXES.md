# https://github.com/00660/AIESP 
AIESP 项目 Bug 修复汇总

本文档记录了 AIESP 项目（ESPHome HomeKit 生成面板）的所有修复点，包含详细的修改代码行位置及修改说明。

---

## 1. 固定 HomeKit 配对码 `111-11-111`

### 问题
原代码未设置固定配对码，导致每次生成随机配对码，不便于用户使用。

### 修复位置
- **文件**: `web-panel/server.js`
- **ESP32**: 第 526-529 行
- **ESP8266**: 第 538-541 行

### 修改代码

**ESP32 (第 526 行附近)**:
```javascript
// 修改前
const cfg = {};
if (homekitId) cfg.id = homekitId;
if (selections.light.length) cfg.light = ...

// 修改后
const cfg = {};
if (homekitId) cfg.id = homekitId;
cfg.setup_code = "111-11-111";  // 添加固定配对码
if (selections.light.length) cfg.light = ...
```

**ESP8266 (第 538 行附近)**:
```javascript
// 修改前
const cfg = {};
if (homekitId) cfg.id = homekitId;
if (selections.switches.length) cfg.switches = ...

// 修改后
const cfg = {};
if (homekitId) cfg.id = homekitId;
cfg.setup_code = "111-11-111";  // 添加固定配对码
if (selections.switches.length) cfg.switches = ...
```

---

## 2. 添加 HomeKit 重置按钮和配对码传感器

### 问题
生成 YAML 时未自动添加 HomeKit 重置按钮和配对码显示传感器，导致设备端无法重置配对和查看配对码。

### 修复位置
- **文件**: `web-panel/server.js`
- **新增函数**: 第 1450-1503 行
- **调用位置 1**: 第 302 行（生成 API）
- **调用位置 2**: 第 1007 行（AI 修复后）

### 新增函数代码

```javascript
function ensureHomekitControlsBlock(text, homekitId) {
  const controlsAdded = [];
  
  const hasHomekitResetButton = text.includes(`homekit.reset_storage: ${homekitId}`) || 
                               text.includes('homekit.reset_storage:');
  
  if (!hasHomekitResetButton) {
    const buttonBlock = [
      "# HomeKit 重置按钮",
      "button:",
      "  - platform: template",
      "    name: \"重置 HomeKit\"",
      `    on_press:`,
      `      - homekit.reset_storage: ${homekitId}`,
    ].join("\n");
    text = `${text}${text.endsWith("\n") ? "" : "\n"}${buttonBlock}\n`;
    controlsAdded.push("button");
  }
  
  const hasHomekitSetupCodeSensor = text.includes('id: id_homekit_setup_code') ||
                                   text.includes('get_setup_code()');
  
  if (!hasHomekitSetupCodeSensor) {
    const textSensorBlock = [
      "# HomeKit 配对码显示",
      "text_sensor:",
      "  - platform: template",
      "    name: \"HomeKit 配对码\"",
      "    id: id_homekit_setup_code",
      "    update_interval: 1h",
      "    lambda: |-",
      `      std::string code = id(${homekitId})->get_setup_code();`,
      "      if (code.empty()) {",
      "        return {\"等待生成\"};",
      "      }",
      "      return {code};",
    ].join("\n");
    text = `${text}${text.endsWith("\n") ? "" : "\n"}${textSensorBlock}\n`;
    controlsAdded.push("text_sensor");
  }
  
  return { 
    text, 
    added: controlsAdded.length > 0, 
    controlsAdded 
  };
}
```

### 调用代码

**生成 API (第 302 行)**:
```javascript
const controlsResult = ensureHomekitControlsBlock(text, homekitId);
text = controlsResult.text;

// 在 warnings 中添加提示
if (controlsResult.added) {
  warnings.push(`已添加 HomeKit 控制组件：${controlsResult.controlsAdded.join(", ")}`);
}
```

**AI 修复后 (第 1007 行)**:
```javascript
// 确保 AI 修复后 HomeKit 控件仍然存在
try {
  const updatedYaml = fs.readFileSync(workPath, "utf8");
  const controlsResult = ensureHomekitControlsBlock(updatedYaml, homekitId);
  if (controlsResult.added) {
    fs.writeFileSync(workPath, controlsResult.text, "utf8");
    if (onStatus) onStatus(`AI 修复后重新添加 HomeKit 控件: ${controlsResult.controlsAdded.join(", ")}`);
  }
} catch (err) {
  if (onStatus) onStatus(`检查 HomeKit 控件时出错: ${err.message}`);
}
```

---

## 3. 组件库文件夹名称修复 `homekit-esp8226` → `homekit-esp8266`

### 问题
原代码拼写错误，使用了 `homekit-esp8226`，实际文件夹应为 `homekit-esp8266`。

### 修复位置
- **文件**: `web-panel/server.js`
- **第 793 行**: `ensureExternalComponents` 函数

### 修改代码

```javascript
// 修改前
const pathToken = platform === "esp32" ? "homekit-esp32" : "homekit-esp8226";

// 修改后
const pathToken = platform === "esp32" ? "homekit-esp32" : "homekit-esp8266";
```

---

## 4. External Components 语法修复

### 问题
生成 `external_components` 时格式错误，导致 ESPHome 编译失败。尝试了多种格式都失败，最终使用绝对路径解决。

### 错误尝试
1. `source: local` + `path: ./xxx` - 报错 "Shorthand only for strings"
2. `source: ./xxx` (非列表格式) - 报错 "Source is not a file system path"
3. `source: local` (简化格式) - ESPHome 不识别

### 修复位置
- **文件**: `web-panel/server.js`
- **第 827-846 行**: `buildExternalComponentEntryLines` 函数

### 最终正确格式
```javascript
function buildExternalComponentEntryLines(platform) {
  const listIndent = "  ";
  const nestedIndent = "    ";
  const relativePath = platform === "esp32" ? "./homekit-esp32" : "./homekit-esp8266";
  const components = platform === "esp32" ? ["homekit", "homekit_base"] : ["homekit"];
  
  // 使用绝对路径
  const absolutePath = path.resolve(ROOT_DIR, relativePath);

  // 正确格式：列表 + 绝对路径
  const lines = [
    `${listIndent}- source: ${absolutePath}`,
    `${nestedIndent}components:`,
  ];
  
  for (const c of components) {
    lines.push(`${nestedIndent}  - ${c}`);
  }

  return lines;
}
```

### 生成结果
```yaml
external_components:
  - source: /home/t/AIESP3/AIESP/homekit-esp8266
    components:
      - homekit
```

---

## 5. Web Server js_include 路径修复

### 问题
原代码使用 `v2/www.js`，但项目根目录只有 `www.js`，导致编译失败 "Could not find file"。

### 修复位置
- **文件**: `web-panel/server.js`
- **第 1393 行**: `ensureWebServerBlock` 函数初始模板
- **第 1436 行**: 补全函数

### 修改代码

**第 1393 行**:
```javascript
// 修改前
"  js_include: \"v2/www.js\"",

// 修改后
"  js_include: \"www.js\"",
```

**第 1436 行**:
```javascript
// 修改前
if (!hasKey("js_include")) toAdd.push(`js_include: \"v2/www.js\"`);

// 修改后
if (!hasKey("js_include")) toAdd.push(`js_include: \"www.js\"`);
```

---

## 6. 文件选择逻辑修复（优先使用 .homekit.yaml）

### 问题
编译时直接复制原始 YAML 文件，而不是使用面板生成的带 HomeKit 配置的文件。

### 修复位置
- **文件**: `web-panel/server.js`
- **第 870-933 行**: `autoBuildLoop` 函数

### 修改代码

```javascript
let workName = normalizeYamlName(options?.output_name || buildAiOutputName(filename));
let workPath = path.join(ROOT_DIR, workName);

// 总是优先检查是否有面板生成的 .homekit.yaml 文件
const homekitVersion = buildAiOutputName(filename);
const homekitPath = path.join(ROOT_DIR, homekitVersion);

if (fs.existsSync(homekitPath)) {
  // 使用面板生成的 .homekit.yaml 文件（带 HomeKit 配置）
  workName = homekitVersion;
  workPath = homekitPath;
  if (onStatus) onStatus(`使用面板生成的 HomeKit 配置: ${workName}`);
} else if (fs.existsSync(filePath)) {
  // 如果没有面板生成的文件，自动从原始文件生成 HomeKit 配置
  if (onStatus) onStatus(`自动生成 HomeKit 配置: ${workName}`);
  
  // ... 自动生成逻辑（见第 882-930 行）...
} else {
  throw new Error(`找不到待编译文件: ${filePath}`);
}
```

---

## 7. 输出文件名格式修复（.homekit.yaml 而非 .ai.yaml）

### 问题
AI 聊天生成的文件使用 `.ai.yaml` 后缀，应改为 `.homekit.yaml`。

### 修复位置
- **文件**: `web-panel/server.js`
- **第 558-567 行**: `buildOutputName` 函数
- **第 2230-2238 行**: `buildAiOutputName` 函数

### 修改代码

**buildOutputName (第 558 行)**:
```javascript
function buildOutputName(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  // 如果已经包含 .homekit 后缀，不再重复添加
  if (base.endsWith('.homekit')) {
    return `${base}${ext || ".yaml"}`;
  }
  return `${base}.homekit${ext || ".yaml"}`;
}
```

**buildAiOutputName (第 2230 行)**:
```javascript
function buildAiOutputName(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  // 如果已经包含 .homekit 后缀，不再重复添加
  if (base.endsWith('.homekit')) {
    return `${base}${ext || ".yaml"}`;
  }
  return `${base}.homekit${ext || ".yaml"}`;
}
```

**其他调用点修改**:
- 第 1089 行: `"generated.homekit.yaml"`
- 第 2062 行: `"generated.homekit.yaml"`

---

## 8. AI 修复提示增强（保留 HomeKit 配置）

### 问题
AI 自动修复 YAML 时可能删除 HomeKit 相关配置。

### 修复位置
- **文件**: `web-panel/server.js`
- **第 1169-1177 行**: `fixYamlWithAI` 函数的 system prompt

### 修改代码

```javascript
const system = [
  "你是 ESPHome 配置修复助手。",
  "根据编译错误修复 YAML。",
  "必须输出完整 YAML，不能包含 Markdown 或多余解释。",
  "尽量保持原有结构与顺序，仅做必要修改。",
  "每处修改前加一行中文注释，说明改动原因。",
  // 新增：强调保留 HomeKit 配置
  "重要：必须保留所有 HomeKit 相关配置，包括：",
  "1. homekit: 配置块及其所有子项（id、setup_code、实体映射等）",
  "2. button: 平台为 template 的 '重置 HomeKit' 按钮及其 on_press 动作",
  "3. text_sensor: 平台为 template 的 'HomeKit 配对码' 显示传感器",
  "4. external_components: 指向本地 homekit-esp32 或 homekit-esp8266 的配置",
  "如果这些配置缺失，请重新添加它们。",
].join(" ");
```

---

## 9. 固件路径查找增强

### 问题
固件路径查找深度不够，导致找不到编译输出的固件。

### 修复位置
- **文件**: `web-panel/server.js`
- **第 1333-1347 行**: `findFirmwarePath` 函数

### 修改代码

```javascript
const searchRoot = path.join(ROOT_DIR, ".esphome", "build");
const found = findLatestFirmware(searchRoot, 5);  // 从 3 改为 5
if (!found) {
  console.warn(`未找到固件文件，候选路径: ${candidates.join(", ")}`);
  console.warn(`日志片段: ${log.slice(-500)}`);
  // 新增：在项目根目录递归搜索
  const rootFound = findLatestFirmware(ROOT_DIR, 6);
  if (rootFound) {
    console.warn(`在根目录找到固件: ${rootFound}`);
    return rootFound;
  }
}
return found || "";
```

---

## 10. 设备 Web ���面按钮显示修复

### 问题
原代码过滤掉了 `button` 域，导致 HomeKit 重置按钮在 Web 界面不显示。

### 修复位置
- **文件**: `www.js`
- **第 117 行**: 渲染函数中的 filter

### 修改说明
**注意**: 此修改已还原，原代码不需要修改。原代码正确过滤了 button，ESPHome Web 界面会自动处理按钮。

---

## 11. 固件路径查找增强（支持 .homekit 后缀）

### 问题
固件路径查找时，fallbackName 包含 `.homekit` 后缀（如 `68.homekit.yaml`），但实际编译输出目录是设备名（如 `esp8266-blinker`），导致找不到固件。

### 修复位置
- **文件**: `web-panel/server.js`
- **第 1325-1338 行**: `findFirmwarePath` 函数中的 fallbackName 处理

### 修改代码

```javascript
if (fallbackName) {
  // fallbackName 可能是文件名，去掉 .yaml 后缀作为设备名
  const base = path.basename(fallbackName, path.extname(fallbackName));
  candidates.push(path.join(ROOT_DIR, ".esphome", "build", base, ".pioenvs", base, "firmware.bin"));
  candidates.push(path.join(ROOT_DIR, ".esphome", "build", base, ".pioenvs", base, "firmware.bin"));
  candidates.push(path.join(ROOT_DIR, ".esphome", "build", base, "firmware.bin"));
  // 也尝试去掉 .homekit 后缀
  const base2 = base.replace(/\.homekit$/, "");
  candidates.push(path.join(ROOT_DIR, ".esphome", "build", base2, ".pioenvs", base2, "firmware.bin"));
  candidates.push(path.join(ROOT_DIR, ".esphome", "build", base2, ".pioenvs", base2, "firmware.bin"));
  candidates.push(path.join(ROOT_DIR, ".esphome", "build", base2, "firmware.bin"));
}
```

---

## 11. 生成按钮自动编译固件（下载编译固件按钮灰色不可用）

### 问题
点击"生成新 YAML"按钮后，即使生成了固件，"下载编译固件"按钮仍然是灰色不可用状态。这是因为 `/api/generate` 接口只生成 YAML 文件，不触发编译，也没有返回 `firmwarePath` 给前端。

### 修复位置
- **文件**: `web-panel/static/app.js`
- **第 136-190 行**: `generateBtn` 点击事件处理
- **文件**: `web-panel/server.js`
- **第 305-341 行**: `/api/generate` 接口

### 修改代码

**app.js (第 147 行 - 添加 autoCompile 选项)**:
```javascript
// 修改前
const payload = {
  filename: currentFile,
  selections: collectSelections(),
  options: {
    outputName: outputNameInput.value.trim() || undefined,
    include_web_panel: Boolean(webPanelToggle?.checked),
  },
};
setStatus("生成中...");

// 修改后
const payload = {
  filename: currentFile,
  selections: collectSelections(),
  options: {
    outputName: outputNameInput.value.trim() || undefined,
    include_web_panel: Boolean(webPanelToggle?.checked),
    autoCompile: true,  // 新增：自动编译选项
  },
};
setStatus("生成并编译中...");
generateBtn.disabled = true;  // 新增：禁用按钮防止重复点击
```

**app.js (第 174-181 行 - 处理 firmwarePath)**:
```javascript
// 新增：处理返回的 firmwarePath
if (data.firmwarePath) {
  firmwareDownloadBtn.disabled = false;
  firmwareDownloadBtn.dataset.path = data.firmwarePath;
  resultSummary.textContent += `。固件已编译：${data.firmwarePath}`;
  setStatus("生成并编译完成");
} else {
  setStatus("生成完成");
}
```

**app.js (第 187-189 行 - 恢复按钮状态)**:
```javascript
// 新增：finally 中恢复按钮状态
.finally(() => {
  generateBtn.disabled = false;
});
```

**server.js (第 309-341 行 - 生成后自动编译)**:
```javascript
// 修改前
res.json({
  ok: true,
  platform,
  outputName,
  outputPath,
  outputText: text,
  warnings,
});

// 修改后
const responseData = {
  ok: true,
  platform,
  outputName,
  outputPath,
  outputText: text,
  warnings,
};

// 新增：自动编译逻辑
if (options?.autoCompile) {
  try {
    const maxAttempts = Math.max(1, Math.min(10, Number(3)));
    const compileResult = await autoBuildLoop({
      filename: outputName,
      filePath: outputPath,
      runMode: "compile",
      device: undefined,
      maxAttempts,
      config: {},
      options: { output_name: outputName },
    });
    if (compileResult.ok && compileResult.firmwarePath) {
      responseData.firmwarePath = compileResult.firmwarePath;
      responseData.reply = `编译成功，固件：${compileResult.firmwarePath}`;
    } else {
      responseData.warnings.push("编译失败，请手动编译");
    }
  } catch (compileErr) {
    responseData.warnings.push(`编译出错：${compileErr.message}`);
  }
}

res.json(responseData);
```

### 修复效果
- 点击"生成新 YAML"按钮会自动完成 YAML 生成和固件编译
- 编译成功后，"下载编译固件"按钮自动启用
- 按钮在处理过程中禁用，防止重复点击

---

## 12. 智谱 AI API 配置默认值

### 问题
前端填写了智谱 AI 的 API 配置，但服务器默认使用 OpenAI 的接口地址，导致请求失败。

### 修复位置
- **文件**: `web-panel/server.js`
- **第 16-18 行**: 默认配置常量
- **第 888, 1854, 1989, 2059, 2186 行**: baseUrl 和 model 默认值

### 修改代码

**默认配置常量 (第 16-18 行)**:
```javascript
// 修改前
const DEFAULT_OPENAI_API_KEY = "17537594cd054482b4a814cefa36c9c5.3DwRexGRtTb8EY7d";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";
const DEFAULT_OPENAI_MODEL = "gpt-5.2-codex";

// 修改后
const DEFAULT_OPENAI_API_KEY = "17537594cd054482b4a814cefa36c9c5.3DwRexGRtTb8EY7d";
const DEFAULT_OPENAI_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const DEFAULT_OPENAI_MODEL = "glm-4.5-flash";
```

**各函数中的默认值 (多处)**:
```javascript
// 修改前
const baseUrl = String(config?.base_url || process.env.OPENAI_BASE_URL || "https://api.openai.com");
const model = String(config?.model || process.env.OPENAI_MODEL || "gpt-5.2-codex");

// 修改后
const baseUrl = String(config?.base_url || process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL);
const model = String(config?.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
```

---

## 13. 智谱 AI API 接口兼容

### 问题
智谱 AI 不支持 `/v1/responses` 接口，需要使用 `/chat/completions` 接口。

### 修复位置
- **文件**: `web-panel/server.js`
- **第 1245-1270 行**: `callOpenAI` 函数
- **第 1272 行起**: `callOpenAIStream` 函数

### 修改代码

```javascript
async function callOpenAI(baseUrl, apiKey, model, input, reasoningEffort, disableStore) {
  const isZAI = baseUrl.includes("bigmodel.cn") || baseUrl.includes("api.z.ai");
  
  if (isZAI) {
    const messages = input.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
    const systemMsg = input.find(m => m.role === "system");
    if (systemMsg) messages.unshift({ role: "system", content: systemMsg.content });
    
    const body = { model, messages, temperature: 0.7 };
    
    const resp = await fetch(`${baseUrl}/chat/completions`, {  // 注意：使用 /chat/completions
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

  // 原有 OpenAI 接口逻辑...
}
```

同样修改 `callOpenAIStream` 函数。

---

## 14. 前端 placeholder 默认值

### 问题
前端输入框的 placeholder 仍是 OpenAI 格式，用户不知道应填写智谱 AI 配置。

### 修复位置
- **文件**: `web-panel/templates/index.html`
- **第 32-38 行**: API 地址和模型输入框
- **第 54 行**: AI 输出文件名

### 修改代码

```html
<!-- 修改前 -->
<input id="apiBaseUrl" placeholder="https://api.openai.com" />
<input id="apiModel" placeholder="gpt-5.2-codex" />
<input id="aiOutputName" placeholder="比如：my_config.ai.yaml" />

<!-- 修改后 -->
<input id="apiBaseUrl" placeholder="https://open.bigmodel.cn/api/paas/v4" />
<input id="apiModel" placeholder="glm-4.5-flash" />
<input id="aiOutputName" placeholder="比如：my_config.homekit.yaml" />
```

---

## 15. 下载编译固件按钮始终可用

### 问题
"下载编译固件"按钮在生成 YAML 后仍为灰色，用户必须先通过 AI 编译才能下载。

### 修复位置
- **文件**: `web-panel/server.js`
- **第 142-177 行**: `/api/download-firmware` 接口
- **文件**: `web-panel/static/app.js`
- **第 186-190 行**: 按钮点击事件
- **第 1235 行**: 页面加载时启用按钮

### 修改代码

**server.js - 自动查找最新固件**:
```javascript
app.get("/api/download-firmware", (req, res) => {
  try {
    const reqPath = typeof req.query.path === "string" ? req.query.path : "";
    let normalized;

    if (reqPath) {
      // 使用指定路径...
    } else {
      // 自动查找最新编译的固件
      const buildDir = path.join(ROOT_DIR, ".esphome", "build");
      if (!fs.existsSync(buildDir)) {
        return res.status(404).json({ error: "未找到编译目录" });
      }
      const subdirs = fs.readdirSync(buildDir).filter((d) => {
        const st = fs.statSync(path.join(buildDir, d));
        return st.isDirectory();
      });
      if (subdirs.length === 0) {
        return res.status(404).json({ error: "未找到编译固件" });
      }
      const latestDir = subdirs.sort().pop();
      const firmwarePath = path.join(buildDir, latestDir, ".pioenvs", latestDir, "firmware.bin");
      if (!fs.existsSync(firmwarePath)) {
        return res.status(404).json({ error: "未找到固件文件" });
      }
      normalized = firmwarePath;
    }

    res.download(normalized, "firmware.bin");
  } catch (err) {
    res.status(500).json({ error: err.message || "下载固件失败" });
  }
});
```

**app.js - 简化点击逻辑**:
```javascript
firmwareDownloadBtn.addEventListener("click", () => {
  window.location.href = "/api/download-firmware";
});
```

**app.js - 页面加载时启用按钮**:
```javascript
if (firmwareDownloadBtn) {
  firmwareDownloadBtn.disabled = false;
}
```

---

## 总结

| 序号 | 问题 | 文件 | 行号 |
|------|------|------|------|
| 1 | 固定配对码 | server.js | 526, 538 |
| 2 | 重置按钮/配对码传感器 | server.js | 302, 1007, 1450-1503 |
| 3 | 文件夹名称 | server.js | 793 |
| 4 | external_components 格式 | server.js | 827-846 |
| 5 | web_server js_include | server.js | 1393, 1436 |
| 6 | 文件选择逻辑 | server.js | 870-933 |
| 7 | 输出文件名 | server.js | 558, 2230 |
| 8 | AI 修复提示 | server.js | 1169-1177 |
| 9 | 固件路径 | server.js | 1333-1347 |
| 10 | (已还原) | - | - |
| 11 | (已还原) | - | - |
| 12 | 智谱AI默认配置 | server.js | 16-18, 888, 1854, 1989, 2059, 2186 |
| 13 | 智谱AI接口兼容 | server.js | 1245-1270, 1272-1312 |
| 14 | 前端placeholder | index.html | 32-38, 54 |
| 15 | 下载固件按钮 | server.js:142-177, app.js:186-190, 1235 |

---

## 生成示例配置文件 (68.homekit.yaml)

```yaml
# 修复设备名称中的下划线，避免 DHCP 和本地名称服务问题
esphome:
  name: esp8266-blinker

esp8266:
  board: esp01_1m

wifi:
  ssid: "ASUS"
  password: "89160900"
  min_auth_mode: WPA2

logger:

api:

ota:
  - platform: esphome

web_server:
  port: 80

switch:
  - platform: gpio
    pin: GPIO2
    id: onboard_led
    name: "Onboard LED"
    inverted: true 

binary_sensor:
  - platform: gpio
    id: hk_binary_1
    pin:
      number: GPIO0
      mode: INPUT_PULLUP
      inverted: true
    name: "Flash Button"
    on_press:
      - switch.toggle: onboard_led

external_components:
  - source: /home/t/AIESP3/AIESP/homekit-esp8266
    components:
      - homekit

homekit:
  id: my_hk
  setup_code: "111-11-111"
  switches:
    - "onboard_led"
  binary_sensors:
    - id: "hk_binary_1"
      type: "contact"

button:
  - platform: template
    name: "重置 HomeKit"
    on_press:
      - homekit.reset_storage: my_hk

text_sensor:
  - platform: template
    name: "HomeKit 配对码"
    id: id_homekit_setup_code
    update_interval: 1h
    lambda: |-
      std::string code = id(my_hk)->get_setup_code();
      if (code.empty()) {
        return {"等待生成"};
      }
      return {code};
```
