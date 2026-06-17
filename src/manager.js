import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const APP_DIR = path.join(os.homedir(), ".skills-manage");
export const STORE_DIR = path.join(APP_DIR, "store");
export const DOWNLOADS_DIR = path.join(APP_DIR, "downloads");
export const DB_PATH = path.join(APP_DIR, "skills.json");
export const PROFILES_PATH = path.join(APP_DIR, "profiles.json");
const execFileAsync = promisify(execFile);

export const TARGETS = {
  opencode: path.join(os.homedir(), ".opencode", "skills"),
  claude: path.join(os.homedir(), ".claude", "skills"),
  agents: path.join(os.homedir(), ".agents", "skills"),
};

export async function ensureState() {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await writeJsonIfMissing(DB_PATH, { skills: {} });
  await writeJsonIfMissing(PROFILES_PATH, { profiles: {} });
}

export async function scanSkills(target = "all") {
  await ensureState();
  const rows = [];
  for (const [targetName, targetPath] of selectedTargets(target)) {
    for (const skill of await skillsInDir(targetPath)) {
      rows.push({ target: targetName, name: skill.name, managed: await isManagedLink(skill.path), path: skill.path, ...skill.summary });
    }
  }
  return rows;
}

export async function listManagedSkills(target) {
  await ensureState();
  const db = await readJson(DB_PATH);
  const rows = [];
  for (const [name, skill] of Object.entries(db.skills)) {
    const enabled = target ? (await isEnabled(name, target) ? [target] : []) : await enabledTargets(name);
    rows.push({ name, enabled, source: skill.source ?? "-", path: skill.path, importedAt: skill.importedAt, ...(await readSkillSummary(skill.path)) });
  }
  return rows;
}

export async function importSkill(input, requestedName) {
  await ensureState();
  if (!input) throw new Error("Missing skill path.");

  const source = path.resolve(input);
  const stat = await fs.stat(source).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`Skill path must be an existing directory: ${source}`);
  await assertSkillDir(source);

  const name = normalizeName(requestedName ?? path.basename(source));
  const destination = path.join(STORE_DIR, name);
  await fs.rm(destination, { recursive: true, force: true });
  await fs.cp(source, destination, { recursive: true });

  const db = await readJson(DB_PATH);
  db.skills[name] = { path: destination, source, importedAt: new Date().toISOString() };
  await writeJson(DB_PATH, db);
  return { name, path: destination, source };
}

export async function searchOnlineSkills(query) {
  await ensureState();
  const term = String(query ?? "").trim();
  if (!term) throw new Error("请输入搜索关键词。");

  const repos = new Map();
  for (const searchTerm of [`${term} skill`, `${term} agent`, term]) {
    for (const repo of await searchGithubRepositories(searchTerm)) {
      if (!repos.has(repo.id)) repos.set(repo.id, repo);
    }
    if (repos.size >= 12) break;
  }

  return [...repos.values()].slice(0, 12).map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description ?? "暂无描述",
    url: repo.html_url,
    cloneUrl: repo.clone_url,
    stars: repo.stargazers_count ?? 0,
    updatedAt: repo.updated_at,
  }));
}

async function searchGithubRepositories(query) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "12");

  const response = await fetch(url, { headers: { accept: "application/vnd.github+json", "user-agent": "skills-manage" } });
  if (!response.ok) throw new Error(`联网搜索失败：GitHub 返回 ${response.status}`);
  const data = await response.json();
  return data.items ?? [];
}

export async function importOnlineSkill(payload) {
  await ensureState();
  const cloneUrl = String(payload?.cloneUrl ?? "").trim();
  if (!cloneUrl || !cloneUrl.startsWith("https://github.com/")) throw new Error("只支持从 GitHub HTTPS 仓库加载 Skill。");

  await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
  const repoName = normalizeName(payload.fullName ?? payload.name ?? path.basename(cloneUrl, ".git"));
  const checkoutPath = path.join(DOWNLOADS_DIR, `${repoName}-${Date.now()}`);
  await execFileAsync("git", ["clone", "--depth", "1", cloneUrl, checkoutPath], { windowsHide: true, timeout: 120000 });

  const skillDirs = await findSkillDirs(checkoutPath);
  if (skillDirs.length === 0) throw new Error("仓库中没有找到包含 SKILL.md 的目录。");
  const skillPath = pickSkillDir(skillDirs, payload.skillPath);
  const name = normalizeName(payload.importName ?? path.basename(skillPath));
  return importSkill(skillPath, name);
}

export async function enableSkill(name, target = "opencode") {
  await ensureState();
  const normalizedName = normalizeName(name);
  const db = await readJson(DB_PATH);
  const skill = db.skills[normalizedName];
  if (!skill) throw new Error(`Unknown managed skill: ${normalizedName}`);
  await assertSkillDir(skill.path);
  await linkSkill(normalizedName, skill.path, target);
  return { name: normalizedName, target };
}

export async function disableSkill(name, target = "opencode") {
  await ensureState();
  const normalizedName = normalizeName(name);
  await unlinkManagedSkill(normalizedName, target);
  return { name: normalizedName, target };
}

export async function saveProfile(name, target = "opencode") {
  await ensureState();
  const normalizedName = normalizeName(name);
  const skills = [];
  for (const skill of await skillsInDir(targetDir(target))) {
    if (await isManagedLink(skill.path)) skills.push(skill.name);
  }

  const state = await readJson(PROFILES_PATH);
  state.profiles[normalizedName] = { target, skills, savedAt: new Date().toISOString() };
  await writeJson(PROFILES_PATH, state);
  return { name: normalizedName, target, skills };
}

