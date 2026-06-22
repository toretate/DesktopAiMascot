import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

let integratedWindow: BrowserWindow | null = null;
let saveBoundsTimeout: NodeJS.Timeout | null = null;

let appConfig: any = null;
let isDevMode = false;

export function initIntegratedWindow(config: any, isDev: boolean) {
    appConfig = config;
    isDevMode = isDev;
}

export function getIntegratedWindow(): BrowserWindow | null {
    return integratedWindow;
}

function debouncedSaveIntegratedBounds() {
    if (!integratedWindow) return;
    if (saveBoundsTimeout) clearTimeout(saveBoundsTimeout);

    saveBoundsTimeout = setTimeout(() => {
        if (!integratedWindow || integratedWindow.isDestroyed()) return;
        const [w, h] = integratedWindow.getSize();
        const [x, y] = integratedWindow.getPosition();
        appConfig.update({
            integratedWidth: w,
            integratedHeight: h,
            integratedX: x,
            integratedY: y
        });
        console.log(`[Config] Integrated window bounds saved: X=${x}, Y=${y}, W=${w}, H=${h}`);
    }, 1000);
}

export function createIntegratedWindow(): BrowserWindow {
    if (integratedWindow && !integratedWindow.isDestroyed()) {
        return integratedWindow;
    }

    const configData = appConfig.get();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const defaultW = 1100;
    const defaultH = 800;
    const minW = 800;
    const minH = 500;
    const savedW = Math.max(configData.integratedWidth || defaultW, minW);
    const savedH = Math.max(configData.integratedHeight || defaultH, minH);

    let initialX = configData.integratedX;
    let initialY = configData.integratedY;

    if (initialX === undefined || initialY === undefined || initialX === -1 || initialY === -1) {
        initialX = Math.round((screenWidth - savedW) / 2);
        initialY = Math.round((screenHeight - savedH) / 2);
    }

    integratedWindow = new BrowserWindow({
        width: savedW,
        height: savedH,
        x: initialX,
        y: initialY,
        minWidth: minW,
        minHeight: minH,
        show: false, // 起動時の一瞬のチラつき（自動サイズ拡張）を隠すために最初は非表示にする
        transparent: false,
        frame: true,
        alwaysOnTop: configData.alwaysOnTop,
        resizable: true,
        title: 'Desktop AI Mascot - 統合モード',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    integratedWindow.once('ready-to-show', () => {
        if (integratedWindow) {
            integratedWindow.setSize(savedW, savedH);
            integratedWindow.show();
        }
    });

    if (configData.alwaysOnTop) {
        integratedWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    if (isDevMode) {
        const devUrl = process.env.VITE_DEV_SERVER_URL!;
        integratedWindow.loadURL(`${devUrl}#integrated`);
        integratedWindow.webContents.openDevTools();
    } else {
        const port = process.env.PORT || '3000';
        integratedWindow.loadURL(`http://localhost:${port}/#integrated`);
    }

    integratedWindow.on('resize', () => {
        debouncedSaveIntegratedBounds();
    });

    integratedWindow.on('move', () => {
        debouncedSaveIntegratedBounds();
    });

    integratedWindow.on('closed', () => {
        integratedWindow = null;
    });

    return integratedWindow;
}
