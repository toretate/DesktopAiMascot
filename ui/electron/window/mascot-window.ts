import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

let mascotWindow: BrowserWindow | null = null;
let savePositionTimeout: NodeJS.Timeout | null = null;

let appConfig: any = null;
let isDevMode = false;

export function initMascotWindow(config: any, isDev: boolean) {
    appConfig = config;
    isDevMode = isDev;
}

export function getMascotWindow(): BrowserWindow | null {
    return mascotWindow;
}

export function debouncedSaveMascotPosition() {
    if (!mascotWindow) return;
    if (savePositionTimeout) clearTimeout(savePositionTimeout);

    savePositionTimeout = setTimeout(() => {
        if (!mascotWindow || mascotWindow.isDestroyed()) return;
        const [x, y] = mascotWindow.getPosition();
        appConfig.update({ mascotX: x, mascotY: y });
        console.log(`[Config] Mascot position saved: X=${x}, Y=${y}`);
    }, 1000); // 1秒間静止した後に保存
}

export function createMascotWindow(onMove?: () => void): BrowserWindow {
    if (mascotWindow && !mascotWindow.isDestroyed()) {
        return mascotWindow;
    }

    const configData = appConfig.get();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const defaultMascotW = 600;
    const defaultMascotH = 800;
    const scale = configData.mascotScale || 1.0;
    const mascotW = Math.round(defaultMascotW * scale);
    const mascotH = Math.round(defaultMascotH * scale);

    let initialX = configData.mascotX;
    let initialY = configData.mascotY;

    if (initialX === -1 || initialY === -1) {
        initialX = screenWidth - mascotW - 100;
        initialY = screenHeight - mascotH - 100;
        appConfig.update({ mascotX: initialX, mascotY: initialY });
    }

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

    if (configData.alwaysOnTop) {
        mascotWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    if (isDevMode) {
        const devUrl = process.env.VITE_DEV_SERVER_URL!;
        mascotWindow.loadURL(`${devUrl}#mascot`);
    } else {
        const htmlPath = path.join(__dirname, '../dist/index.html');
        mascotWindow.loadFile(htmlPath, { hash: 'mascot' });
    }

    mascotWindow.on('move', () => {
        if (onMove) onMove();
        debouncedSaveMascotPosition();
    });

    return mascotWindow;
}
