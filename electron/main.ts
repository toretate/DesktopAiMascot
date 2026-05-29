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
