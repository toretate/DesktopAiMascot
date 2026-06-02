import { app, BrowserWindow, ipcMain, screen, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// 開発環境と本番環境の判定
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

// アプリケーション名を明示的に指定し、起動方法（VS Codeデバッガ vs CLI）によるuserDataディレクトリ（config.json保存先）のズレを防止
app.setName('desktop-ai-mascot');

// --- 設定管理 (AppConfig) の定義 ---
// --- マスコットアセット・設定のデータ定義 ---
interface MascotAsset {
    id: string;
    name: string;
    path: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
}

interface MascotData {
    id: string;
    name: string;
    avatar: string;
    profile: string;
    currentOutfitId?: string;
    currentPoseId?: string;
    aiConfig: {
        chat: {
            engine: string;
            model: string;
            temperature: number;
        };
        voice: {
            engine: string;
            speaker_id: number;
            style: string;
        };
    };
    assets: {
        outfits: MascotAsset[];
        expressions: MascotAsset[];
        poses: MascotAsset[];
    };
}

interface ConfigData {
    mascotX: number;
    mascotY: number;
    chatVisible: boolean;
    alwaysOnTop: boolean;
    selectedEngine: string;
    temperature: number;
    googleAiStudioApiKey: string;
    geminiModel: string;
    openaiModel: string;
    anthropicModel: string;
    lmstudioEndpoint: string;
    lmstudioModel: string;
    selectedVoiceEngine: string;
    voicevoxEndpoint: string;
    voicevoxSpeaker: number;
    selectedImageEngine: string;
    selectedVideoEngine: string;
    chatOpacity: number;
    chatAlwaysOnTop: boolean | 'sync';
    chatSendKey: string;
    chatFontFamily: string;
    openaiApiKey: string;
    anthropicApiKey: string;
    mascots: MascotData[];
    activeMascotId: string;
    settingsWidth: number;
    settingsHeight: number;
    settingsX: number;
    settingsY: number;
    mascotScale: number;
}

class AppConfig {
    private configPath: string;
    private data: ConfigData;

    constructor() {
        this.configPath = path.join(app.getPath('userData'), 'config.json');
        console.log(`[Config] Persistent configuration path: ${this.configPath}`);
        this.data = this.load();
    }

    private load(): ConfigData {
        const defaultMascots: MascotData[] = [
            {
                id: 'mascot_robot_001',
                name: 'デフォルトロボット',
                avatar: '🤖',
                profile: 'あなたは対話型のAIデスクトップマスコットです。親しみやすく返答してください。回答の最後に、自分の現在の感情に合わせて [happy], [sad], [angry], [surprised], [neutral] のいずれかの感情タグを必ず1つ含めて終了してください。',
                aiConfig: {
                    chat: {
                        engine: 'gemini',
                        model: 'gemini-2.0-flash-exp',
                        temperature: 0.7
                    },
                    voice: {
                        engine: 'voicevox',
                        speaker_id: 2,
                        style: 'normal'
                    }
                },
                assets: {
                    outfits: [
                        { id: 'outfit_default', name: '標準制服', path: '👕' },
                        { id: 'outfit_cyber', name: 'サイバーコート', path: '🧥' }
                    ],
                    expressions: [
                        { id: 'expr_normal', name: '通常', path: '😊' },
                        { id: 'expr_smile', name: '笑顔', path: '😆' },
                        { id: 'expr_sad', name: '悲しみ', path: '😢' },
                        { id: 'expr_angry', name: '怒り', path: '😠' }
                    ],
                    poses: [
                        { id: 'pose_stand', name: '立ち姿', path: '🧍' },
                        { id: 'pose_wave', name: '手を振る', path: '👋' }
                    ]
                }
            }
        ];

        const defaultData: ConfigData = {
            mascotX: -1,
            mascotY: -1,
            chatVisible: false,
            alwaysOnTop: true,
            selectedEngine: 'gemini',
            temperature: 0.7,
            googleAiStudioApiKey: '',
            geminiModel: 'gemini-3.1-flash-lite',
            openaiModel: 'gpt-4o',
            anthropicModel: 'claude-3-5-sonnet-latest',
            lmstudioEndpoint: 'http://127.0.0.1:1234/v1/',
            lmstudioModel: '',
            selectedVoiceEngine: 'voicevox',
            voicevoxEndpoint: 'http://localhost:50021',
            voicevoxSpeaker: 2,
            selectedImageEngine: 'dalle3',
            selectedVideoEngine: 'runway',
            chatOpacity: 1.0,
            chatAlwaysOnTop: true,
            chatSendKey: 'enter',
            chatFontFamily: 'sans-serif',
            openaiApiKey: '',
            anthropicApiKey: '',
            mascots: defaultMascots,
            activeMascotId: 'mascot_robot_001',
            settingsWidth: 800,
            settingsHeight: 600,
            settingsX: -1,
            settingsY: -1,
            mascotScale: 1.0
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
let saveSettingsBoundsTimeout: NodeJS.Timeout | null = null;
let chatOffsetX = 300; // マスコットとのX軸相対オフセット (初期値はマスコット幅300)
let chatOffsetY = 0;   // マスコットとのY軸相対オフセット
let isSyncingChatPosition = false; // moveイベントのループを防ぐフラグ

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

// --- 設定ウィンドウの位置・サイズ保存（デバウンス処理） ---
function debouncedSaveSettingsBounds() {
    if (!settingsWindow) return;
    if (saveSettingsBoundsTimeout) clearTimeout(saveSettingsBoundsTimeout);

    saveSettingsBoundsTimeout = setTimeout(() => {
        if (!settingsWindow || settingsWindow.isDestroyed()) return;
        const [w, h] = settingsWindow.getSize();
        const [x, y] = settingsWindow.getPosition();
        config.update({ settingsWidth: w, settingsHeight: h, settingsX: x, settingsY: y });
        console.log(`[Config] Settings bounds saved: X=${x}, Y=${y}, width=${w}, height=${h}`);
    }, 1000); // 1秒間操作が静止した後に保存
}

// --- チャットウィンドウの追従移動処理 ---
function syncChatWindowPosition() {
    if (!mascotWindow || !chatWindow || !chatWindow.isVisible()) return;

    isSyncingChatPosition = true;
    const [mascotX, mascotY] = mascotWindow.getPosition();
    chatWindow.setPosition(mascotX + chatOffsetX, mascotY + chatOffsetY);
    isSyncingChatPosition = false;
}

// --- チャット最前面表示の連動判定処理 ---
function getEffectiveChatAlwaysOnTop(configData: ConfigData): boolean {
    if (configData.chatAlwaysOnTop === 'sync') {
        return !!configData.alwaysOnTop;
    }
    return !!configData.chatAlwaysOnTop;
}

// --- 設定ウィンドウの作成・管理関数 ---
function createSettingsWindow() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        return;
    }

    const configData = config.get();

    const settingsOptions: Electron.BrowserWindowConstructorOptions = {
        width: configData.settingsWidth || 800,
        height: configData.settingsHeight || 600,
        show: false, // 必要なタイミングまで非表示
        title: 'Desktop AI Mascot 設定',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    };

    if (configData.settingsX !== -1 && configData.settingsY !== -1) {
        settingsOptions.x = configData.settingsX;
        settingsOptions.y = configData.settingsY;
    }

    settingsWindow = new BrowserWindow(settingsOptions);

    if (isDev) {
        settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL!}#settings`);
    } else {
        settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'settings' });
    }

    settingsWindow.on('resize', () => {
        debouncedSaveSettingsBounds();
    });

    settingsWindow.on('move', () => {
        debouncedSaveSettingsBounds();
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
        console.log('[Window] Settings Window resources released');
    });
}

