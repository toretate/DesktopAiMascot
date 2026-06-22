import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let settingsWindow: BrowserWindow | null = null;
let saveSettingsBoundsTimeout: NodeJS.Timeout | null = null;

let appConfig: any = null;
let isDevMode = false;

export function initSettingsWindow(config: any, isDev: boolean) {
    appConfig = config;
    isDevMode = isDev;

    // 設定画面を開くIPCイベントのハンドリング
    ipcMain.on('open-settings', () => {
        openSettingsWindow();
    });
}

export function getSettingsWindow(): BrowserWindow | null {
    return settingsWindow;
}

function debouncedSaveSettingsBounds() {
    if (!settingsWindow) return;
    if (saveSettingsBoundsTimeout) clearTimeout(saveSettingsBoundsTimeout);

    saveSettingsBoundsTimeout = setTimeout(() => {
        if (!settingsWindow || settingsWindow.isDestroyed()) return;
        const [w, h] = settingsWindow.getSize();
        const [x, y] = settingsWindow.getPosition();
        appConfig.update({ settingsWidth: w, settingsHeight: h, settingsX: x, settingsY: y });
        console.log(`[Config] Settings bounds saved: X=${x}, Y=${y}, width=${w}, height=${h}`);
    }, 1000); // 1秒間操作が静止した後に保存
}

export function createSettingsWindow(): BrowserWindow {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        return settingsWindow;
    }

    const configData = appConfig.get();

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
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false
        }
    };

    if (configData.settingsX !== -1 && configData.settingsY !== -1) {
        settingsOptions.x = configData.settingsX;
        settingsOptions.y = configData.settingsY;
    }

    settingsWindow = new BrowserWindow(settingsOptions);

    if (isDevMode) {
        settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL!}#settings`);
        settingsWindow.webContents.openDevTools();
    } else {
        const port = process.env.PORT || '3000';
        settingsWindow.loadURL(`http://localhost:${port}/#settings`);
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

    return settingsWindow;
}

export function openSettingsWindow() {
    if (!settingsWindow || settingsWindow.isDestroyed()) {
        createSettingsWindow();
    }
    if (settingsWindow) {
        settingsWindow.show();
        settingsWindow.focus();
        console.log('[Window] Settings Window opened');
    }
}