export async function applyProfile(name, overrideTarget) {
  await ensureState();
  const normalizedName = normalizeName(name);
  const state = await readJson(PROFILES_PATH);
  const profile = state.profiles[normalizedName];
  if (!profile) throw new Error(`Unknown profile: ${normalizedName}`);

  const target = overrideTarget ?? profile.target;
  const db = await readJson(DB_PATH);
  const wanted = new Set(profile.skills);

  for (const skill of await skillsInDir(targetDir(target))) {
    if ((await isManagedLink(skill.path)) && !wanted.has(skill.name)) await unlinkManagedSkill(skill.name, target);
  }

  for (const skillName of wanted) {
    const skill = db.skills[skillName];
    if (!skill) throw new Error(`Profile references unknown managed skill: ${skillName}`);
    await linkSkill(skillName, skill.path, target);
  }

  return { name: normalizedName, target, skills: profile.skills };
}

export async function deleteProfile(name) {
  await ensureState();
  const normalizedName = normalizeName(name);
  const state = await readJson(PROFILES_PATH);
  delete state.profiles[normalizedName];
  await writeJson(PROFILES_PATH, state);
  return { name: normalizedName };
}

export async function listProfiles() {
  await ensureState();
  const state = await readJson(PROFILES_PATH);
  return Object.entries(state.profiles).map(([name, profile]) => ({ name, ...profile }));
}

export function getPaths() {
  return { state: APP_DIR, store: STORE_DIR, downloads: DOWNLOADS_DIR, targets: TARGETS };
}

async function linkSkill(name, sourcePath, target) {
  const targetPath = targetDir(target);
  await fs.mkdir(targetPath, { recursive: true });
  const linkPath = path.join(targetPath, name);
  const existing = await fs.lstat(linkPath).catch(() => null);

  if (existing) {
    if (existing.isSymbolicLink() && (await sameLinkTarget(linkPath, sourcePath))) return;
    throw new Error(`Refusing to overwrite existing skill at ${linkPath}`);
  }

  await fs.symlink(sourcePath, linkPath, process.platform === "win32" ? "junction" : "dir");
}

async function unlinkManagedSkill(name, target) {
  const linkPath = path.join(targetDir(target), name);
  const stat = await fs.lstat(linkPath).catch(() => null);
  if (!stat) return;
  if (!stat.isSymbolicLink()) throw new Error(`Refusing to remove non-symlink skill: ${linkPath}`);
  if (!(await isManagedLink(linkPath))) throw new Error(`Refusing to remove symlink not pointing at ${STORE_DIR}: ${linkPath}`);
  await fs.rm(linkPath, { recursive: true, force: true });
}

async function skillsInDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const skillPath = path.join(dir, entry.name);
    if (await exists(path.join(skillPath, "SKILL.md"))) skills.push({ name: entry.name, path: skillPath, summary: await readSkillSummary(skillPath) });
  }
  return skills;
}

async function findSkillDirs(root) {
  const results = [];
  await walk(root, async (dir) => {
    if (await exists(path.join(dir, "SKILL.md"))) results.push(dir);
  });
  return results;
}

async function walk(dir, visit) {
  await visit(dir);
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if ([".git", "node_modules", "dist", "release"].includes(entry.name)) continue;
    await walk(path.join(dir, entry.name), visit);
  }
}

function pickSkillDir(skillDirs, requestedPath) {
  if (!requestedPath) return skillDirs[0];
  const normalized = path.normalize(requestedPath);
  return skillDirs.find((dir) => path.normalize(dir).endsWith(normalized)) ?? skillDirs[0];
}

async function readSkillSummary(skillPath) {
  const text = await fs.readFile(path.join(skillPath, "SKILL.md"), "utf8").catch(() => "");
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const titleLine = lines.find((line) => line.startsWith("#"));
  const title = titleLine ? titleLine.replace(/^#+\s*/, "") : path.basename(skillPath);
  const description = lines.find((line) => !line.startsWith("#") && !line.startsWith("---")) ?? "暂无描述";
  return { title, description: description.slice(0, 220) };
}

async function assertSkillDir(dir) {
  if (!(await exists(path.join(dir, "SKILL.md")))) throw new Error(`Missing SKILL.md in ${dir}`);
}

async function isEnabled(name, target) {
  return isManagedLink(path.join(targetDir(target), name));
}

async function enabledTargets(name) {
  const enabled = [];
  for (const target of Object.keys(TARGETS)) {
    if (await isEnabled(name, target)) enabled.push(target);
  }
  return enabled;
}

async function isManagedLink(linkPath) {
  const stat = await fs.lstat(linkPath).catch(() => null);
  if (!stat?.isSymbolicLink()) return false;
  const resolved = await fs.realpath(linkPath).catch(() => "");
  return resolved.toLowerCase().startsWith(path.resolve(STORE_DIR).toLowerCase());
}

async function sameLinkTarget(linkPath, sourcePath) {
  const linkReal = await fs.realpath(linkPath).catch(() => null);
  const sourceReal = await fs.realpath(sourcePath).catch(() => null);
  return linkReal && sourceReal && linkReal === sourceReal;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonIfMissing(filePath, value) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeName(name) {
  if (!name) return "";
  const normalized = name.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  if (normalized === "." || normalized === ".." || normalized.includes("..")) throw new Error(`Invalid name: ${name}`);
  return normalized;
}

function targetDir(target) {
  if (!TARGETS[target]) throw new Error(`Unknown target: ${target}. Use opencode, claude, or agents.`);
  return TARGETS[target];
}

function selectedTargets(target) {
  if (target === "all") return Object.entries(TARGETS);
  return [[target, targetDir(target)]];
}
