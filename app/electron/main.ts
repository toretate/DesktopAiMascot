import { app, BrowserWindow, ipcMain, screen, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ForgeConnector } from '../src/connector/forge-connector';
import { AiExpressionService } from '../src/skills/expression-service/expression-service';
import { alignExpression, detectBaseFace } from '../src/server/utils/expression-edit-service';
import { registerSelectLocalImageHandler } from './ipc-handlers/select-local-image-handler';
import { registerLmStudioHandlers } from './ipc-handlers/lmstudio-handler';
import { registerVoicevoxHandlers } from './ipc-handlers/voicevox-handler';
import { registerIrodoriHandlers } from './ipc-handlers/irodori-handler';
import { registerGoogleHandlers } from './ipc-handlers/google-handler';
import { registerHeartbeatHandlers } from './ipc-handlers/heartbeat-handler';
import { registerHistoryHandlers } from './ipc-handlers/history-handler';
import { registerLifecycleHandlers } from './ipc-handlers/lifecycle-handler';
import { registerAuthHandlers } from './ipc-handlers/auth-handler';
import { registerScheduleHandlers } from './ipc-handlers/schedule-handler';
import { registerConfigHandlers } from './ipc-handlers/config-handler';
import { registerWindowHandlers } from './ipc-handlers/window-handler';
import { initSettingsWindow, getSettingsWindow, createSettingsWindow, openSettingsWindow } from './window/settings-window';
import { initMascotWindow, getMascotWindow, createMascotWindow, debouncedSaveMascotPosition } from './window/mascot-window';
import { initChatWindow, getChatWindow, createChatWindow, syncChatWindowPosition, adjustChatWindowPosition, getEffectiveChatAlwaysOnTop, setChatOffsets, getChatOffsets } from './window/chat-window';
import { initIntegratedWindow, createIntegratedWindow, getIntegratedWindow } from './window/integrated-window';
import { initCompactWindow, createCompactWindow, getCompactWindow } from './window/compact-window';
import { initTasksWindow, toggleTasksWindow } from './window/task-window';
import { AppConfig, ConfigData } from './app-config';

// AiExpressionService にプラットフォーム依存モジュールを注入
AiExpressionService.setAdapter({
    readFileSync: (p: string) => fs.readFileSync(p) as any,
    existsSync: (p: string) => fs.existsSync(p),
    pathJoin: (...args: string[]) => path.join(...args),
    pathExtname: (p: string) => path.extname(p),
    cwd: () => {
        const currentCwd = process.cwd();
        const base = path.basename(currentCwd);
        if (base === 'ui' || base === 'app') {
            return path.dirname(currentCwd);
        }
        return currentCwd;
    }
});

import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';

// 開発環境と本番環境の判定
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

// グローバルな例外ハンドラーの登録（アプリ終了時の接続リセット等を逃がす）
process.on('unhandledRejection', (reason) => {
    const reasonStr = String(reason);
    if (reasonStr.includes('ECONNRESET') || (reason && (reason as any).code === 'ECONNRESET')) {
        console.warn('[Electron] Unhandled Rejection (ECONNRESET) ignored:', reason);
    } else {
        console.error('[Electron] Unhandled Rejection:', reason);
    }
});

process.on('uncaughtException', (error) => {
    if (error && error.code === 'ECONNRESET') {
        console.warn('[Electron] Uncaught Exception (ECONNRESET) ignored:', error.message);
    } else {
        console.error('[Electron] Uncaught Exception:', error);
    }
});


// --- グローバル変数 ---
let config: AppConfig;
let serverProcess: ChildProcess | null = null;
let serverPort = 3000;

async function findFreePort(startPort: number): Promise<number> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const address = server.address();
            const port = typeof address === 'string' ? startPort : address?.port || startPort;
            server.close(() => {
                resolve(port);
            });
        });
        server.on('error', () => {
            resolve(findFreePort(startPort + 1));
        });
    });
}

function startNitroServer() {
    if (isDev) {
        console.log('[Electron] Running in dev mode, relying on external Nuxt dev server.');
        return;
    }

    let serverScriptPath = path.join(app.getAppPath(), '.output/server/index.mjs');
    const unpackedPath = serverScriptPath.replace('app.asar', 'app.asar.unpacked');
    if (fs.existsSync(unpackedPath)) {
        serverScriptPath = unpackedPath;
    } else {
        const extraPath = path.join(process.resourcesPath, '.output/server/index.mjs');
        if (fs.existsSync(extraPath)) {
            serverScriptPath = extraPath;
        }
    }

    console.log(`[Electron] Starting Nitro server at: ${serverScriptPath} on port ${serverPort}`);

    if (!fs.existsSync(serverScriptPath)) {
        console.error(`[Electron] Nitro server script not found! Path: ${serverScriptPath}`);
        dialog.showErrorBox('サーバーエラー', `起動用サーバースクリプトが見つかりませんでした。\nパス: ${serverScriptPath}`);
        return;
    }

    serverProcess = spawn(process.execPath, [serverScriptPath], {
        env: {
            ...process.env,
            PORT: String(serverPort),
            NODE_ENV: 'production',
            ELECTRON_RUN_AS_NODE: '1'
        },
        stdio: 'inherit'
    });

    serverProcess.on('error', (err) => {
        console.error('[Electron] Failed to start Nitro server:', err);
    });

    serverProcess.on('exit', (code, signal) => {
        console.log(`[Electron] Nitro server exited with code ${code} and signal ${signal}`);
    });
}

