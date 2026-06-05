import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

let compactWindow: BrowserWindow | null = null;
let saveBoundsTimeout: NodeJS.Timeout | null = null;

let appConfig: any = null;
let isDevMode = false;

export function initCompactWindow(config: any, isDev: boolean) {
    appConfig = config;
    isDevMode = isDev;
}

export function getCompactWindow(): BrowserWindow | null {
    return compactWindow;
}

function debouncedSaveCompactBounds() {
    if (!compactWindow) return;
    if (saveBoundsTimeout) clearTimeout(saveBoundsTimeout);

    saveBoundsTimeout = setTimeout(() => {
        if (!compactWindow || compactWindow.isDestroyed()) return;
        const [w, h] = compactWindow.getSize();
        const [x, y] = compactWindow.getPosition();
        appConfig.update({
            compactWidth: w,
            compactHeight: h,
            compactX: x,
            compactY: y
        });
        console.log(`[Config] Compact window bounds saved: X=${x}, Y=${y}, W=${w}, H=${h}`);
    }, 1000);
}

export function createCompactWindow(): BrowserWindow {
    if (compactWindow && !compactWindow.isDestroyed()) {
        return compactWindow;
    }

    const configData = appConfig.get();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const defaultW = 420;
    const defaultH = 800;
    const savedW = configData.compactWidth || defaultW;
    const savedH = configData.compactHeight || defaultH;

    let initialX = configData.compactX;
    let initialY = configData.compactY;

    if (initialX === undefined || initialY === undefined || initialX === -1 || initialY === -1) {
        initialX = screenWidth - savedW - 100;
        initialY = Math.round((screenHeight - savedH) / 2);
    }

    compactWindow = new BrowserWindow({
        width: savedW,
        height: savedH,
        x: initialX,
        y: initialY,
        minWidth: 350,
        minHeight: 500,
        transparent: false,
        frame: true,
        alwaysOnTop: configData.alwaysOnTop,
        resizable: true,
        title: 'Desktop AI Mascot - コンパクトモード',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (configData.alwaysOnTop) {
        compactWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    if (isDevMode) {
        const devUrl = process.env.VITE_DEV_SERVER_URL!;
        compactWindow.loadURL(`${devUrl}#compact`);
    } else {
        const htmlPath = path.join(__dirname, '../dist/index.html');
        compactWindow.loadFile(htmlPath, { hash: 'compact' });
    }

    compactWindow.on('resize', () => {
        debouncedSaveCompactBounds();
    });

    compactWindow.on('move', () => {
        debouncedSaveCompactBounds();
    });

    compactWindow.on('closed', () => {
        compactWindow = null;
    });

    return compactWindow;
}
