# Skills 管理器

一个中文优先的桌面应用，用来统一管理 OpenCode、Claude、Agents 的本地 Skills。

应用会把导入的 Skill 保存到 `~/.skills-manage/store`，再通过目录符号链接或 Windows junction 启用到目标目录：

- `~/.opencode/skills`
- `~/.claude/skills`
- `~/.agents/skills`

应用只会禁用指向自身托管仓库的链接，不会删除或覆盖用户手动安装的外部 Skill。

## 安装

```bash
npm install
```

联网加载 GitHub Skill 需要本机已安装 `git`，并且能访问 GitHub。

## 开发运行

```bash
npm run desktop
```

## 构建

构建 Windows 免安装桌面应用目录：

```bash
npm run build
```

输出目录：

```text
release/win-unpacked/Skills 管理器.exe
```

双击 `Skills 管理器.exe` 即可打开桌面应用，不会打开系统浏览器。

## 功能

- 扫描 OpenCode、Claude、Agents 当前可见的 Skills。
- 导入本地 Skill 文件夹。
- 从 GitHub 联网搜索并加载包含 `SKILL.md` 的 Skill 仓库。
- 按目标环境启用或禁用托管 Skill。
- 可视化搭建 Skill 工作流，并一键调用外部执行器运行。
- 保存、应用、删除 Skill 配置方案。
- 显示托管仓库和目标目录路径。

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

## 项目结构

```text
electron/          Electron 主进程和 preload
public/            应用界面
src/manager.js     Skills 管理核心逻辑
scripts/build-app.js 构建免安装桌面应用
```

## Skill 格式

一个 Skill 是包含 `SKILL.md` 的目录：

```text
my-skill/
  SKILL.md
  scripts/
  assets/
```
