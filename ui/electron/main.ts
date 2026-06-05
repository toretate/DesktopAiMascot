import { app, BrowserWindow, ipcMain, screen, dialog, shell, Notification } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { LMStudioClient } from '@lmstudio/sdk';
import { AiExpressionService } from '../src/skills/expression-service/expression-service';

// HTTPエンドポイントをLM Studio SDK用のWebSocket/TCP形式に変換するヘルパー
function getSdkEndpoint(httpEndpoint: string): string {
    let wsEndpoint = (httpEndpoint || '').trim();
    if (!wsEndpoint) {
        return 'ws://127.0.0.1:1234';
    }
    // http(s):// を ws(s):// に変換
    if (wsEndpoint.startsWith('http://')) {
        wsEndpoint = wsEndpoint.replace('http://', 'ws://');
    } else if (wsEndpoint.startsWith('https://')) {
        wsEndpoint = wsEndpoint.replace('https://', 'wss://');
    } else if (!wsEndpoint.startsWith('ws://') && !wsEndpoint.startsWith('wss://')) {
        wsEndpoint = 'ws://' + wsEndpoint;
    }
    // 末尾の /v1 や /v1/ などを除去
    wsEndpoint = wsEndpoint.replace(/\/v1\/?$/, '');
    // 末尾の /api/v1/models などの独自パスがある場合も除去
    wsEndpoint = wsEndpoint.replace(/\/api\/v1(\/models)?\/?$/, '');
    // 末尾の / を除去
    if (wsEndpoint.endsWith('/')) {
        wsEndpoint = wsEndpoint.slice(0, -1);
    }
    return wsEndpoint;
}

// AiExpressionService にプラットフォーム依存モジュールを注入
AiExpressionService.setAdapter({
    readFileSync: (p: string) => fs.readFileSync(p) as any,
    existsSync: (p: string) => fs.existsSync(p),
    pathJoin: (...args: string[]) => path.join(...args),
    pathExtname: (p: string) => path.extname(p),
    cwd: () => {
        const currentCwd = process.cwd();
        if (path.basename(currentCwd) === 'ui') {
            return path.dirname(currentCwd);
        }
        return currentCwd;
    }
});

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
    chatBorderShow: boolean;
    chatBorderColor: string;
    chatBorderWidth: number;
    chatBackgroundColor: string;
    openaiApiKey: string;
    anthropicApiKey: string;
    mascots: MascotData[];
    activeMascotId: string;
    settingsWidth: number;
    settingsHeight: number;
    settingsX: number;
    settingsY: number;
    mascotScale: number;

    // サーバー接続設定
    useServer: boolean;
    serverHost: string;
    serverPort: number;
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
            chatBorderShow: true,
            chatBorderColor: '#a855f7',
            chatBorderWidth: 1,
            chatBackgroundColor: '#ffffff',
            openaiApiKey: '',
            anthropicApiKey: '',
            mascots: defaultMascots,
            activeMascotId: 'mascot_robot_001',
            settingsWidth: 800,
            settingsHeight: 600,
            settingsX: -1,
            settingsY: -1,
            mascotScale: 1.0,
            useServer: false,
            serverHost: 'localhost',
            serverPort: 3000
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
let characterBounds = { top: 0, bottom: 800, left: 0, right: 600 }; // キャラクター画像のウィンドウ内描画境界

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

