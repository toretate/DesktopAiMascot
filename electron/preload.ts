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
    
    // アプリケーションを終了する
    quitApp: () => ipcRenderer.send('quit-app'),
    
    // アプリケーション設定のロードと保存
    getAppConfig: () => ipcRenderer.invoke('get-app-config'),
    updateAppConfig: (config: any) => ipcRenderer.invoke('update-app-config', config),
    
    // Gemini APIによる対話処理を呼び出す
    askGemini: (message: string, apiKey: string, systemPrompt: string, modelName: string) => 
        ipcRenderer.invoke('ask-gemini', message, apiKey, systemPrompt, modelName),
        
    // LM Studio (ローカル)による対話処理を呼び出す
    askLmStudio: (message: string, systemPrompt: string, modelName: string, endpoint: string) =>
        ipcRenderer.invoke('ask-lmstudio', message, systemPrompt, modelName, endpoint),
        
    // LM Studio (ローカル)疎通確認およびモデル一覧取得を呼び出す
    getLmStudioModels: (endpoint: string) =>
        ipcRenderer.invoke('get-lmstudio-models', endpoint),
        
    // VOICEVOXによる音声合成を呼び出す (Base64文字列で結果が返る)
    synthesizeVoicevox: (text: string, speakerId: number, endpoint?: string) => 
        ipcRenderer.invoke('synthesize-voicevox', text, speakerId, endpoint),
        
    // VOICEVOX (ローカル)疎通確認および話者（スタイル）一覧取得を呼び出す
    getVoicevoxSpeakers: (endpoint: string) =>
        ipcRenderer.invoke('get-voicevox-speakers', endpoint),
    
    // 感情の変更をメインプロセスへ通知する
    changeEmotion: (emotion: string) => ipcRenderer.send('emotion-changed', emotion),
    
    // メインプロセスから感情変更イベントを購読する
    onEmotionChanged: (callback: (emotion: string) => void) => {
        const listener = (_event: any, emotion: string) => callback(emotion);
        ipcRenderer.on('emotion-changed', listener);
        return () => {
            ipcRenderer.off('emotion-changed', listener);
        };
    },
    
    // メインプロセス側からチャットパネルの開閉イベントを購読
    onChatToggled: (callback: (visible: boolean) => void) => {
        const listener = (_event: any, visible: boolean) => callback(visible);
        ipcRenderer.on('chat-toggled', listener);
        return () => {
            ipcRenderer.off('chat-toggled', listener);
        };
    }
});
