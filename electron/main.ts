import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// 開発環境と本番環境の判定
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

// --- 設定管理 (AppConfig) の定義 ---
interface ConfigData {
    mascotX: number;
    mascotY: number;
    chatVisible: boolean;
    alwaysOnTop: boolean;
}

class AppConfig {
    private configPath: string;
    private data: ConfigData;

    constructor() {
        this.configPath = path.join(app.getPath('userData'), 'config.json');
        this.data = this.load();
    }

    private load(): ConfigData {
        const defaultData: ConfigData = {
            mascotX: -1,
            mascotY: -1,
            chatVisible: false,
            alwaysOnTop: true
        };

        try {
            if (fs.existsSync(this.configPath)) {
                const fileData = fs.readFileSync(this.configPath, 'utf8');
                return { ...defaultData, ...JSON.parse(fileData) };
            }
        } catch (error) {
            console.error('[Config] Failed to load config file:', error);
        }
        return defaultData;
    }

    public get(): ConfigData {
        return this.data;
    }

    public update(newData: Partial<ConfigData>) {
        this.data = { ...this.data, ...newData };
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 4), 'utf8');
        } catch (error) {
            console.error('[Config] Failed to save config file:', error);
        }
    }
}

// --- グローバル変数 ---
let config: AppConfig;
let mascotWindow: BrowserWindow | null = null;
let chatWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let savePositionTimeout: NodeJS.Timeout | null = null;

// --- ウィンドウ位置の保存（デバウンス処理） ---
function debouncedSaveMascotPosition() {
    if (!mascotWindow) return;
    if (savePositionTimeout) clearTimeout(savePositionTimeout);

    savePositionTimeout = setTimeout(() => {
        const [x, y] = mascotWindow!.getPosition();
        config.update({ mascotX: x, mascotY: y });
        console.log(`[Config] Mascot position saved: X=${x}, Y=${y}`);
    }, 1000); // 1秒間静止した後に保存
}

// --- チャットウィンドウの追従移動処理 ---
function syncChatWindowPosition() {
    if (!mascotWindow || !chatWindow || !chatWindow.isVisible()) return;

    const [mascotX, mascotY] = mascotWindow.getPosition();
    const [mascotW] = mascotWindow.getSize();
    
    // チャットウィンドウをマスコットの右隣にぴったり追従させる
    chatWindow.setPosition(mascotX + mascotW, mascotY);
}

