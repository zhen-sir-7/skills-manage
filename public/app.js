const targets = ["opencode", "claude", "agents"];
const api = window.skillsManage;
let state = null;
let activeTarget = "opencode";

const el = {
  targetTabs: document.querySelector("#targetTabs"),
  searchInput: document.querySelector("#searchInput"),
  typeFilter: document.querySelector("#typeFilter"),
  skillResults: document.querySelector("#skillResults"),
  resultHint: document.querySelector("#resultHint"),
  onlineQuery: document.querySelector("#onlineQuery"),
  onlineResults: document.querySelector("#onlineResults"),
  profiles: document.querySelector("#profiles"),
  profileName: document.querySelector("#profileName"),
  paths: document.querySelector("#paths"),
  toast: document.querySelector("#toast"),
  statVisible: document.querySelector("#statVisible"),
  statManaged: document.querySelector("#statManaged"),
  statProfiles: document.querySelector("#statProfiles"),
};

for (const target of targets) {
  const button = document.createElement("button");
  button.className = "targetTab";
  button.innerHTML = `<strong>${target}</strong><span>0</span>`;
  button.addEventListener("click", () => {
    activeTarget = target;
    render();
  });
  el.targetTabs.append(button);
}

document.querySelector("#refreshButton").addEventListener("click", refresh);
document.querySelector("#onlineSearchButton").addEventListener("click", searchOnline);
el.onlineQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchOnline();
});
document.querySelector("#pickFolderButton").addEventListener("click", async () => {
  const folder = await api.pickSkillFolder();
  if (!folder) return;
  const defaultName = folder.split(/[\\/]/).pop();
  const name = window.prompt("请输入 Skill 名称", defaultName);
  if (!name) return;
  await action(() => api.importSkill({ path: folder, name }), `已加载 ${name}`);
});
document.querySelector("#saveProfileButton").addEventListener("click", async () => {
  const name = el.profileName.value.trim();
  if (!name) return notify("请输入方案名称");
  await action(() => api.saveProfile({ name, target: activeTarget }), `已保存方案 ${name}`);
});
el.searchInput.addEventListener("input", renderResults);
el.typeFilter.addEventListener("change", renderResults);

refresh();

async function refresh() {
  try {
    state = await api.state();
    render();
  } catch (error) {
    notify(error.message);
  }
}

function render() {
  renderTargets();
  renderStats();
  renderResults();
  renderProfiles();
  renderPaths();
}

function renderTargets() {
  const counts = Object.fromEntries(targets.map((target) => [target, 0]));
  for (const skill of state.scanned) counts[skill.target] += 1;
  [...el.targetTabs.children].forEach((button) => {
    const target = button.querySelector("strong").textContent;
    button.classList.toggle("active", target === activeTarget);
    button.querySelector("span").textContent = `${counts[target]} 个`;
  });
}

function renderStats() {
  el.statVisible.textContent = state.scanned.length;
  el.statManaged.textContent = state.managed.length;
  el.statProfiles.textContent = state.profiles.length;
}

function renderResults() {
  const query = normalize(el.searchInput.value);
  const filter = el.typeFilter.value;
  const results = buildResults()
    .filter((skill) => matchesQuery(skill, query))
    .filter((skill) => matchesFilter(skill, filter))
    .sort((a, b) => score(b, query) - score(a, query) || a.name.localeCompare(b.name));

  el.resultHint.textContent = query ? `找到 ${results.length} 个相关 Skill` : `共 ${results.length} 个 Skill，可直接搜索关键词`;
  el.skillResults.innerHTML = "";

  if (results.length === 0) {
    el.skillResults.innerHTML = `<div class="skillCard"><div><div class="skillTitle">没有找到相关 Skill</div><div class="skillDesc">换个关键词试试，或者点击左侧“导入本地 Skill”。</div></div></div>`;
    return;
  }

  for (const skill of results) el.skillResults.append(renderSkillCard(skill));
}

function buildResults() {
  const managedByName = new Map(state.managed.map((skill) => [skill.name, skill]));
  const scannedByName = new Map();

  for (const skill of state.scanned) {
    const existing = scannedByName.get(skill.name);
    if (!existing) {
      scannedByName.set(skill.name, { ...skill, targets: [skill.target], externalPaths: skill.managed ? [] : [skill.path] });
    } else {
      existing.targets.push(skill.target);
      if (!skill.managed) existing.externalPaths.push(skill.path);
    }
  }

  const names = new Set([...managedByName.keys(), ...scannedByName.keys()]);
  return [...names].map((name) => {
    const managed = managedByName.get(name);
    const scanned = scannedByName.get(name);
    const enabled = managed?.enabled ?? [];
    return {
      name,
      title: managed?.title ?? scanned?.title ?? name,
      description: managed?.description ?? scanned?.description ?? "暂无描述",
      managed: Boolean(managed),
      source: managed?.source ?? scanned?.path ?? "-",
      targets: scanned?.targets ?? [],
      enabled,
      externalPath: scanned?.externalPaths?.[0],
    };
  });
}

