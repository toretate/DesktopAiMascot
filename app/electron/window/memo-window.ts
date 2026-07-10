import { BrowserWindow, ipcMain, screen, shell } from 'electron';
import * as path from 'path';

let memoWindow: BrowserWindow | null = null;
let isDragging = false;

export function initMemoWindow() {
    // Already initialized
    if (memoWindow) return;

    memoWindow = new BrowserWindow({
        width: 340,
        height: 480,
        x: screen.getPrimaryDisplay().workAreaSize.width - 340 - 20, // Right side
        y: 80,
        type: 'toolbar', // to avoid focusing and taking away focus from other apps on some OS
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true, // We will handle custom resizing if needed
        show: false, // Initially hidden
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
        },
        skipTaskbar: true, // Do not show in taskbar
    });

    memoWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    
    // ignore mouse events when transparent
    // Wait for the window to be ready before doing anything
    memoWindow.once('ready-to-show', () => {
        // do not show automatically
    });

    const isDev = process.env.NODE_ENV !== 'production';

    // Load the memo view from Vite dev server or local Nitro server
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        memoWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#memo`);
    } else {
        const port = process.env.PORT || '3000';
        memoWindow.loadURL(`http://localhost:${port}/#memo`);
    }

    // external link support
    memoWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    memoWindow.on('closed', () => {
        memoWindow = null;
    });

    // Custom drag logic specifically for memo window (if needed)
    ipcMain.on('memo-drag-window', (event, { dx, dy, isStart, isEnd }) => {
        if (!memoWindow) return;
        if (isStart) {
            isDragging = true;
        } else if (isEnd) {
            isDragging = false;
        } else if (isDragging) {
            const [x, y] = memoWindow.getPosition();
            memoWindow.setPosition(x + dx, y + dy);
        }
    });
}

export function toggleMemoWindow() {
    if (!memoWindow) {
        initMemoWindow();
    }
    
    if (memoWindow) {
        if (memoWindow.isVisible()) {
            memoWindow.hide();
        } else {
            memoWindow.show();
            // In Windows, show() might not focus it or bring it to top properly sometimes
            memoWindow.focus();
        }
    }
}

export function showMemoWindow() {
    if (!memoWindow) {
        initMemoWindow();
    }
    if (memoWindow && !memoWindow.isVisible()) {
        memoWindow.show();
    }
}

export function hideMemoWindow() {
    if (memoWindow && memoWindow.isVisible()) {
        memoWindow.hide();
    }
}

export function destroyMemoWindow() {
    if (memoWindow) {
        memoWindow.close();
        memoWindow = null;
    }
}

// IPC handler will be registered in main.ts
