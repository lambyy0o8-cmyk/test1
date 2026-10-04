const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lambyy", {
  status: () => ipcRenderer.invoke("bridge-status"),
  onStatus: (cb) => ipcRenderer.on("bridge-status", (_e, s) => cb(s)),
  onEvent: (cb) => ipcRenderer.on("bridge-event", (_e, ev) => cb(ev)),
  openLog: (which) => ipcRenderer.invoke("open-log", which),
  restartBridge: () => ipcRenderer.invoke("restart-bridge"),
  chat: (payload) => ipcRenderer.invoke("chat", payload),
});
