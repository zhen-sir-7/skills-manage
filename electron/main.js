import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import {
  applyProfile,
  deleteProfile,
  disableSkill,
  enableSkill,
  getPaths,
  importSkill,
  importOnlineSkill,
  listManagedSkills,
  listProfiles,
  listWorkflows,
  runWorkflow,
  saveProfile,
  saveWorkflow,
  scanSkills,
  searchOnlineSkills,
  deleteWorkflow,
} from "../src/manager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.setName("Skills 管理器");

const logPath = path.join(app.getPath("userData"), "startup.log");

function log(message) {
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
  } catch {
    // Logging must never prevent startup.
  }
}

process.on("uncaughtException", (error) => {
  log(`uncaughtException: ${error.stack || error.message}`);
  dialog.showErrorBox("启动失败", `${error.message}\n\n日志：${logPath}`);
});

process.on("unhandledRejection", (error) => {
  log(`unhandledRejection: ${error?.stack || error}`);
  dialog.showErrorBox("启动失败", `${error?.message || error}\n\n日志：${logPath}`);
});

async function createWindow() {
  log("creating window");
  const win = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 760,
    minHeight: 560,
    title: "Skills 管理器",
    icon: path.join(__dirname, "..", "public", "icon.svg"),
    backgroundColor: "#111318",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once("ready-to-show", () => {
    log("window ready-to-show");
    win.show();
    win.focus();
  });

  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      log("fallback show window");
      win.show();
      win.focus();
    }
  }, 1800);

  win.webContents.on("render-process-gone", (_event, details) => log(`render-process-gone: ${JSON.stringify(details)}`));
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => log(`did-fail-load: ${errorCode} ${errorDescription}`));

  await win.loadFile(path.join(__dirname, "..", "public", "index.html"));
  log("loadFile completed");
}

app.whenReady().then(createWindow).catch((error) => {
  log(`app.whenReady failed: ${error.stack || error.message}`);
  dialog.showErrorBox("启动失败", `${error.message}\n\n日志：${logPath}`);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle("state", async () => ({
  paths: getPaths(),
  scanned: await scanSkills("all"),
  managed: await listManagedSkills(),
  profiles: await listProfiles(),
  workflows: await listWorkflows(),
}));

ipcMain.handle("pick-skill-folder", async () => {
  const result = await dialog.showOpenDialog({
    title: "选择包含 SKILL.md 的技能文件夹",
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("import-skill", async (_event, payload) => importSkill(payload.path, payload.name));
ipcMain.handle("search-online-skills", async (_event, payload) => searchOnlineSkills(payload.query));
ipcMain.handle("import-online-skill", async (_event, payload) => importOnlineSkill(payload));
ipcMain.handle("enable-skill", async (_event, payload) => enableSkill(payload.name, payload.target));
ipcMain.handle("disable-skill", async (_event, payload) => disableSkill(payload.name, payload.target));
ipcMain.handle("save-profile", async (_event, payload) => saveProfile(payload.name, payload.target));
ipcMain.handle("apply-profile", async (_event, payload) => applyProfile(payload.name, payload.target));
ipcMain.handle("delete-profile", async (_event, payload) => deleteProfile(payload.name));
ipcMain.handle("save-workflow", async (_event, payload) => saveWorkflow(payload));
ipcMain.handle("delete-workflow", async (_event, payload) => deleteWorkflow(payload.name));
ipcMain.handle("run-workflow", async (_event, payload) => runWorkflow(payload.name));
