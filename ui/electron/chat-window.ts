import { BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import { getMascotWindow } from './mascot-window';

let chatWindow: BrowserWindow | null = null;
let chatOffsetX = 300; // マスコットとのX軸相対オフセット (初期値はマスコット幅300)
let chatOffsetY = 0;   // マスコットとのY軸相対オフセット
let isSyncingChatPosition = false; // moveイベントのループを防ぐフラグ
let characterBounds = { top: 0, bottom: 800, left: 0, right: 600 }; // キャラクター画像のウィンドウ内描画境界

let appConfig: any = null;
let isDevMode = false;

export function initChatWindow(config: any, isDev: boolean) {
    appConfig = config;
    isDevMode = isDev;

    // チャットウィンドウのトグル
    ipcMain.on('toggle-chat', () => {
        toggleChatWindow();
    });

    // キャラクターの描画境界を受け取るハンドラー
    ipcMain.on('update-character-bounds', (event, bounds: { top: number; bottom: number; left: number; right: number }) => {
        characterBounds = bounds;
        console.log(`[IPC] Character bounds updated:`, characterBounds);
    });
}

export function getChatWindow(): BrowserWindow | null {
    return chatWindow;
}

export function getChatOffsets() {
    return { chatOffsetX, chatOffsetY };
}

export function setChatOffsets(x: number, y: number) {
    chatOffsetX = x;
    chatOffsetY = y;
}

export function setIsSyncingChatPosition(sync: boolean) {
    isSyncingChatPosition = sync;
}

// --- チャット最前面表示の連動判定処理 ---
export function getEffectiveChatAlwaysOnTop(configData: any): boolean {
    if (configData.chatAlwaysOnTop === 'sync') {
        return !!configData.alwaysOnTop;
    }
    return !!configData.chatAlwaysOnTop;
}

// --- チャットウィンドウの表示時位置調整処理 ---
export function adjustChatWindowPosition() {
    const mascotWin = getMascotWindow();
    if (!mascotWin || mascotWin.isDestroyed() || !chatWindow || chatWindow.isDestroyed()) return;

    const mascotBounds = mascotWin.getBounds();
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
export function syncChatWindowPosition() {
    const mascotWin = getMascotWindow();
    if (!mascotWin || !chatWindow || !chatWindow.isVisible()) return;

    isSyncingChatPosition = true;
    const [mascotX, mascotY] = mascotWin.getPosition();
    chatWindow.setPosition(mascotX + chatOffsetX, mascotY + chatOffsetY);
    isSyncingChatPosition = false;
}

export function createChatWindow(initialX: number, initialY: number, mascotWidth: number): BrowserWindow {
    if (chatWindow && !chatWindow.isDestroyed()) {
        return chatWindow;
    }

    const configData = appConfig.get();
    const chatW = 350;
    const chatH = 400;
    const initialChatAlwaysOnTop = getEffectiveChatAlwaysOnTop(configData);
    
    chatWindow = new BrowserWindow({
        width: chatW,
        height: chatH,
        x: initialX + mascotWidth,
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

    if (initialChatAlwaysOnTop) {
        chatWindow.setAlwaysOnTop(true, 'floating');
    } else {
        chatWindow.setAlwaysOnTop(false);
    }

    if (isDevMode) {
        const devUrl = process.env.VITE_DEV_SERVER_URL!;
        chatWindow.loadURL(`${devUrl}#chat`);
    } else {
        chatWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'chat' });
    }

    // チャットウィンドウ自体の移動を検知して相対オフセットを更新
    chatWindow.on('move', () => {
        const mascotWinRef = getMascotWindow();
        if (isSyncingChatPosition || !mascotWinRef || !chatWindow) return;
        const [mascotX, mascotY] = mascotWinRef.getPosition();
        const [chatX, chatY] = chatWindow.getPosition();
        chatOffsetX = chatX - mascotX;
        chatOffsetY = chatY - mascotY;
    });

    return chatWindow;
}

export function toggleChatWindow() {
    if (!chatWindow) return;

    const isVisible = chatWindow.isVisible();
    const mascotWin = getMascotWindow();
    if (isVisible) {
        chatWindow.hide();
        appConfig.update({ chatVisible: false });
        mascotWin?.webContents.send('chat-toggled', false);
    } else {
        chatWindow.show();
        chatWindow.focus();
        adjustChatWindowPosition();
        appConfig.update({ chatVisible: true });
        mascotWin?.webContents.send('chat-toggled', true);
    }
    console.log(`[IPC] Toggle Chat: visible=${!isVisible}`);
}
