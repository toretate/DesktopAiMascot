import { contextBridge, ipcRenderer } from 'electron';

// 安全なレンダラープロセス用のAPIブリッジの定義
contextBridge.exposeInMainWorld('electronAPI', {
    // ここにメインプロセスと通信するためのメソッドを追記していきます
});
