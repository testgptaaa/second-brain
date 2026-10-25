import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("secondBrain", {
  sendRequest: (type: string, payload?: any) => {
    return ipcRenderer.invoke("secondBrain:request", { type, payload });
  },
  onEvent: (event: string, callback: (payload: any) => void) => {
    const channel = `secondBrain:event:${event}`;
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
});
