const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nineRouterDesktop", {
  getStatus: () => ipcRenderer.invoke("9router:get-status"),
  openDataDir: () => ipcRenderer.invoke("9router:open-data-dir"),
  quit: () => ipcRenderer.invoke("9router:quit")
});
