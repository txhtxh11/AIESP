# ESPHome HomeKit 生成面板
# 本分支修复了原项目https://github.com/00660/AIESP的部分BUG
  **见BUGFIXES.md**
  设置了固定homekit配对码111-11-111
这是一个集成式的小工具，用于读取 ESPHome YAML，自动识别 ESP32/ESP8266 并生成带 HomeKit 的新配置，同时提供 AI 聊天、自动编译修复、固件下载与 Home Assistant 插件生成能力。

**主要功能**
- 解析 ESPHome YAML，自动识别 `esp32` / `esp8266`
- 提取实体并勾选生成 HomeKit 映射，缺失 `id` 自动补全
- 自动插入 `external_components` 指向本地 `homekit-esp32` / `homekit-esp8266`
- 可选自动插入 `web_server` + `www.js` 中文面板（v2）
- AI 聊天：生成/修改 YAML、自动编译修复
- 自动编译（`esphome compile/run`）与固件下载
- 通过 `ha-agent` 生成 Home Assistant 插件并写入 `custom_components`

**目录结构**
- `web-panel/` Web 面板与 API 服务（Node.js）
- `ha-agent/` Home Assistant 写入代理（可选）
- `homekit-esp32/` ESP32 HomeKit 组件（ESPHome external_components）
- `homekit-esp8266/` ESP8266 HomeKit 组件（ESPHome external_components）
- `www.js` ESPHome `web_server` v2 前端文件
- `docker-compose.yml` 一键启动 Web 面板

**快速开始（Docker）**
1. 在项目根目录执行：
   ```bash
   docker compose up --build
   ```
2. 访问：`http://localhost:3000`
3. 将 YAML 放到项目根目录，或在面板中上传

**本地运行**
1. 安装 Node.js 20+ 与 Python 3
2. 安装 ESPHome：
   ```bash
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install esphome
   ```
3. 启动面板：
   ```bash
   cd web-panel
   npm install
   npm start
   ```
4. 访问：`http://localhost:3000`

**使用流程**
1. 选择或上传 YAML，点击“读取实体”
2. 勾选需要映射到 HomeKit 的实体
3. 设置输出文件名与是否插入中文面板
4. 点击“生成新 YAML”，下载结果文件
5. 需要编译时，使用“自动编译修复”或在聊天里输入“编译/烧录”

**AI 配置**
- 在面板中填写 `API 地址 / 模型 / API Key`（仅存浏览器本地）
- 也可通过环境变量提供默认值（启动服务时生效）

环境变量：
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`（默认 `https://api.openai.com`）
- `OPENAI_MODEL`（默认 `gpt-5.2-codex`）
- `OPENAI_DISABLE_RESPONSE_STORAGE`（`true/false`）
- `OPENAI_REASONING_EFFORT`

**HA 插件生成（可选）**
1. 在 `ha-agent/` 中修改 `docker-compose.yml` 的挂载路径，指向你的 HA `config` 目录。示例：`- /PATH_TO_YOUR_CONFIG:/config`
2. 启动代理：
   ```bash
   cd ha-agent
   docker compose up --build -d
   ```
3. 在面板中填写 `HA Agent 地址` 与 `HA Agent Key`
4. 聊天中输入“生成插件/集成/HACS + 需求”，即可写入 `custom_components`

**设备烧录说明**
- 若使用 `run` 模式烧录设备，Docker 需开放串口与权限
- 参考 `docker-compose.yml` 中的注释：`privileged: true` 与 `devices` 映射

**备注**
- 生成的 YAML 会自动插入 `external_components`，请保留 `homekit-esp32/` 与 `homekit-esp8266/` 目录
- `web_server` 将使用 `js_include: "v2/www.js"` 与 `version: 2`
