const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("skillsManage", {
  state: () => ipcRenderer.invoke("state"),
  pickSkillFolder: () => ipcRenderer.invoke("pick-skill-folder"),
  importSkill: (payload) => ipcRenderer.invoke("import-skill", payload),
  searchOnlineSkills: (payload) => ipcRenderer.invoke("search-online-skills", payload),
  importOnlineSkill: (payload) => ipcRenderer.invoke("import-online-skill", payload),
  enableSkill: (payload) => ipcRenderer.invoke("enable-skill", payload),
  disableSkill: (payload) => ipcRenderer.invoke("disable-skill", payload),
  saveProfile: (payload) => ipcRenderer.invoke("save-profile", payload),
  applyProfile: (payload) => ipcRenderer.invoke("apply-profile", payload),
  deleteProfile: (payload) => ipcRenderer.invoke("delete-profile", payload),
  saveWorkflow: (payload) => ipcRenderer.invoke("save-workflow", payload),
  deleteWorkflow: (payload) => ipcRenderer.invoke("delete-workflow", payload),
  runWorkflow: (payload) => ipcRenderer.invoke("run-workflow", payload),
});
