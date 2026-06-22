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

    // チャットウィンドウのサイズ変更を受け取るハンドラー（HTML/JSのカスタムリサイズ対応）
    ipcMain.on('resize-chat-window', (event, size: { width: number; height: number }) => {
        if (!chatWindow || chatWindow.isDestroyed()) return;
        const mascotWinRef = getMascotWindow();
        if (!mascotWinRef || mascotWinRef.isDestroyed()) return;

        const mascotBounds = mascotWinRef.getBounds();
        const chatBounds = chatWindow.getBounds();

        const w = Math.round(size.width);
        const h = Math.round(size.height);

        isSyncingChatPosition = true;
        chatWindow.setBounds({
            x: chatBounds.x,
            y: chatBounds.y,
            width: w,
            height: h
        });
        
        chatOffsetX = chatBounds.x - mascotBounds.x;
        chatOffsetY = chatBounds.y - mascotBounds.y;
        appConfig.update({ chatWidth: w, chatHeight: h });
        
        // 設定更新イベントをUIに送信してPiniaストアを同期
        chatWindow.webContents.send('config-updated', appConfig.get());
        isSyncingChatPosition = false;
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

    const configData = appConfig.get();
    const chatW = configData.chatWidth ?? 350;
    const chatH = configData.chatHeight ?? 400;

    const mascotBounds = mascotWin.getBounds();
    
    // キャラクターが現在いる物理ディスプレイを取得
    const targetDisplay = screen.getDisplayMatching(mascotBounds);
    const displayBounds = targetDisplay.workArea;
    
    // 基本位置：マスコットウィンドウの右隣、下端をマスコットウィンドウの下端に合わせる
    let targetX = mascotBounds.x + mascotBounds.width;
    let targetY = mascotBounds.y + mascotBounds.height - chatH;
    
    // 上下方向のはみ出し補正
    if (targetY + chatH > displayBounds.y + displayBounds.height) {
        targetY = displayBounds.y + displayBounds.height - chatH;
    }
    if (targetY < displayBounds.y) {
        targetY = displayBounds.y;
    }
    
    // 右端にはみ出す場合、マスコットウィンドウの左隣に表示
    if (targetX + chatW > displayBounds.x + displayBounds.width) {
        targetX = mascotBounds.x - chatW;
        targetY = mascotBounds.y + mascotBounds.height - chatH;
        
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
    // setPositionの代わりにsetBoundsを使用し、DPIスケーリングによるサイズ肥大化バグを防ぐ
    chatWindow.setBounds({
        x: targetX,
        y: targetY,
        width: chatW,
        height: chatH
    });
    chatOffsetX = targetX - mascotBounds.x;
    chatOffsetY = targetY - mascotBounds.y;
    isSyncingChatPosition = false;
}

// --- チャットウィンドウの追従移動処理 ---
export function syncChatWindowPosition() {
    const mascotWin = getMascotWindow();
    if (!mascotWin || !chatWindow || !chatWindow.isVisible()) return;

    const configData = appConfig.get();
    const chatW = configData.chatWidth ?? 350;
    const chatH = configData.chatHeight ?? 400;

    isSyncingChatPosition = true;
    const [mascotX, mascotY] = mascotWin.getPosition();
    // setPositionの代わりにsetBoundsを使用し、サイズを強制維持
    chatWindow.setBounds({
        x: Math.round(mascotX + chatOffsetX),
        y: Math.round(mascotY + chatOffsetY),
        width: chatW,
        height: chatH
    });
    isSyncingChatPosition = false;
}

export function createChatWindow(initialX: number, initialY: number, mascotWidth: number): BrowserWindow {
    if (chatWindow && !chatWindow.isDestroyed()) {
        return chatWindow;
    }

    const configData = appConfig.get();
    const chatW = configData.chatWidth ?? 350;
    const chatH = configData.chatHeight ?? 400;
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
            preload: path.join(__dirname, 'preload.cjs'),
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
        // chatWindow.webContents.openDevTools();
    } else {
        const port = process.env.PORT || '3000';
        chatWindow.loadURL(`http://localhost:${port}/#chat`);
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