// --- チャットウィンドウの表示時位置調整処理 ---
function adjustChatWindowPosition() {
    if (!mascotWindow || mascotWindow.isDestroyed() || !chatWindow || chatWindow.isDestroyed()) return;

    const mascotBounds = mascotWindow.getBounds();
    const chatBounds = chatWindow.getBounds();
    
    // キャラクターが現在いる物理ディスプレイを取得
    const targetDisplay = screen.getDisplayMatching(mascotBounds);
    const displayBounds = targetDisplay.workArea;
    
    const chatW = chatBounds.width;
    const chatH = chatBounds.height;
    
    // characterBoundsの各値が有効な数値か検証し、不正な場合はフォールバック
    const boundsTop = Number.isFinite(characterBounds.top) ? characterBounds.top : 0;
    const boundsBottom = Number.isFinite(characterBounds.bottom) ? characterBounds.bottom : mascotBounds.height;
    const boundsLeft = Number.isFinite(characterBounds.left) ? characterBounds.left : 0;
    const boundsRight = Number.isFinite(characterBounds.right) ? characterBounds.right : mascotBounds.width;
    
    // キャラクター画像のグローバル座標系での境界を算出
    const globalCharTop = mascotBounds.y + boundsTop;
    const globalCharBottom = mascotBounds.y + boundsBottom;
    const globalCharLeft = mascotBounds.x + boundsLeft;
    const globalCharRight = mascotBounds.x + boundsRight;
    
    // 基本位置：キャラクター画像の右側、ウィンドウの下をキャラクター画像の下に合わせる
    let targetX = globalCharRight;
    let targetY = globalCharBottom - chatH;
    
    // 上下方向のはみ出し補正
    if (targetY + chatH > displayBounds.y + displayBounds.height) {
        targetY = displayBounds.y + displayBounds.height - chatH;
    }
    if (targetY < displayBounds.y) {
        targetY = displayBounds.y;
    }
    
    // キャラクター画像の右端に表示した場合に、メッセージウィンドウが画面外にはみ出すとき
    if (targetX + chatW > displayBounds.x + displayBounds.width) {
        // キャラクター画像の左側に表示
        targetX = globalCharLeft - chatW;
        targetY = globalCharBottom - chatH;
        
        // 上下方向のはみ出し補正
        if (targetY + chatH > displayBounds.y + displayBounds.height) {
            targetY = displayBounds.y + displayBounds.height - chatH;
        }
        if (targetY < displayBounds.y) {
            targetY = displayBounds.y;
        }
    }
    
    // 最終的な座標値を四捨五入して整数値にする（Electronの座標エラーを防止）
    targetX = Math.round(targetX);
    targetY = Math.round(targetY);
    
    isSyncingChatPosition = true;
    chatWindow.setPosition(targetX, targetY);
    chatOffsetX = targetX - mascotBounds.x;
    chatOffsetY = targetY - mascotBounds.y;
    isSyncingChatPosition = false;
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

    // 保存済みサイズの範囲を安全値にクランプ（ウィンドウ幅が徐々に広がるバグを防止）
    const savedWidth = Math.min(Math.max(configData.settingsWidth || 900, 700), 1600);
    const savedHeight = Math.min(Math.max(configData.settingsHeight || 640, 480), 1200);

    const settingsOptions: Electron.BrowserWindowConstructorOptions = {
        width: savedWidth,
        height: savedHeight,
        minWidth: 700,
        maxWidth: 1600,
        minHeight: 480,
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
        settingsWindow.webContents.openDevTools();
    } else {
        settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'settings' });
    }

    // コンテンツ描画完了後に表示することで初期サイズを安定させる
    settingsWindow.once('ready-to-show', () => {
        // サイズが変わっていれば、保存された値に再度セットする（描画時の自動拡張を上書き）
        settingsWindow?.setSize(savedWidth, savedHeight);
    });

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
        // 保存済みサイズの範囲を安全値にクランプ
        const savedWidth = Math.min(Math.max(configData.settingsWidth || 900, 700), 1600);
        const savedHeight = Math.min(Math.max(configData.settingsHeight || 640, 480), 1200);

        const settingsOptions: Electron.BrowserWindowConstructorOptions = {
            width: savedWidth,
            height: savedHeight,
            minWidth: 700,
            maxWidth: 1600,
            minHeight: 480,
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
            adjustChatWindowPosition();
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
            chatWindow.show();
            chatWindow.focus();
            adjustChatWindowPosition();
            config.update({ chatVisible: true });
            mascotWindow?.webContents.send('chat-toggled', true);
        }
        console.log(`[IPC] Toggle Chat: visible=${!isVisible}`);
    });

    // Googleログイン開始 (BFFのログインURLをシステムブラウザで開く)
    ipcMain.on('auth:login', () => {
        const configData = config.get();
        const host = configData.serverHost || 'localhost';
        const port = configData.serverPort || 3000;
        const serverUrl = `http://${host}:${port}/api/auth/login`;
        console.log(`[IPC] opening auth URL: ${serverUrl}`);
        shell.openExternal(serverUrl);
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

    // アプリケーションを再起動する
    ipcMain.on('relaunch-app', () => {
        console.log('[IPC] Relaunch App request received');
        if (process.env.VITE_DEV_SERVER_URL) {
            // 開発環境（Vite）では再起動時に元のプロセス監視が切れてクラッシュするため警告を表示
            const parentWin = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null;
            const choice = dialog.showMessageBoxSync(parentWin!, {
                type: 'info',
                buttons: ['OK', 'キャンセル'],
                title: 'アプリ再起動',
                message: '開発環境（Vite）では自動再起動に対応していません。\n\nアプリを一旦終了しますので、手動で再度 `npm run dev` などを実行してください。',
                defaultId: 0,
                cancelId: 1
            });
            if (choice === 0) {
                app.quit();
            }
        } else {
            // 本番環境では安全に自動再起動
            app.relaunch();
            app.exit(0);
        }
    });

    // キャラクターの描画境界を受け取るハンドラー
    ipcMain.on('update-character-bounds', (event, bounds: { top: number; bottom: number; left: number; right: number }) => {
        characterBounds = bounds;
        console.log(`[IPC] Character bounds updated:`, characterBounds);
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

    // サーバーの疎通確認(ping)を行うハンドラー
    ipcMain.handle('test-server-connection', async (event, host: string, port: number) => {
        const url = `http://${host}:${port}/api/ping`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒タイムアウト

        try {
            console.log(`[IPC] Test Server Connection URL: ${url}`);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }

            const data: any = await response.json();
            return {
                success: true,
                message: data.message || 'pong'
            };
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('サーバーとの接続エラー (タイムアウト)');
                return { success: false, error: 'サーバーとの接続がタイムアウトしました。' };
            } else {
                console.warn('サーバーとの接続エラー:', error.message);
                return { success: false, error: `サーバーとの接続に失敗しました。` };
            }
        }
    });

    // 5. Gemini APIによる対話処理のハンドラー
    ipcMain.handle('ask-gemini', async (event, message: string, apiKey: string, systemPrompt: string, modelName: string, history?: any[], attachments?: any[]) => {
        const model = modelName || 'gemini-3.1-flash-lite';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

        try {
            console.log('=== Google AI Studio 送信開始 ===');
            console.log(`[GoogleAiStudio] 使用モデル: ${model}`);

            // 履歴のマッピング
            const contents = (history || []).map((msg: any) => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));
            
            // 今回のメッセージと添付ファイルの構築
            const parts: any[] = [{ text: message || '' }];
            if (attachments && attachments.length > 0) {
                for (const att of attachments) {
                    if (att.type === 'image' && att.url.startsWith('data:')) {
                        const match = att.url.match(/^data:(image\/\w+);base64,(.+)$/);
                        if (match) {
                            parts.push({
                                inlineData: {
                                    mimeType: match[1],
                                    data: match[2]
                                }
                            });
                        }
                    }
                }
            }

            // 最後に今回のメッセージを追加
            contents.push({
                role: 'user',
                parts: parts
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: contents,
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
    ipcMain.handle('generate-mascot-expressions', async (event, base64Image: string, apiKey: string, emotions: any[], userPromptTemplate: string, engine?: string, model?: string, history?: any[]) => {
        const appConfig = config.get();
        return await AiExpressionService.generateExpressions(
            base64Image,
            apiKey,
            emotions,
            userPromptTemplate,
            engine,
            model,
            history,
            appConfig.openaiApiKey
        );
    });

    // 5-3. Get available Imagen models from Google AI Studio
    ipcMain.handle('get-imagen-models', async (event, apiKey: string) => {
        return await AiExpressionService.getImagenModels(apiKey);
    });

    // 5-4. Get available chat models from Google AI Studio
    ipcMain.handle('get-gemini-models', async (event, apiKey: string) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            console.log(`[GoogleAiStudio] Starting to fetch chat models`);
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data: any = await response.json();
            const models = (data.models || [])
                .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m: any) => m.name.replace('models/', ''));

            console.log(`[GoogleAiStudio] Successfully fetched ${models.length} chat models`);
            return { success: true, models };
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('Google AI Studioとの接続確認エラー (タイムアウト)');
                return { success: false, models: [], error: '接続がタイムアウトしました。' };
            } else {
                console.warn('Google AI Studioとの接続確認エラー:', error.message);
                return { success: false, models: [], error: '接続に失敗しました。' };
            }
        }
    });

    // 5-2. Gemini Visionによるスプライトシート解析（表情切り出し支援）
    ipcMain.handle('analyze-sprite-sheet', async (event, base64Image: string, apiKey: string) => {
        return await AiExpressionService.analyzeSpriteSheet(base64Image, apiKey);
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
    ipcMain.handle('ask-lmstudio', async (event, message: string, systemPrompt: string, modelName: string, endpoint: string, history?: any[], attachments?: any[]) => {
        const sdkEndpoint = getSdkEndpoint(endpoint);
        const model = modelName || 'unspecified';

        try {
            console.log('=== LmStudio SDK 送信開始 ===');
            console.log(`[LmStudio] SDK エンドポイント: ${sdkEndpoint}`);
            console.log(`[LmStudio] 使用モデル: ${model}`);
            console.log(`[LmStudio] 送信メッセージ: ${message}`);

            const client = new LMStudioClient({ baseUrl: sdkEndpoint });
            const llm = await client.llm.model(model);

            // 履歴のマッピング
            const messagesPayload: any[] = [];
            if (systemPrompt && systemPrompt.trim()) {
                messagesPayload.push({ role: 'system', content: systemPrompt });
            }

            if (history && history.length > 0) {
                history.forEach((msg: any) => {
                    const text = msg.text || '';
                    if (text.trim()) {
                        messagesPayload.push({
                            role: msg.sender === 'user' ? 'user' : 'assistant',
                            content: text
                        });
                    }
                });
            }

            // 今回のメッセージ（画像添付ありを考慮）
            const userContent: any[] = [{ type: 'text', text: message || '' }];
            if (attachments && attachments.length > 0) {
                for (const att of attachments) {
                    if (att.type === 'image' && att.url.startsWith('data:')) {
                        const match = att.url.match(/^data:(image\/\w+);base64,(.+)$/);
                        if (match) {
                            userContent.push({
                                type: 'image',
                                image: {
                                    base64: match[2]
                                }
                            });
                        }
                    }
                }
            }

            messagesPayload.push({
                role: 'user',
                content: userContent.length > 1 ? userContent : (message || 'こんにちは')
            });

            const response = await llm.respond(messagesPayload);
            const rawContent = response.content || '';

            // 思考プロセス（Thinking Process や <thought> タグ）のクレンジング
            let cleanedContent = rawContent
                .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
                .replace(/<thought>[\s\S]*/gi, '')
                .replace(/^Thinking Process:[\s\S]*?(?=\n\n\S|$)/i, '')
                .replace(/\nThinking Process:[\s\S]*?(?=\n\n\S|$)/g, '');

            const text = cleanedContent.trim();

            console.log(`[LmStudio] レスポンス内容: ${text}`);
            console.log('=== LmStudio SDK 送信完了 ===');
            return text || 'Error: 空の返答を受信しました。';

        } catch (error: any) {
            console.error('[LmStudio] SDK接続・対話エラー:', error);
            return `Error: LM Studioとの接続に失敗しました。接続設定を確認してください。(${error.message})`;
        }
    });

    // 8. LM Studio (ローカル) 疎通確認およびモデル一覧取得のハンドラー
    ipcMain.handle('get-lmstudio-models', async (event, endpoint: string) => {
        const sdkEndpoint = getSdkEndpoint(endpoint);

        try {
            console.log(`[LmStudio] SDK 疎通確認・モデル一覧取得開始: ${sdkEndpoint}`);
            const client = new LMStudioClient({ baseUrl: sdkEndpoint });
            const loaded = await client.llm.listLoaded();

            const models = loaded.map((m: any) => ({
                id: m.id || m.key || m.path || '',
                capabilities: {
                    vision: m.capabilities?.vision ?? false,
                    trained_for_tool_use: m.capabilities?.trainedForToolUse ?? false,
                    reasoning: m.capabilities?.reasoning ?? false
                }
            }));
            
            console.log(`[LmStudio] 疎通成功。取得モデル数: ${models.length}`);
            return { success: true, models };
        } catch (error: any) {
            console.error('[LmStudio] SDK 疎通エラー:', error);
            return { success: false, models: [], error: `LM Studioへの接続に失敗しました。(${error.message})` };
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

    // チャット履歴の取得ハンドラー
    ipcMain.handle('get-chat-history', async () => {
        const historyPath = path.join(app.getPath('userData'), 'chat_history.json');
        try {
            if (fs.existsSync(historyPath)) {
                const data = fs.readFileSync(historyPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('[Config] Failed to load chat history:', error);
        }
        return {};
    });

    // チャット履歴の保存ハンドラー
    ipcMain.handle('save-chat-history', async (event, history: any) => {
        const historyPath = path.join(app.getPath('userData'), 'chat_history.json');
        try {
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 4), 'utf8');
            return { success: true };
        } catch (error) {
            console.error('[Config] Failed to save chat history:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // チャット履歴ファイルをシステムのエディタで開くハンドラー
    ipcMain.on('open-chat-history', () => {
        const historyPath = path.join(app.getPath('userData'), 'chat_history.json');
        if (!fs.existsSync(historyPath)) {
            try {
                fs.writeFileSync(historyPath, JSON.stringify({}, null, 4), 'utf8');
            } catch (error) {
                console.error('[Config] Failed to create empty chat history file:', error);
                return;
            }
        }
        shell.openPath(historyPath);
    });

    // マスコットの openclaw スタイルプロンプト（soul, identity, user, agents, memory）の読み込みハンドラー
    ipcMain.handle('get-mascot-prompts', async (event, mascotId: string) => {
        const currentCwd = process.cwd();
        const baseCwd = path.basename(currentCwd) === 'ui' ? path.dirname(currentCwd) : currentCwd;
        const mascotDir = path.join(baseCwd, 'mascots', mascotId);

        const result = {
            soul: '',
            identity: '',
            user: '',
            agents: '',
            memory: ''
        };

        if (fs.existsSync(mascotDir)) {
            const soulPath = path.join(mascotDir, 'soul.md');
            const identityPath = path.join(mascotDir, 'identity.md');
            const userPath = path.join(mascotDir, 'user.md');
            const agentsPath = path.join(mascotDir, 'agents.md');
            const memoryPath = path.join(mascotDir, 'memory.md');

            // テンプレート自動生成（初期化）
            if (!fs.existsSync(soulPath)) {
                const defaultSoul = `# Mascot Soul & Tone\n\n- 口調: 親しみやすく、少し甘えん坊なトーンで話す。\n- 感情表現: ユーザーに懐いており、[happy] な感情になりやすい。\n- 語尾: 「〜だよ」「〜だね」を好んで使う。\n`;
                fs.writeFileSync(soulPath, defaultSoul, 'utf8');
            }
            if (!fs.existsSync(identityPath)) {
                const defaultIdentity = `# Mascot Identity\n\n- 名前: AIマスコット\n- 役割: ユーザーのデスクトップに住み着いた電子の妖精。\n- 目的: ユーザーの作業を見守り、おしゃべり相手になること。\n`;
                fs.writeFileSync(identityPath, defaultIdentity, 'utf8');
            }
            if (!fs.existsSync(userPath)) {
                const defaultUser = `# User Context\n\n- ユーザーへの呼び方: 「マスター」\n- 関係性: 常にマスターを第一に考え、応援している。\n`;
                fs.writeFileSync(userPath, defaultUser, 'utf8');
            }
            if (!fs.existsSync(agentsPath)) {
                const defaultAgents = `# Mascot Agents & Rules\n\n- ルール: 不適切な表現や暴力的・攻撃的な発言は絶対に避けてください。\n- 安全基準: 常にマスターにとって安全で励みになる存在であり続けること。\n`;
                fs.writeFileSync(agentsPath, defaultAgents, 'utf8');
            }
            if (!fs.existsSync(memoryPath)) {
                const defaultMemory = `# Mascot Long-term Memory\n\n- 重要な決定事項: ここには会話を通じて学んだ情報や、重要な約束事を記録します。\n`;
                fs.writeFileSync(memoryPath, defaultMemory, 'utf8');
            }

            result.soul = fs.readFileSync(soulPath, 'utf8');
            result.identity = fs.readFileSync(identityPath, 'utf8');
            result.user = fs.readFileSync(userPath, 'utf8');
            result.agents = fs.readFileSync(agentsPath, 'utf8');
            result.memory = fs.readFileSync(memoryPath, 'utf8');
        }
        return result;
    });
 
    // マスコットの openclaw スタイルプロンプト（soul, identity, user, agents, memory）の保存ハンドラー
    ipcMain.handle('save-mascot-prompts', async (event, mascotId: string, prompts: { soul: string; identity: string; user: string; agents: string; memory: string }) => {
        const currentCwd = process.cwd();
        const baseCwd = path.basename(currentCwd) === 'ui' ? path.dirname(currentCwd) : currentCwd;
        const mascotDir = path.join(baseCwd, 'mascots', mascotId);

        try {
            if (!fs.existsSync(mascotDir)) {
                fs.mkdirSync(mascotDir, { recursive: true });
            }
            fs.writeFileSync(path.join(mascotDir, 'soul.md'), prompts.soul || '', 'utf8');
            fs.writeFileSync(path.join(mascotDir, 'identity.md'), prompts.identity || '', 'utf8');
            fs.writeFileSync(path.join(mascotDir, 'user.md'), prompts.user || '', 'utf8');
            fs.writeFileSync(path.join(mascotDir, 'agents.md'), prompts.agents || '', 'utf8');
            fs.writeFileSync(path.join(mascotDir, 'memory.md'), prompts.memory || '', 'utf8');
            console.log(`[Config] Mascot prompts saved for: ${mascotId}`);
            return { success: true };
        } catch (error: any) {
            console.error('[Config] Failed to save mascot prompts:', error);
            return { success: false, error: error.message };
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

    // 11. ローカルタイマーの開始
    ipcMain.on('start-timer', (event, seconds: number, memo: string) => {
        const durationMs = seconds * 1000;
        console.log(`[Timer] Local timer started: ${seconds} seconds. Memo: ${memo}`);

        setTimeout(() => {
            console.log(`[Timer] Local timer triggered: ${memo}`);
            triggerTimerNotifications(memo);
        }, durationMs);
    });

    // 12. タイマー発火の通知を要求する（サーバー側でのタイマー満了時など）
    ipcMain.on('trigger-timer-notification', (event, memo: string) => {
        console.log(`[Timer] Trigger timer notification requested. Memo: ${memo}`);
        triggerTimerNotifications(memo);
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

// タイマー通知のトリガー処理（OSの通知およびマスコットウィンドウへの配信）
function triggerTimerNotifications(memo: string) {
    if (mascotWindow && !mascotWindow.isDestroyed()) {
        mascotWindow.webContents.send('timer-trigger', memo);
    }
    if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('timer-trigger', memo);
    }

    if (Notification.isSupported()) {
        const notification = new Notification({
            title: 'デスクトップマスコットのお知らせ',
            body: memo,
            silent: false
        });
        notification.show();
    }
}
