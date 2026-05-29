import { contextBridge, ipcRenderer } from 'electron';

// レンダラープロセス（Vue3）へ公開する安全なAPIブリッジ
contextBridge.exposeInMainWorld('electronAPI', {
    // チャットパネルの表示・非表示のトグルを送信
    toggleChat: () => ipcRenderer.send('toggle-chat'),
    
    // 設定画面を開くリクエストを送信
    openSettings: () => ipcRenderer.send('open-settings'),
    
    // マウス透過状態の切り替えを送信 (ignore: true でマウスイベントを透過)
    setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('set-ignore-mouse-events', ignore),
    
    // ウィンドウのドラッグ開始および終了シグナルの送信 (HTML要素でドラッグを擬似実装する場合に利用可能)
    startWindowDrag: () => ipcRenderer.send('start-window-drag'),
    
    // メインプロセス側からチャットパネルの開閉イベントを購読
    onChatToggled: (callback: (visible: boolean) => void) => {
        const listener = (_event: any, visible: boolean) => callback(visible);
        ipcRenderer.on('chat-toggled', listener);
        return () => {
            ipcRenderer.off('chat-toggled', listener);
        };
    }
});
