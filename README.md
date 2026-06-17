<p align="center">
  <img src="public/icon.svg" alt="Skills 管理器图标" width="96" height="96">
</p>

<h1 align="center">Skills 管理器</h1>

<p align="center">中文优先的桌面应用，用来统一管理、搜索、启用和编排 AI Agent Skills。</p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-111111">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-37-2356d8">
  <img alt="Node" src="https://img.shields.io/badge/Node-%3E%3D18-1f8f5f">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-e84b2f">
</p>

<p align="center">
  <img src="public/preview.svg" alt="Skills 管理器界面预览">
</p>

## 简介

Skills 管理器把本地 AI Agent Skills 当作可索引、可组合、可切换的结构化资产，而不是散落在不同工具目录里的一堆文件夹。

它会把导入的 Skill 保存到 `~/.skills-manage/store`，再通过目录符号链接或 Windows junction 启用到目标目录：

- `~/.opencode/skills`
- `~/.claude/skills`
- `~/.agents/skills`

应用只会禁用指向自身托管仓库的链接，不会删除或覆盖用户手动安装的外部 Skill。

## 功能

- 扫描 OpenCode、Claude、Agents 当前可见的 Skills。
- 导入本地 Skill 文件夹。
- 从 GitHub 联网搜索并加载包含 `SKILL.md` 的 Skill 仓库。
- 按目标环境启用或禁用托管 Skill。
- 可视化搭建 Skill 工作流，并一键调用外部执行器运行。
- 保存、应用、删除 Skill 配置方案。
- 显示托管仓库、联网下载缓存和目标目录路径。

## 要求

- Windows
- Node.js `>= 18`
- npm
- Git，联网加载 GitHub Skill 时需要
- 可选：`opencode`、`cc` 或其它可执行命令，用于运行工作流

## 安装

```bash
npm install
```

## 开发运行

```bash
npm run desktop
```

## 构建

构建 Windows 免安装桌面应用目录：

```bash
npm run build
```

输出位置：

```text
release/win-unpacked/Skills 管理器.exe
```

双击 `Skills 管理器.exe` 即可打开桌面应用，不会打开系统浏览器。

## 使用流程

1. 点击 `导入本地 Skill`，选择包含 `SKILL.md` 的目录。
2. 选择目标环境：`opencode`、`claude` 或 `agents`。
3. 点击托管 Skill 的 `启用`，让它对当前目标可见。
4. 需要保存组合时，把当前目标已启用的托管 Skills 保存为配置方案。
5. 之后可一键应用配置方案，恢复同一组 Skills。

## 联网加载

1. 在右侧 `联网搜索` 输入关键词，例如 `wechat`、`novel`、`twitter`。
2. 点击 `搜索`，应用会通过 GitHub 搜索相关仓库。
3. 点击结果中的 `联网加载`，应用会执行浅克隆并自动寻找包含 `SKILL.md` 的目录。
4. 找到后会导入到本地托管仓库，再按普通托管 Skill 启用。

联网下载缓存目录：

```text
~/.skills-manage/downloads
```

## 工作流搭建

1. 在 `工作流搭建` 区输入工作流名称。
2. 选择一个已托管 Skill。
3. 选择执行器：`OpenCode`、`Claude Code / cc` 或 `自定义命令`。
4. 输入该步骤要执行的提示词，点击 `添加步骤`。
5. 多个步骤会按顺序执行，点击 `保存工作流` 后可一键启动。

运行时会把以下内容作为输入传给执行器：

```text
使用 Skill：<skill-name>

<步骤提示词>
```

默认执行方式：

```text
opencode "<输入>"
cc "<输入>"
```

如果本机 CLI 参数不同，请选择 `自定义命令`，例如：

```text
my-agent --run
```

应用会把步骤输入追加到自定义命令参数末尾。

## 安全规则

- 导入时会复制 Skill 到 `~/.skills-manage/store/<name>`。
- 启用时会在目标目录创建目录符号链接或 junction。
- 禁用时只会移除解析到 `~/.skills-manage/store` 内的链接。
- 已存在的外部目录不会被覆盖。
- 已存在的外部链接不会被删除。

## Skill 格式

一个 Skill 是包含 `SKILL.md` 的目录：

```text
my-skill/
  SKILL.md
  scripts/
  assets/
```

## 项目结构

```text
electron/              Electron 主进程和 preload
public/                应用界面、图标和 README 预览图
src/manager.js         Skills 管理、联网搜索、工作流运行核心逻辑
scripts/build-app.js   构建免安装桌面应用
```

## 贡献

欢迎提交 Issue 和 Pull Request。建议改动前先运行：

```bash
npm run check
```

如果涉及界面或构建流程，也请运行：

```bash
npm run build
```

## 许可证

MIT