// --- ウィンドウ群の初期化 ---
function createWindows() {
    config = new AppConfig();
    const configData = config.get();

    // 開発用：設定画面のみ直接起動するモードの処理
    if (process.env.START_SETTINGS === 'true') {
        const settingsOptions: Electron.BrowserWindowConstructorOptions = {
            width: configData.settingsWidth || 800,
            height: configData.settingsHeight || 600,
            show: true,
            title: 'Desktop AI Mascot 設定 - 開発用単体起動',
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false
            }
        };

        if (configData.settingsX !== -1 && configData.settingsY !== -1) {
            settingsOptions.x = configData.settingsX;
            settingsOptions.y = configData.settingsY;
        }

        settingsWindow = new BrowserWindow(settingsOptions);

        if (isDev) {
            settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL!}#settings`);
        } else {
            settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'settings' });
        }

        settingsWindow.on('resize', () => {
            debouncedSaveSettingsBounds();
        });

        settingsWindow.on('move', () => {
            debouncedSaveSettingsBounds();
        });

        settingsWindow.on('closed', () => {
            app.quit();
        });
        return;
    }

    // 画面サイズの取得
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // デフォルト位置の決定（画面右下付近）
    const defaultMascotW = 600;
    const defaultMascotH = 800;
    const scale = configData.mascotScale || 1.0;
    const mascotW = Math.round(defaultMascotW * scale);
    const mascotH = Math.round(defaultMascotH * scale);

    // チャット追従オフセットのスケール適用
    chatOffsetX = mascotW;

    let initialX = configData.mascotX;
    let initialY = configData.mascotY;

    if (initialX === -1 || initialY === -1) {
        initialX = screenWidth - mascotW - 100;
        initialY = screenHeight - mascotH - 100;
        config.update({ mascotX: initialX, mascotY: initialY });
    }

    // 1. マスコットウィンドウの作成
    mascotWindow = new BrowserWindow({
        width: mascotW,
        height: mascotH,
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

    // マスコットウィンドウを最前面レベル 'screen-saver' (非常に高い優先度) に設定
    if (configData.alwaysOnTop) {
        mascotWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    // 2. チャットウィンドウの作成
    const chatW = 350;
    const chatH = 400;
    const initialChatAlwaysOnTop = getEffectiveChatAlwaysOnTop(configData);
    chatWindow = new BrowserWindow({
        width: chatW,
        height: chatH,
        x: initialX + mascotW,
        y: initialY,
        transparent: true,
        frame: false,
        alwaysOnTop: initialChatAlwaysOnTop,
        resizable: false,
        show: false, // 初期表示状態は後述の toggle 処理等に委ねる
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // チャットウィンドウを最前面レベル 'floating' (標準的な最前面) に設定
    // これにより、チャットは一般ウィンドウ(ブラウザやエディタ)より前面に表示されつつ、マスコット(screen-saver)よりは背面になります
    if (initialChatAlwaysOnTop) {
        chatWindow.setAlwaysOnTop(true, 'floating');
    } else {
        chatWindow.setAlwaysOnTop(false);
    }

    // 3. 設定ウィンドウの作成（透過なし・通常ウィンドウ）
    createSettingsWindow();

    // --- 各種ロード処理 ---
    if (isDev) {
        const devUrl = process.env.VITE_DEV_SERVER_URL!;

        // レンダープロセス側のルーティングに合わせてハッシュやパスを切り分け可能にする
        // マスコットとチャットは同一のVueアプリからコンポーネントまたは簡易ルーティングで出し分ける
        mascotWindow.loadURL(`${devUrl}#mascot`);
        chatWindow.loadURL(`${devUrl}#chat`);
    } else {
        const htmlPath = path.join(__dirname, '../dist/index.html');
        mascotWindow.loadFile(htmlPath, { hash: 'mascot' });
        chatWindow.loadFile(htmlPath, { hash: 'chat' });
    }

    // --- イベントリスナーの登録 ---

    // チャットウィンドウ自体の移動を検知して相対オフセットを更新
    chatWindow.on('move', () => {
        if (isSyncingChatPosition || !mascotWindow || !chatWindow) return;
        const [mascotX, mascotY] = mascotWindow.getPosition();
        const [chatX, chatY] = chatWindow.getPosition();
        chatOffsetX = chatX - mascotX;
        chatOffsetY = chatY - mascotY;
    });

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
        if (!settingsWindow || settingsWindow.isDestroyed()) {
            createSettingsWindow();
        }
        if (settingsWindow) {
            settingsWindow.show();
            settingsWindow.focus();
            console.log('[IPC] Settings Window opened');
        }
    });

    // マスコットのサイズ（スケール）調整
    ipcMain.on('set-mascot-scale', (event, scale: number) => {
        if (!mascotWindow) return;

        console.log(`[IPC] Set Mascot Scale: ${scale}`);
        config.update({ mascotScale: scale });

        const defaultMascotW = 600;
        const defaultMascotH = 800;
        const newW = Math.round(defaultMascotW * scale);
        const newH = Math.round(defaultMascotH * scale);

        // ウィンドウサイズの変更
        mascotWindow.setSize(newW, newH);

        // チャットウィンドウ位置の再計算と同期
        chatOffsetX = newW;
        syncChatWindowPosition();

        // 全ウィンドウへ設定更新のブロードキャスト
        const updatedConfig = config.get();
        mascotWindow.webContents.send('config-updated', updatedConfig);
        if (chatWindow && !chatWindow.isDestroyed()) {
            chatWindow.webContents.send('config-updated', updatedConfig);
        }
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.webContents.send('config-updated', updatedConfig);
        }
    });

    // アプリケーションを安全に終了する
    ipcMain.on('quit-app', () => {
        console.log('[IPC] Quit App request received');
        app.quit();
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
    ipcMain.on('drag-window', (event, offset: { dx: number; dy: number }) => {
        const webContents = event.sender;
        const win = BrowserWindow.fromWebContents(webContents);
        if (win) {
            const [x, y] = win.getPosition();
            win.setPosition(x + offset.dx, y + offset.dy);
            debouncedSaveMascotPosition();
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
        const model = modelName || 'gemini-3.1-flash-lite';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

        try {
            console.log('=== Google AI Studio 送信開始 ===');
            console.log(`[GoogleAiStudio] 使用モデル: ${model}`);

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

            console.log(`[GoogleAiStudio] レスポンス内容取得成功`);
            console.log('=== Google AI Studio 送信完了 ===');
            return text || 'Error: 空の返答を受信しました。';

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('Google AI Studioとの接続エラー (タイムアウト)');
                return 'Error: Google AI Studioとの接続がタイムアウトしました。';
            } else {
                console.warn('Google AI Studioとの接続エラー:', error.message);
                return `Error: Google AI Studioとの接続に失敗しました`;
            }
        }
    });

    // 5-1. Generate mascot expressions with multiple engines
    ipcMain.handle('generate-mascot-expressions', async (event, base64Image: string, apiKey: string, emotions: { name: string, label: string }[], userPromptTemplate: string, engine?: string, model?: string) => {
        const geminiModel = 'gemini-3.1-flash-lite';
        const currentEngine = engine || 'gemini';
        const targetModel = model || '';

        let imagenModel = 'imagen-3.0-generate-002';

        // Auto-detect available Imagen models if engine is gemini
        if (currentEngine === 'gemini') {
            try {
                console.log('[Imagen] Fetching available model list from Google AI Studio...');
                const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
                const listResponse = await fetch(listUrl);
                if (listResponse.ok) {
                    const listData: any = await listResponse.json();
                    const availableModels = listData.models || [];

                    const foundModel = availableModels.find((m: any) =>
                        m.name.includes('imagen') &&
                        m.supportedGenerationMethods?.includes('predict')
                    );

                    if (foundModel) {
                        imagenModel = foundModel.name.replace('models/', '');
                        console.log(`[Imagen] Auto-detected predict-supported Imagen model: ${imagenModel}`);
                    } else {
                        const foundAnyImagen = availableModels.find((m: any) => m.name.includes('imagen'));
                        if (foundAnyImagen) {
                            imagenModel = foundAnyImagen.name.replace('models/', '');
                            console.log(`[Imagen] Fallback to general Imagen model: ${imagenModel}`);
                        } else {
                            console.log('[Imagen] No Imagen model found in API list. Using default.');
                        }
                    }
                } else {
                    console.warn('[Imagen] Model list response was abnormal. Using default.');
                }
            } catch (listError: any) {
                console.warn('[Imagen] Failed to retrieve model list. Using default:', listError.message);
            }
        }

        let characterFeatures = '';

        // 1. Analyze base image for style features using Gemini Vision
        if (base64Image) {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

            let rawBase64 = '';
            let mimeType = 'image/png';

            if (base64Image.startsWith('data:')) {
                rawBase64 = base64Image.split(',')[1] || base64Image;
                mimeType = base64Image.split(';')[0]?.split(':')[1] || 'image/png';
            } else {
                try {
                    let filePath = base64Image;
                    if (filePath.startsWith('file:///')) {
                        filePath = decodeURIComponent(filePath.replace('file:///', ''));
                    }
                    if (fs.existsSync(filePath)) {
                        console.log(`[GeminiVision] Loading local image file: ${filePath}`);
                        const fileBuffer = fs.readFileSync(filePath);
                        rawBase64 = fileBuffer.toString('base64');

                        const ext = path.extname(filePath).toLowerCase();
                        if (ext === '.jpg' || ext === '.jpeg') {
                            mimeType = 'image/jpeg';
                        } else if (ext === '.gif') {
                            mimeType = 'image/gif';
                        } else if (ext === '.webp') {
                            mimeType = 'image/webp';
                        }
                    } else {
                        console.warn(`[GeminiVision] Image file does not exist: ${filePath}`);
                    }
                } catch (readError: any) {
                    console.warn(`[GeminiVision] Failed to read image file:`, readError.message);
                }
            }

            if (rawBase64) {
                const featurePrompt = `
                    You are an expert prompt engineer for image generation models like Imagen 3 and DALL-E 3.
                    Analyze the mascot character in this reference image.
                    Your goal is to write a highly detailed, descriptive English prompt describing this character so perfectly that an image generator can reproduce the EXACT SAME character in the EXACT SAME art style.
                    
                    Describe in detail:
                    1. The precise art style: (e.g., flat 2D vector anime style, detailed digital art, chibi illustration, clean thick outline, pure white background).
                    2. Detailed character features: hairstyle, hair length, precise hair color, eye shape, eye color, facial structure.
                    3. Precise clothing & outfit: clothing items, colors, patterns, accessories, shoes.
                    4. Proportions and design aesthetics: (e.g., cute, stylized 2D mascot).
                    
                    Output ONLY a single, comprehensive paragraph of English keywords and phrases describing the style and character, optimized for image generation.
                    Do not include any greeting, conversational text, or introductions. Output only the prompt keywords.
                `;

                try {
                    console.log('[GeminiVision] Extracting high-fidelity character features...');
                    const geminiResponse = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [
                                {
                                    parts: [
                                        { text: featurePrompt },
                                        {
                                            inline_data: {
                                                mime_type: mimeType,
                                                data: rawBase64
                                            }
                                        }
                                    ]
                                }
                            ]
                        })
                    });

                    if (geminiResponse.ok) {
                        const geminiData: any = await geminiResponse.json();
                        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
                        characterFeatures = text ? text.trim() : '';
                        console.log(`[GeminiVision] Extracted features: ${characterFeatures}`);
                    } else {
                        console.warn('Google AI Studio connection error (failed feature extraction)');
                    }
                } catch (error: any) {
                    console.warn('Google AI Studio connection error:', error.message);
                }
            }
        }

        // 2. Assemble prompt
        const emotionsStr = emotions.map(e => `${e.name} (${e.label})`).join(', ');
        const emotionsLabels = emotions.map(e => e.label).join(', ');

        let finalPrompt = userPromptTemplate;

        // Character consistency enforcement prompt
        const consistencyHook = `A multi-pose character sheet of the same single character, showing the exact same character with different facial expressions. The character design, clothing, face features, and hair style must remain 100% identical, uniform and consistent across all panels.`;

        if (finalPrompt.includes('[FEATURES]')) {
            finalPrompt = finalPrompt.replace('[FEATURES]', characterFeatures || 'a cute character');
        } else if (characterFeatures) {
            finalPrompt = `Appearance style and character design details: ${characterFeatures}. ${finalPrompt}`;
        }

        // Inject consistency hook to maintain identical look
        finalPrompt = `${consistencyHook} ${finalPrompt}`;

        const labelInstruction = `Each expression must have its English label strictly displayed under the face. The labels must be one of: [${emotionsLabels}]. The label text must be clear, clean, and in black font on a white background or directly below the face box. Make sure each face is separated by a solid black grid line.`;
        finalPrompt = `${finalPrompt} ${labelInstruction}`;
        finalPrompt = userPromptTemplate;

        console.log(`[ImageGenerator] Engine: ${currentEngine}, Model: ${targetModel || imagenModel}`);
        console.log(`[ImageGenerator] Final prompt: ${finalPrompt}`);

        // 3. Generate image based on selected engine
        if (currentEngine === 'openai') {
            console.log('[OpenAI] Generating expressions using DALL-E...');
            const appConfig = config.get();
            const openaiKey = appConfig.openaiApiKey || apiKey;
            if (!openaiKey) {
                return { success: false, error: 'OpenAI API key is not registered. Please register in Settings.' };
            }

            const openaiUrl = 'https://api.openai.com/v1/images/generations';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000);

            try {
                const response = await fetch(openaiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openaiKey}`
                    },
                    body: JSON.stringify({
                        model: targetModel || 'dall-e-3',
                        prompt: finalPrompt,
                        n: 1,
                        size: '1024x1024',
                        response_format: 'b64_json'
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`OpenAI API Error: ${response.status} ${errorText}`);
                }

                const data: any = await response.json();
                const b64Json = data.data?.[0]?.b64_json;

                if (!b64Json) {
                    throw new Error('Failed to retrieve image data.');
                }

                console.log('[OpenAI] Image generated successfully');
                return {
                    success: true,
                    imageBytes: `data:image/png;base64,${b64Json}`
                };
            } catch (error: any) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    console.warn('OpenAI connection error (timeout)');
                    return { success: false, error: 'OpenAI generation timed out (90s).' };
                } else {
                    console.warn('OpenAI connection error:', error.message);
                    return { success: false, error: 'OpenAI generation failed: ' + error.message };
                }
            }
        }
        else if (currentEngine === 'comfyui') {
            console.log('[ComfyUI] Generating expressions using local ComfyUI...');
            const targetWorkflow = targetModel || '29:40';
            const [nodeIdStr, fieldKeyStr] = targetWorkflow.split(':');
            const nodeId = nodeIdStr || '29';
            const fieldKey = fieldKeyStr || 'text';

            console.log(`[ComfyUI] Target node: ${nodeId}, field: ${fieldKey}`);

            const comfyUrl = 'http://127.0.0.1:8188/prompt';

            try {
                const response = await fetch(comfyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: {
                            [nodeId]: {
                                class_type: "CLIPTextEncode",
                                inputs: {
                                    [fieldKey === '40' ? 'text' : fieldKey]: finalPrompt
                                }
                            }
                        }
                    })
                });

                if (response.ok) {
                    return {
                        success: false,
                        error: 'Workflow submitted to ComfyUI successfully. Please import the generated sheet manually from ComfyUI output folder.'
                    };
                } else {
                    throw new Error(`ComfyUI Server Error: ${response.status}`);
                }
            } catch (error: any) {
                console.warn('ComfyUI connection error:', error.message);
                return {
                    success: false,
                    error: `Could not connect to ComfyUI. Ensure local server (http://127.0.0.1:8188) is running. Target: [Node:${nodeId}, Field:${fieldKey}]`
                };
            }
        }
        else if (currentEngine === 'ollama') {
            console.log('[Ollama] Ollama expression generation triggered...');
            return {
                success: false,
                error: `Ollama (${targetModel || 'llava'}) is not an image model. Please select Gemini, OpenAI, or Comfy UI for generation.`
            };
        }
        else {
            const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel || imagenModel}:predict?key=${apiKey}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000);

            try {
                console.log('[Imagen] Starting image generation...');
                const response = await fetch(imagenUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instances: [
                            {
                                prompt: finalPrompt
                            }
                        ],
                        parameters: {
                            sampleCount: 1,
                            outputMimeType: 'image/png',
                            aspectRatio: '1:1'
                        }
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Imagen API Error: ${response.status} ${errorText}`);
                }

                const data: any = await response.json();
                const base64Bytes = data.predictions?.[0]?.bytesBase64Encoded;

                if (!base64Bytes) {
                    throw new Error('Failed to retrieve image bytes from API.');
                }

                console.log('[Imagen] Image generated successfully');
                return {
                    success: true,
                    imageBytes: `data:image/png;base64,${base64Bytes}`
                };

            } catch (error: any) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    console.warn('Google AI Studio connection error (Imagen timeout)');
                    return { success: false, error: 'Imagen generation timed out (90s).' };
                } else {
                    console.warn('Google AI Studio connection error (Imagen fail):', error.message);
                    return { success: false, error: 'Imagen generation failed: ' + error.message };
                }
            }
        }
    });

    // 5-3. Get available Imagen models from Google AI Studio
    ipcMain.handle('get-imagen-models', async (event, apiKey: string) => {
        const defaultModels = ['imagen-3.0-generate-002', 'imagen-3.0-generate-001', 'imagen-3.0-generate'];
        if (!apiKey) {
            return defaultModels;
        }

        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            console.log('[ImagenList] Fetching available Imagen models...');
            const response = await fetch(listUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data: any = await response.json();
            const models = data.models || [];

            const imagenModels = models
                .filter((m: any) =>
                    m.name.includes('imagen') &&
                    m.supportedGenerationMethods?.includes('predict')
                )
                .map((m: any) => m.name.replace('models/', ''));

            if (imagenModels.length > 0) {
                console.log(`[ImagenList] Found Imagen models: ${imagenModels.join(', ')}`);
                return imagenModels;
            }

            const anyImagen = models
                .filter((m: any) => m.name.includes('imagen'))
                .map((m: any) => m.name.replace('models/', ''));

            if (anyImagen.length > 0) {
                console.log(`[ImagenList] Found generic Imagen models: ${anyImagen.join(', ')}`);
                return anyImagen;
            }

            return defaultModels;
        } catch (error: any) {
            clearTimeout(timeoutId);
            console.warn('[ImagenList] Failed to fetch Imagen models, using defaults:', error.message);
            return defaultModels;
        }
    });

    // 5-2. Gemini Visionによるスプライトシート解析（表情切り出し支援）
    ipcMain.handle('analyze-sprite-sheet', async (event, base64Image: string, apiKey: string) => {
        const model = 'gemini-3.1-flash-lite';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Base64データからプレフィックス（data:image/png;base64,）を除去
        const rawBase64 = base64Image.split(',')[1] || base64Image;

        const prompt = `
            Analyze this expression sprite sheet. 
            Identify each facial expression box. 
            For each box, determine which of the following 28 SillyTavern emotion labels it best represents:
            
            [admiration, amusement, anger, annoyance, approval, caring, confusion, curiosity, desire, disappointment, disapproval, disgust, embarrassment, excitement, fear, gratitude, grief, joy, love, nervousness, optimism, pride, realization, relief, remorse, sadness, surprise, neutral]
            
            Return the result strictly in JSON format as an array of objects. 
            For each detected face, specify the exact matched emotion label from the list above, and provide its normalized coordinates [ymin, xmin, ymax, xmax] (range 0-1000).
            Ensure that each detected face is mapped to ONE of the 28 emotions above.
            
            Format:
            [
                {"label": "emotion_label_from_list", "box_2d": [ymin, xmin, ymax, xmax]},
                ...
            ]
            
            Important: Ensure the crop boxes focus accurately on the face area (including hair and head).
        `;

        try {
            console.log('[GeminiVision] スプライトシート解析開始...');
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: 'image/png',
                                        data: rawBase64
                                    }
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        response_mime_type: "application/json"
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Vision API Error: ${response.status} ${errorText}`);
            }

            const data: any = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log(`[GeminiVision] 解析結果受信: ${text}`);

            return JSON.parse(text);

        } catch (error: any) {
            console.error('[GeminiVision] Error analyzing sprite sheet:', error);
            return { error: error.message };
        }
    });

    // 6. VOICEVOXによる音声合成のハンドラー
    ipcMain.handle('synthesize-voicevox', async (event, text: string, speakerId: number, endpoint?: string) => {
        const defaultEndpoint = 'http://localhost:50021';
        const baseUrl = endpoint || defaultEndpoint;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

        try {
            console.log(`[VoiceVox] 音声合成クエリ作成開始: ${text}`);
            const encodedText = encodeURIComponent(text);
            const queryUrl = baseUrl.endsWith('/')
                ? `${baseUrl}audio_query?text=${encodedText}&speaker=${speakerId}`
                : `${baseUrl}/audio_query?text=${encodedText}&speaker=${speakerId}`;

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
            const synthesisUrl = baseUrl.endsWith('/')
                ? `${baseUrl}synthesis?speaker=${speakerId}`
                : `${baseUrl}/synthesis?speaker=${speakerId}`;
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

    // 6-2. VOICEVOX の疎通確認および話者（スタイル）一覧取得のハンドラー
    ipcMain.handle('get-voicevox-speakers', async (event, endpoint: string) => {
        const defaultEndpoint = 'http://localhost:50021';
        const apiBase = endpoint || defaultEndpoint;
        const url = apiBase.endsWith('/') ? `${apiBase}speakers` : `${apiBase}/speakers`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

        try {
            console.log(`[VoiceVox] 疎通確認・話者リスト取得開始: ${url}`);
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const rawSpeakers: any = await response.json();
            const speakers: { name: string, value: number }[] = [];

            // 話者とスタイルのネスト構造をフラットにマッピング
            for (const sp of rawSpeakers) {
                for (const style of sp.styles || []) {
                    speakers.push({
                        name: `${sp.name} (${style.name})`,
                        value: Number(style.id)
                    });
                }
            }

            console.log(`[VoiceVox] 疎通成功。取得話者スタイル数: ${speakers.length}`);
            return { success: true, speakers };

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('VoiceVoxとの接続確認エラー (タイムアウト)');
                return { success: false, speakers: [], error: '接続がタイムアウトしました。' };
            } else {
                console.warn('VoiceVoxとの接続確認エラー');
                return { success: false, speakers: [], error: '接続に失敗しました。' };
            }
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

    // 8. LM Studio (ローカル) 疎通確認およびモデル一覧取得のハンドラー
    ipcMain.handle('get-lmstudio-models', async (event, endpoint: string) => {
        const defaultEndpoint = 'http://127.0.0.1:1234/v1/';
        const apiBase = endpoint || defaultEndpoint;
        const url = apiBase.endsWith('/') ? `${apiBase}models` : `${apiBase}/models`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

        try {
            console.log(`[LmStudio] 疎通確認・モデル一覧取得開始: ${url}`);
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data: any = await response.json();
            // 一般的な OpenAI / LM Studio / Llama.cpp 互換のレスポンス形式
            const models = (data.data || []).map((m: any) => m.id);
            console.log(`[LmStudio] 疎通成功。取得モデル数: ${models.length}`);
            return { success: true, models };
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('LmStudioとの接続確認エラー (タイムアウト)');
                return { success: false, models: [], error: '接続がタイムアウトしました。' };
            } else {
                console.warn('LmStudioとの接続確認エラー');
                return { success: false, models: [], error: '接続に失敗しました。' };
            }
        }
    });

    // 8-2. ローカルの画像ファイルを選択してBase64形式のData URLで取得するハンドラー
    ipcMain.handle('select-local-image', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return null;

        try {
            const result = await dialog.showOpenDialog(win, {
                title: '画像ファイルを選択',
                properties: ['openFile'],
                filters: [
                    { name: '画像ファイル', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }
                ]
            });

            if (result.canceled || result.filePaths.length === 0) {
                return null;
            }

            const filePath = result.filePaths[0];
            const fileBuffer = fs.readFileSync(filePath);

            // 拡張子から適切なMIMEタイプを判別
            const ext = path.extname(filePath).toLowerCase();
            let mimeType = 'image/png';
            if (ext === '.jpg' || ext === '.jpeg') {
                mimeType = 'image/jpeg';
            } else if (ext === '.gif') {
                mimeType = 'image/gif';
            } else if (ext === '.webp') {
                mimeType = 'image/webp';
            } else if (ext === '.svg') {
                mimeType = 'image/svg+xml';
            }

            const base64Data = fileBuffer.toString('base64');
            const dataUrl = `data:${mimeType};base64,${base64Data}`;

            // ファイル名も返すことでアセット名の自動補完を可能にする
            const fileName = path.basename(filePath, ext);

            return {
                success: true,
                path: dataUrl,
                name: fileName
            };
        } catch (error) {
            console.error('[IPC] Failed to select or read local image:', error);
            return {
                success: false,
                error: '画像のロードに失敗しました。'
            };
        }
    });

    // 9. 設定の取得および更新ハンドラー
    ipcMain.handle('get-app-config', async () => {
        return config.get();
    });

    ipcMain.handle('update-app-config', async (event, newData: Partial<ConfigData>) => {
        config.update(newData);
        console.log('[Config] Configuration updated via IPC');

        const currentConfig = config.get();

        // 1. チャットウィンドウへの伝達と最前面制御 (連動判定を考慮)
        if (chatWindow && !chatWindow.isDestroyed()) {
            if (newData.chatAlwaysOnTop !== undefined || newData.alwaysOnTop !== undefined) {
                const effectiveAlwaysOnTop = getEffectiveChatAlwaysOnTop(currentConfig);
                if (effectiveAlwaysOnTop) {
                    chatWindow.setAlwaysOnTop(true, 'floating');
                } else {
                    chatWindow.setAlwaysOnTop(false);
                }
            }
            chatWindow.webContents.send('config-updated', currentConfig);
        }

        // 2. マスコットウィンドウへの伝達と最前面制御 (レベル 'screen-saver' を指定)
        if (mascotWindow && !mascotWindow.isDestroyed()) {
            if (newData.alwaysOnTop !== undefined) {
                if (newData.alwaysOnTop) {
                    mascotWindow.setAlwaysOnTop(true, 'screen-saver');
                } else {
                    mascotWindow.setAlwaysOnTop(false);
                }
            }
            mascotWindow.webContents.send('config-updated', currentConfig);
        }

        // 3. 設定ウィンドウへの伝達
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.webContents.send('config-updated', currentConfig);
        }
    });

    // 10. エディタからのリアルタイムプレビュー通知（保存前の状態を反映）
    ipcMain.on('preview-mascot-state', (event, previewState: any) => {
        if (mascotWindow && !mascotWindow.isDestroyed()) {
            mascotWindow.webContents.send('apply-preview-state', previewState);
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
