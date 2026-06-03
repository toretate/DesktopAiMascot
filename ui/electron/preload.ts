import { contextBridge, ipcRenderer } from 'electron';

// レンダラープロセス（Vue3）へ公開する安全なAPIブリッジ
contextBridge.exposeInMainWorld('electronAPI', {
    // チャットパネルの表示・非表示のトグルを送信
    toggleChat: () => ipcRenderer.send('toggle-chat'),
    
    // 設定画面を開くリクエストを送信
    openSettings: () => ipcRenderer.send('open-settings'),
    
    // マスコットのサイズ変更を送信
    setMascotScale: (scale: number) => ipcRenderer.send('set-mascot-scale', scale),
    
    // マウス透過状態の切り替えを送信 (ignore: true でマウスイベントを透過)
    setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('set-ignore-mouse-events', ignore),
    
    // ウィンドウのドラッグ移動シグナルの送信 (HTML要素でドラッグを擬似実装する)
    dragWindow: (offset: { dx: number; dy: number }) => ipcRenderer.send('drag-window', offset),
    
    // キャラクター画像の描画境界をメインプロセスに通知
    updateCharacterBounds: (bounds: { top: number; bottom: number; left: number; right: number }) => 
        ipcRenderer.send('update-character-bounds', bounds),
    
    // アプリケーションを終了する
    quitApp: () => ipcRenderer.send('quit-app'),
    
    // アプリケーション設定のロードと保存
    getAppConfig: () => ipcRenderer.invoke('get-app-config'),
    updateAppConfig: (config: any) => ipcRenderer.invoke('update-app-config', config),
    
    // サーバーへの疎通チェック
    testServerConnection: (host: string, port: number) =>
        ipcRenderer.invoke('test-server-connection', host, port),
    
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
    
    // AIによる表情スプライト生成
    generateMascotExpressions: (base64Image: string, apiKey: string, emotions: { name: string, label: string }[], userPromptTemplate: string, engine?: string, model?: string, history?: any[]) =>
        ipcRenderer.invoke('generate-mascot-expressions', base64Image, apiKey, emotions, userPromptTemplate, engine, model, history),
        
    // 利用可能なImagenモデルをAPIで取得する
    getImagenModels: (apiKey: string) =>
        ipcRenderer.invoke('get-imagen-models', apiKey),
        
    // Gemini Visionによるスプライトシート解析
    analyzeSpriteSheet: (base64Image: string, apiKey: string) =>
        ipcRenderer.invoke('analyze-sprite-sheet', base64Image, apiKey),
    
    // ローカルPCの画像ファイルを選択し、Base64データURLとして取得する
    selectLocalImage: () =>
        ipcRenderer.invoke('select-local-image'),
    
    // 感情の変更をメインプロセスへ通知する
    changeEmotion: (emotion: string) => ipcRenderer.send('emotion-changed', emotion),
    
    // エディタのプレビュー状態をマスコットウィンドウへ送信する
    previewMascotState: (previewState: any) =>
        ipcRenderer.send('preview-mascot-state', previewState),
    
    // エディタからのプレビュー状態適用イベントを購読
    onApplyPreviewState: (callback: (previewState: any) => void) => {
        const listener = (_event: any, state: any) => callback(state);
        ipcRenderer.on('apply-preview-state', listener);
        return () => {
            ipcRenderer.off('apply-preview-state', listener);
        };
    },
    
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
    },
    
    // メインプロセス側から設定更新イベントを購読
    onConfigUpdated: (callback: (config: any) => void) => {
        const listener = (_event: any, config: any) => callback(config);
        ipcRenderer.on('config-updated', listener);
        return () => {
            ipcRenderer.off('config-updated', listener);
        };
    }
});