// --- ウィンドウ群の初期化 ---
function createWindows() {
    config = new AppConfig();
    const configData = config.get();

    // 画面サイズの取得
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // デフォルト位置の決定（画面右下付近）
    const defaultMascotW = 300;
    const defaultMascotH = 400;
    let initialX = configData.mascotX;
    let initialY = configData.mascotY;

    if (initialX === -1 || initialY === -1) {
        initialX = screenWidth - defaultMascotW - 100;
        initialY = screenHeight - defaultMascotH - 100;
        config.update({ mascotX: initialX, mascotY: initialY });
    }

    // 1. マスコットウィンドウの作成
    mascotWindow = new BrowserWindow({
        width: defaultMascotW,
        height: defaultMascotH,
        x: initialX,
        y: initialY,
        transparent: true,
        frame: false,
        alwaysOnTop: configData.alwaysOnTop,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // 2. チャットウィンドウの作成
    const chatW = 350;
    const chatH = 400;
    chatWindow = new BrowserWindow({
        width: chatW,
        height: chatH,
        x: initialX + defaultMascotW,
        y: initialY,
        transparent: true,
        frame: false,
        alwaysOnTop: configData.alwaysOnTop,
        resizable: false,
        show: false, // 初期表示状態は後述の toggle 処理等に委ねる
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // 3. 設定ウィンドウの作成（透過なし・通常ウィンドウ）
    settingsWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false, // 必要なタイミングまで非表示
        title: 'Desktop AI Mascot 設定',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // --- 各種ロード処理 ---
    if (isDev) {
        const devUrl = process.env.VITE_DEV_SERVER_URL!;
        
        // レンダープロセス側のルーティングに合わせてハッシュやパスを切り分け可能にする
        // マスコットとチャットは同一のVueアプリからコンポーネントまたは簡易ルーティングで出し分ける
        mascotWindow.loadURL(`${devUrl}#mascot`);
        chatWindow.loadURL(`${devUrl}#chat`);
        settingsWindow.loadURL(`${devUrl}#settings`);
    } else {
        const htmlPath = path.join(__dirname, '../dist/index.html');
        mascotWindow.loadFile(htmlPath, { hash: 'mascot' });
        chatWindow.loadFile(htmlPath, { hash: 'chat' });
        settingsWindow.loadFile(htmlPath, { hash: 'settings' });
    }

    // --- イベントリスナーの登録 ---

    // ドラッグ移動時の追従と位置保存
    mascotWindow.on('move', () => {
        syncChatWindowPosition();
        debouncedSaveMascotPosition();
    });

    // 初期化完了時、チャットウィンドウの初期表示状態を適用
    mascotWindow.once('ready-to-show', () => {
        if (configData.chatVisible) {
            chatWindow?.showInactive(); // フォーカスを奪わずに表示
            syncChatWindowPosition();
        }
    });
}

// --- IPCハンドラーの実装 ---
app.whenReady().then(() => {
    createWindows();

    // 1. チャットウィンドウのトグル
    ipcMain.on('toggle-chat', () => {
        if (!chatWindow) return;

        const isVisible = chatWindow.isVisible();
        if (isVisible) {
            chatWindow.hide();
            config.update({ chatVisible: false });
            mascotWindow?.webContents.send('chat-toggled', false);
        } else {
            chatWindow.showInactive();
            syncChatWindowPosition();
            config.update({ chatVisible: true });
            mascotWindow?.webContents.send('chat-toggled', true);
        }
        console.log(`[IPC] Toggle Chat: visible=${!isVisible}`);
    });

    // 2. 設定画面の起動
    ipcMain.on('open-settings', () => {
        if (settingsWindow) {
            settingsWindow.show();
            settingsWindow.focus();
            console.log('[IPC] Settings Window opened');
        }
    });

    // 3. マウススルー（イベント無視）の制御
    // ignore: true の場合はクリックを透過させ、false の場合はウィンドウを通常クリック可能にする
    ipcMain.on('set-ignore-mouse-events', (event, ignore: boolean) => {
        const webContents = event.sender;
        const win = BrowserWindow.fromWebContents(webContents);
        if (win) {
            // forward: true にすることで、マウスイベントを透過しつつも
            // マウス移動（mousemove）イベント自体はレンダープロセス側で検知可能にする
            win.setIgnoreMouseEvents(ignore, { forward: true });
        }
    });

    // 4. アプリ内ドラッグ移動の実装 (HTML要素をドラッグ可能にする場合のサポート)
    ipcMain.on('start-window-drag', (event) => {
        const webContents = event.sender;
        const win = BrowserWindow.fromWebContents(webContents);
        if (win) {
            // メインプロセス側でウィンドウのネイティブドラッグを開始する
            // （Vite/Electron環境でCSSの-webkit-app-region: dragがうまく動かない際のフォールバックとして有用）
        }
    });

    // 感情変更のマルチウィンドウ中継ハンドラー
    ipcMain.on('emotion-changed', (event, emotion: string) => {
        if (mascotWindow) {
            mascotWindow.webContents.send('emotion-changed', emotion);
            console.log(`[IPC] Emotion broadcasted to MascotWindow: ${emotion}`);
        }
    });

    // 5. Gemini APIによる対話処理のハンドラー
    ipcMain.handle('ask-gemini', async (event, message: string, apiKey: string, systemPrompt: string, modelName: string) => {
        const model = modelName || 'gemini-2.0-flash-exp';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

        try {
            console.log('=== Google AI Studio 送信開始 ===');
            console.log(`[GoogleAiStudio] 使用モデル: ${model}`);
            console.log(`[GoogleAiStudio] 送信メッセージ: ${message}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: message }]
                        }
                    ],
                    systemInstruction: {
                        parts: [{ text: systemPrompt || 'You are a helpful assistant.' }]
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} ${errorText}`);
            }

            const data: any = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            console.log(`[GoogleAiStudio] レスポンス内容: ${text}`);
            console.log('=== Google AI Studio 送信完了 ===');
            return text || 'Error: 空の返答を受信しました。';

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                // グローバルルールに従い、タイムアウト時はスタックトレースを出さずシンプルなログを出力
                console.warn('Google AI Studioとの接続エラー (タイムアウト)');
                return 'Error: Google AI Studioとの接続がタイムアウトしました。';
            } else {
                // 接続エラー時もシンプルなメッセージのみログ出力
                console.warn('Google AI Studioとの接続エラー');
                return `Error: Google AI Studioとの接続に失敗しました`;
            }
        }
    });

    // 6. VOICEVOXによる音声合成のハンドラー
    ipcMain.handle('synthesize-voicevox', async (event, text: string, speakerId: number) => {
        const baseUrl = 'http://localhost:50021';
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

        try {
            console.log(`[VoiceVox] 音声合成クエリ作成開始: ${text}`);
            const encodedText = encodeURIComponent(text);
            const queryUrl = `${baseUrl}/audio_query?text=${encodedText}&speaker=${speakerId}`;

            // 1. クエリ作成
            const queryResponse = await fetch(queryUrl, { 
                method: 'POST',
                signal: controller.signal 
            });

            if (!queryResponse.ok) {
                throw new Error(`Query Error: ${queryResponse.status}`);
            }

            const audioQuery = await queryResponse.json();
            console.log('[VoiceVox] AudioQuery作成成功');

            // 2. 音声合成
            const synthesisUrl = `${baseUrl}/synthesis?speaker=${speakerId}`;
            const synthResponse = await fetch(synthesisUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(audioQuery),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!synthResponse.ok) {
                throw new Error(`Synthesis Error: ${synthResponse.status}`);
            }

            // バイナリデータを取得しBase64に変換
            const arrayBuffer = await synthResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');

            console.log(`[VoiceVox] 音声合成成功: ${buffer.length} bytes`);
            return base64;

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('VoiceVoxとの接続エラー (タイムアウト)');
            } else {
                console.warn('VoiceVoxとの接続エラー');
            }
            return null;
        }
    });

    // 7. LM Studio (ローカル) による対話処理のハンドラー
    ipcMain.handle('ask-lmstudio', async (event, message: string, systemPrompt: string, modelName: string, endpoint: string) => {
        const defaultEndpoint = 'http://127.0.0.1:1234/v1/';
        const apiBase = endpoint || defaultEndpoint;
        const url = apiBase.endsWith('/') ? `${apiBase}chat/completions` : `${apiBase}/chat/completions`;
        const model = modelName || 'unspecified';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

        try {
            console.log('=== LmStudio 送信開始 ===');
            console.log(`[LmStudio] エンドポイント: ${url}`);
            console.log(`[LmStudio] 使用モデル: ${model}`);
            console.log(`[LmStudio] 送信メッセージ: ${message}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: message }
                    ]
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`LM Studio Error: ${response.status} ${errorText}`);
            }

            const data: any = await response.json();
            const text = data.choices?.[0]?.message?.content;

            console.log(`[LmStudio] レスポンス内容: ${text}`);
            console.log('=== LmStudio 送信完了 ===');
            return text || 'Error: 空の返答を受信しました。';

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('LmStudioとの接続エラー (タイムアウト)');
                return 'Error: LM Studioとの接続がタイムアウトしました。';
            } else {
                console.warn('LmStudioとの接続エラー');
                return 'Error: LM Studioとの接続に失敗しました。ローカルサーバーが起動しているか確認してください。';
            }
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindows();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
