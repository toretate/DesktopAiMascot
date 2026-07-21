import { contextBridge, ipcRenderer } from 'electron';

// レンダラープロセス（Vue3）へ公開する安全なAPIブリッジ
contextBridge.exposeInMainWorld('electronAPI', {
    // Googleログインの開始
    loginWithGoogle: () => ipcRenderer.send('auth:login'),

    // ウィンドウを強制フォーカス・最前面に表示する
    focusWindow: () => ipcRenderer.send('focus-window'),

    // チャットウィンドウの表示・非表示のトグルを送信
    toggleChat: () => ipcRenderer.send('toggle-chat'),

    // タスクウィンドウの表示・非表示のトグルを送信
    toggleTasks: () => ipcRenderer.send('toggle-tasks-window'),

    // メモウィンドウの表示・非表示のトグルを送信
    toggleMemo: () => ipcRenderer.send('toggle-memo-window'),

    // 音楽プレイヤーウィンドウの表示・非表示を切り替える
    toggleMusic: () => ipcRenderer.send('toggle-music-window'),
    
    // チャットウィンドウのサイズ変更を送信
    resizeChatWindow: (size: { width: number; height: number }) => ipcRenderer.send('resize-chat-window', size),

    // 汎用ウィンドウサイズ変更の送信
    resizeWindow: (size: { width: number; height: number }) => ipcRenderer.send('resize-window', size),
    
    // 設定画面を開くリクエストを送信
    openSettings: () => ipcRenderer.send('open-settings'),
    
    // マスコットのサイズ変更を送信
    setMascotScale: (scale: number) => ipcRenderer.send('set-mascot-scale', scale),
    
    // マウス透過状態の切り替えを送信 (ignore: true でマウスイベントを透過)
    setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('set-ignore-mouse-events', ignore),
    
    // ウィンドウのドラッグ移動シグナルの送信 (HTML要素でドラッグを擬似実装する)
    dragWindow: (offset: { dx: number; dy: number; isStart?: boolean; isEnd?: boolean }) => ipcRenderer.send('drag-window', offset),
    
    // キャラクター画像の描画境界をメインプロセスに通知
    updateCharacterBounds: (bounds: { top: number; bottom: number; left: number; right: number }) => 
        ipcRenderer.send('update-character-bounds', bounds),
    
    // アプリケーションを終了する
    quitApp: () => ipcRenderer.send('quit-app'),
    
    // アプリケーションを再起動する
    relaunchApp: () => ipcRenderer.send('relaunch-app'),
    
    // アプリケーション設定のロードと保存
    getAppConfig: () => ipcRenderer.invoke('get-app-config'),
    updateAppConfig: (config: any) => ipcRenderer.invoke('update-app-config', config),
    
    // サーバーへの疎通チェック
    testServerConnection: (host: string, port: number) =>
        ipcRenderer.invoke('test-server-connection', host, port),
    
    // Gemini APIによる対話処理を呼び出す
    askGemini: (message: string, apiKey: string, systemPrompt: string, modelName: string, history?: any[], attachments?: any[]) => 
        ipcRenderer.invoke('ask-gemini', message, apiKey, systemPrompt, modelName, history, attachments),
        
    // LM Studio (ローカル)による対話処理を呼び出す
    askLmStudio: (message: string, systemPrompt: string, modelName: string, endpoint: string, history?: any[], attachments?: any[], tools?: any) =>
        ipcRenderer.invoke('ask-lmstudio', message, systemPrompt, modelName, endpoint, history, attachments, tools),
        
    // LM Studio (ローカル)疎通確認およびモデル一覧取得を呼び出す
    getLmStudioModels: (endpoint: string) =>
        ipcRenderer.invoke('get-lmstudio-models', endpoint),

    // チャット履歴の取得
    getChatHistory: () => ipcRenderer.invoke('get-chat-history'),

    // チャット履歴の保存
    saveChatHistory: (history: any) => ipcRenderer.invoke('save-chat-history', history),

    // チャット履歴ファイルをシステムのエディタで開く
    openChatHistory: () => ipcRenderer.send('open-chat-history'),

    // 指定されたパスのフォルダを開く
    openFolder: (path: string) => ipcRenderer.send('open-folder', path),

    // マスコットごとの openclaw プロンプトの取得
    getMascotPrompts: (mascotId: string) => ipcRenderer.invoke('get-mascot-prompts', mascotId),
        
    // マスコットごとの openclaw プロンプトの保存
    saveMascotPrompts: (mascotId: string, prompts: { soul: string; identity: string; user: string; agents: string; memory: string }) =>
        ipcRenderer.invoke('save-mascot-prompts', mascotId, prompts),
        
    // VOICEVOXによる音声合成を呼び出す（Base64データと形式情報が返る）
    synthesizeVoicevox: (text: string, speakerId: number, endpoint?: string) => 
        ipcRenderer.invoke('synthesize-voicevox', text, speakerId, endpoint),

    // irodori-ttsによる音声合成を呼び出す（Base64データと形式情報が返る）
    synthesizeIrodori: (text: string, endpoint: string, model: string, voice: string, emotion?: string) =>
        ipcRenderer.invoke('synthesize-irodori', text, endpoint, model, voice, emotion),
        
    // VOICEVOX (ローカル)疎通確認および話者（スタイル）一覧取得を呼び出す
    getVoicevoxSpeakers: (endpoint: string) =>
        ipcRenderer.invoke('get-voicevox-speakers', endpoint),

    // irodori-tts (ローカル)疎通確認およびボイス一覧取得を呼び出す
    getIrodoriVoices: (endpoint: string) =>
        ipcRenderer.invoke('get-irodori-voices', endpoint),
    
    // AIによる表情スプライト生成
    generateMascotExpressions: (base64Image: string, apiKey: string, emotions: { name: string, label: string }[], userPromptTemplate: string, engine?: string, model?: string, history?: any[]) =>
        ipcRenderer.invoke('generate-mascot-expressions', base64Image, apiKey, emotions, userPromptTemplate, engine, model, history),
        
    // 利用可能なImagenモデルをAPIで取得する
    getImagenModels: (apiKey: string) =>
        ipcRenderer.invoke('get-imagen-models', apiKey),
        
    // Geminiの利用可能なチャットモデルをAPIで取得する
    getGeminiModels: (apiKey: string) =>
        ipcRenderer.invoke('get-gemini-models', apiKey),
        
    // Gemini Visionによるスプライトシート解析
    analyzeSpriteSheet: (base64Image: string, apiKey: string) =>
        ipcRenderer.invoke('analyze-sprite-sheet', base64Image, apiKey),
        
    // 表情パーツとベース顔の自動位置合わせ判定
    alignExpression: (basePath: string, expressionPath: string, detectMode?: string) =>
        ipcRenderer.invoke('align-expression', basePath, expressionPath, detectMode),
    
    // ベース顔領域の自動検出
    detectBaseFace: (imagePath: string, detectMode?: string) =>
        ipcRenderer.invoke('detect-base-face', imagePath, detectMode),
    
    // ローカルPCの画像ファイルを選択し、Base64データURLとして取得する
    selectLocalImage: () =>
        ipcRenderer.invoke('select-local-image'),

    // ローカル音楽フォルダの選択と、前回選択したフォルダの再読み込み
    selectMusicFolder: () => ipcRenderer.invoke('select-music-folder'),
    loadLastMusicFolder: () => ipcRenderer.invoke('load-last-music-folder'),
    clearLastMusicFolder: () => ipcRenderer.invoke('clear-last-music-folder'),

    // 画像データを mascots/<mascotId> に保存する
    saveMascotImage: (mascotId: string, filename: string, base64Data: string) =>
        ipcRenderer.invoke('save-mascot-image', mascotId, filename, base64Data),

    // 音声データを mascots/<mascotId>/voices/<YYYYMMDD> に保存する
    saveMascotVoice: (mascotId: string, base64Data: string, extension: string) =>
        ipcRenderer.invoke('save-mascot-voice', mascotId, base64Data, extension),
    
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
    },

    // ローカルタイマーの開始を要求する
    startTimer: (seconds: number, memo: string) => ipcRenderer.send('start-timer', seconds, memo),

    // タイマー発火の通知をメインプロセスへ要求する
    triggerTimerNotification: (memo: string, options?: { notificationId?: string; speak?: boolean }) =>
        ipcRenderer.send('trigger-timer-notification', memo, options),

    // タイマー満了イベントを購読する
    onTimerTrigger: (callback: (memo: string, options?: { notificationId?: string; speak?: boolean }) => void) => {
        const listener = (_event: any, memo: string, options?: { notificationId?: string; speak?: boolean }) => callback(memo, options);
        ipcRenderer.on('timer-trigger', listener);
        return () => {
            ipcRenderer.off('timer-trigger', listener);
        };
    },

    // ラジオモード用プロンプトの取得
    getRadioPrompts: () => ipcRenderer.invoke('get-radio-prompts'),

    // ラジオモード用プロンプトの保存
    saveRadioPrompts: (prompts: { radioMode: string; activeTalk: string }) => ipcRenderer.invoke('save-radio-prompts', prompts),

    // Forge (Stable Diffusion) 関連の IPC 呼び出し
    forgeTestConnection: (host: string) => ipcRenderer.invoke('forge:health', host),
    forgeGetModels: (host: string) => ipcRenderer.invoke('forge:models', host),
    forgeGetLoras: (host: string) => ipcRenderer.invoke('forge:loras', host),
    forgeGenerateImage: (params: any, host: string) => ipcRenderer.invoke('forge:generate', params, host),
    openDownloadsFolder: () => ipcRenderer.send('open-downloads-folder'),
    logDebug: (msg: string) => ipcRenderer.send('log-debug', msg)
});