function renderSkillCard(skill) {
  const card = document.createElement("div");
  card.className = "skillCard";
  const isEnabled = skill.enabled.includes(activeTarget);
  const visibleOnTarget = skill.targets.includes(activeTarget);

  card.innerHTML = `
    <div>
      <div class="skillTitle">${escapeHtml(skill.title)} ${skill.name !== skill.title ? `<span class="tag">${escapeHtml(skill.name)}</span>` : ""}</div>
      <div class="skillDesc">${escapeHtml(skill.description)}</div>
      <div class="skillMeta">
        <span class="tag ${skill.managed ? "ok" : "warn"}">${skill.managed ? "已托管" : "外部"}</span>
        <span class="tag">${skill.targets.length ? `可见于 ${skill.targets.join(" / ")}` : "暂未启用"}</span>
        ${isEnabled ? `<span class="tag ok">当前目标已启用</span>` : ""}
        ${visibleOnTarget && !isEnabled ? `<span class="tag warn">当前目标已有外部同名</span>` : ""}
      </div>
    </div>
    <div class="actions"></div>
  `;

  const actions = card.querySelector(".actions");
  if (!skill.managed) {
    actions.append(button("加载", "actionButton", () => action(() => api.importSkill({ path: skill.externalPath, name: skill.name }), `已加载 ${skill.name}`)));
  } else if (isEnabled) {
    actions.append(button("禁用", "actionButton danger", () => action(() => api.disableSkill({ name: skill.name, target: activeTarget }), `已从 ${activeTarget} 禁用`)));
  } else {
    actions.append(button("启用", "actionButton", () => action(() => api.enableSkill({ name: skill.name, target: activeTarget }), `已启用到 ${activeTarget}`)));
  }
  if (skill.managed) actions.append(button("重新加载", "actionButton secondary", () => action(() => api.importSkill({ path: skill.source, name: skill.name }), `已重新加载 ${skill.name}`)));
  return card;
}

function renderProfiles() {
  el.profiles.innerHTML = "";
  if (state.profiles.length === 0) {
    el.profiles.innerHTML = `<p>还没有配置方案。</p>`;
    return;
  }

  for (const profile of state.profiles) {
    const item = document.createElement("div");
    item.className = "profileItem";
    item.innerHTML = `
      <div class="profileTop"><span>${escapeHtml(profile.name)}</span><span class="tag">${escapeHtml(profile.target)} · ${profile.skills.length} 个</span></div>
      <div class="profileActions"></div>
    `;
    const actions = item.querySelector(".profileActions");
    actions.append(button("应用到当前目标", "", () => action(() => api.applyProfile({ name: profile.name, target: activeTarget }), `已应用 ${profile.name}`)));
    actions.append(button("删除", "", () => action(() => api.deleteProfile({ name: profile.name }), `已删除 ${profile.name}`)));
    el.profiles.append(item);
  }
}

function renderPaths() {
  el.paths.textContent = `状态目录\n${state.paths.state}\n\n托管仓库\n${state.paths.store}\n\n联网下载\n${state.paths.downloads}\n\nOpenCode\n${state.paths.targets.opencode}\n\nClaude\n${state.paths.targets.claude}\n\nAgents\n${state.paths.targets.agents}`;
}

async function searchOnline() {
  const query = el.onlineQuery.value.trim();
  if (!query) return notify("请输入联网搜索关键词");
  el.onlineResults.innerHTML = `<p>正在联网搜索...</p>`;

  try {
    const results = await api.searchOnlineSkills({ query });
    renderOnlineResults(results);
  } catch (error) {
    el.onlineResults.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    notify(error.message);
  }
}

function renderOnlineResults(results) {
  el.onlineResults.innerHTML = "";
  if (results.length === 0) {
    el.onlineResults.innerHTML = `<p>没有找到相关仓库。</p>`;
    return;
  }

  for (const result of results) {
    const item = document.createElement("div");
    item.className = "onlineItem";
    item.innerHTML = `
      <div class="onlineName">${escapeHtml(result.fullName)}</div>
      <div class="onlineDesc">${escapeHtml(result.description)}</div>
      <div class="skillMeta">
        <span class="tag">Stars ${result.stars}</span>
        <span class="tag">${escapeHtml(formatDate(result.updatedAt))}</span>
      </div>
      <div class="onlineActions"></div>
    `;
    item.querySelector(".onlineActions").append(button("联网加载", "actionButton", () => action(() => api.importOnlineSkill(result), `已联网加载 ${result.name}`)));
    el.onlineResults.append(item);
  }
}

async function action(operation, message) {
  try {
    await operation();
    notify(message ?? "已更新");
    await refresh();
  } catch (error) {
    notify(error.message);
  }
}

function matchesQuery(skill, query) {
  if (!query) return true;
  return normalize(`${skill.name} ${skill.title} ${skill.description} ${skill.targets.join(" ")}`).includes(query);
}

function matchesFilter(skill, filter) {
  if (filter === "managed") return skill.managed;
  if (filter === "external") return !skill.managed;
  if (filter === "enabled") return skill.enabled.includes(activeTarget);
  return true;
}

function score(skill, query) {
  let value = 0;
  if (skill.enabled.includes(activeTarget)) value += 30;
  if (skill.managed) value += 20;
  if (skill.targets.includes(activeTarget)) value += 10;
  if (query) {
    if (normalize(skill.name).includes(query)) value += 40;
    if (normalize(skill.title).includes(query)) value += 25;
    if (normalize(skill.description).includes(query)) value += 10;
  }
  return value;
}

function button(text, className, onClick) {
  const element = document.createElement("button");
  element.textContent = text;
  element.className = className;
  element.addEventListener("click", onClick);
  return element;
}

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function formatDate(value) {
  if (!value) return "未知更新";
  return new Date(value).toLocaleDateString("zh-CN");
}

function notify(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  setTimeout(() => el.toast.classList.remove("show"), 2400);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}