function stopNitroServer() {
    if (serverProcess) {
        console.log('[Electron] Killing Nitro server process...');
        serverProcess.kill('SIGTERM');
        serverProcess = null;
    }
}

// --- ウィンドウ群の初期化 ---
function createWindows() {
    config = new AppConfig();
    initSettingsWindow(config, isDev);
    initMascotWindow(config, isDev);
    initChatWindow(config, isDev);
    initIntegratedWindow(config, isDev);
    initCompactWindow(config, isDev);
    initTasksWindow(config, isDev);
    const configData = config.get();

    // 開発用：設定画面のみ直接起動するモードの処理
    if (process.env.START_SETTINGS === 'true') {
        const win = createSettingsWindow();
        win.show();
        win.on('closed', () => {
            app.quit();
        });
        return;
    }

    const mode = configData.windowMode || 'split';

    if (mode === 'integrated') {
        createIntegratedWindow();
    } else if (mode === 'compact') {
        createCompactWindow();
    } else {
        // 1. マスコットウィンドウの作成
        const mascotWin = createMascotWindow(syncChatWindowPosition);
        const mascotBounds = mascotWin.getBounds();

        // チャット追従オフセットのスケール適用
        setChatOffsets(mascotBounds.width, 0);

        const initialX = mascotBounds.x;
        const initialY = mascotBounds.y;

        // 2. チャットウィンドウの作成
        const chatWin = createChatWindow(initialX, initialY, mascotBounds.width);

        // 初期化完了時、チャットウィンドウの初期表示状態を適用
        mascotWin.once('ready-to-show', () => {
            if (configData.chatVisible) {
                chatWin?.showInactive(); // フォーカスを奪わずに表示
                adjustChatWindowPosition();
            }
        });
    }

    // 3. 設定ウィンドウの作成（透過なし・通常ウィンドウ）
    createSettingsWindow();
}

// --- IPCハンドラーの実装 ---
app.whenReady().then(async () => {
    // 開発時以外は空きポートを探して Nitro サーバを起動
    if (!isDev) {
        serverPort = await findFreePort(3000);
        process.env.PORT = String(serverPort);
        startNitroServer();
        // サーバーの起動待機（1.5秒）
        await new Promise((resolve) => setTimeout(resolve, 1500));
    } else {
        process.env.PORT = '3000';
    }

    createWindows();
    registerSelectLocalImageHandler();
    registerLmStudioHandlers();
    registerVoicevoxHandlers(config);
    registerIrodoriHandlers(config);
    registerGoogleHandlers();
    registerHeartbeatHandlers();
    registerHistoryHandlers();
    registerLifecycleHandlers();
    registerAuthHandlers(() => config.get());
    registerScheduleHandlers();
    registerConfigHandlers(config);
    registerWindowHandlers(config);

    // 感情変更のマルチウィンドウ中継ハンドラー
    ipcMain.on('emotion-changed', (event, emotion: string) => {
        const mascotWin = getMascotWindow();
        if (mascotWin && !mascotWin.isDestroyed()) {
            mascotWin.webContents.send('emotion-changed', emotion);
        }
        const integratedWin = getIntegratedWindow();
        if (integratedWin && !integratedWin.isDestroyed()) {
            integratedWin.webContents.send('emotion-changed', emotion);
        }
        const compactWin = getCompactWindow();
        if (compactWin && !compactWin.isDestroyed()) {
            compactWin.webContents.send('emotion-changed', emotion);
        }
        console.log(`[IPC] Emotion broadcasted: ${emotion}`);
    });

    // タスクウィンドウの表示・非表示切り替え
    ipcMain.on('toggle-tasks-window', () => {
        toggleTasksWindow();
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

    ipcMain.handle('align-expression', async (event, basePath: string, expressionPath: string, detectMode?: string) => {
        return await alignExpression(basePath, expressionPath, detectMode);
    });

    ipcMain.handle('detect-base-face', async (event, imagePath: string, detectMode?: string) => {
        return await detectBaseFace(imagePath, detectMode);
    });

    // Forge (Stable Diffusion) 関連の IPC ハンドラー
    ipcMain.handle('forge:health', async (event, host: string) => {
        return await ForgeConnector.health(host);
    });
    ipcMain.handle('forge:models', async (event, host: string) => {
        return await ForgeConnector.models(host);
    });
    ipcMain.handle('forge:loras', async (event, host: string) => {
        return await ForgeConnector.loras(host);
    });
    ipcMain.handle('forge:generate', async (event, params: any, host: string) => {
        const appConfig = config?.get();
        const debugLog = appConfig ? !!appConfig.forgeDebugLog : false;
        return await ForgeConnector.generateImage(params, host, debugLog);
    });





    // 10. エディタからのリアルタイムプレビュー通知（保存前の状態を反映）
    ipcMain.on('preview-mascot-state', (event, previewState: any) => {
        const mascotWin = getMascotWindow();
        if (mascotWin && !mascotWin.isDestroyed()) {
            mascotWin.webContents.send('apply-preview-state', previewState);
        }
        const integratedWin = getIntegratedWindow();
        if (integratedWin && !integratedWin.isDestroyed()) {
            integratedWin.webContents.send('apply-preview-state', previewState);
        }
        const compactWin = getCompactWindow();
        if (compactWin && !compactWin.isDestroyed()) {
            compactWin.webContents.send('apply-preview-state', previewState);
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindows();
        }
    });
});

app.on('window-all-closed', () => {
    stopNitroServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    stopNitroServer();
});
