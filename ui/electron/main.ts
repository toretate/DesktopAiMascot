import { app, BrowserWindow, ipcMain, screen, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AiExpressionService } from '../src/skills/expression-service/expression-service';
import { registerSelectLocalImageHandler } from './ipc-handlers/select-local-image-handler';
import { registerLmStudioHandlers } from './ipc-handlers/lmstudio-handler';
import { registerVoicevoxHandlers } from './ipc-handlers/voicevox-handler';
import { registerGoogleHandlers } from './ipc-handlers/google-handler';
import { registerHeartbeatHandlers } from './ipc-handlers/heartbeat-handler';
import { registerHistoryHandlers } from './ipc-handlers/history-handler';
import { registerLifecycleHandlers } from './ipc-handlers/lifecycle-handler';
import { registerAuthHandlers } from './ipc-handlers/auth-handler';
import { registerScheduleHandlers } from './ipc-handlers/schedule-handler';
import { registerConfigHandlers } from './ipc-handlers/config-handler';
import { registerWindowHandlers } from './ipc-handlers/window-handler';
import { initSettingsWindow, getSettingsWindow, createSettingsWindow, openSettingsWindow } from './settings-window';
import { initMascotWindow, getMascotWindow, createMascotWindow, debouncedSaveMascotPosition } from './mascot-window';
import { initChatWindow, getChatWindow, createChatWindow, syncChatWindowPosition, adjustChatWindowPosition, getEffectiveChatAlwaysOnTop, setChatOffsets, getChatOffsets } from './chat-window';
import { AppConfig, ConfigData } from './app-config';

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


// --- グローバル変数 ---
let config: AppConfig;

// --- ウィンドウ群の初期化 ---
function createWindows() {
    config = new AppConfig();
    initSettingsWindow(config, isDev);
    initMascotWindow(config, isDev);
    initChatWindow(config, isDev);
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

    // 1. マスコットウィンドウの作成
    const mascotWin = createMascotWindow(syncChatWindowPosition);
    const mascotBounds = mascotWin.getBounds();

    // チャット追従オフセットのスケール適用
    setChatOffsets(mascotBounds.width, 0);

    const initialX = mascotBounds.x;
    const initialY = mascotBounds.y;

    // 2. チャットウィンドウの作成
    const chatWin = createChatWindow(initialX, initialY, mascotBounds.width);

    // 3. 設定ウィンドウの作成（透過なし・通常ウィンドウ）
    createSettingsWindow();

    // 初期化完了時、チャットウィンドウの初期表示状態を適用
    mascotWin.once('ready-to-show', () => {
        if (configData.chatVisible) {
            chatWin?.showInactive(); // フォーカスを奪わずに表示
            adjustChatWindowPosition();
        }
    });
}

// --- IPCハンドラーの実装 ---
app.whenReady().then(() => {
    createWindows();
    registerSelectLocalImageHandler();
    registerLmStudioHandlers();
    registerVoicevoxHandlers();
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
        if (mascotWin) {
            mascotWin.webContents.send('emotion-changed', emotion);
            console.log(`[IPC] Emotion broadcasted to MascotWindow: ${emotion}`);
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





    // 10. エディタからのリアルタイムプレビュー通知（保存前の状態を反映）
    ipcMain.on('preview-mascot-state', (event, previewState: any) => {
        const mascotWin = getMascotWindow();
        if (mascotWin && !mascotWin.isDestroyed()) {
            mascotWin.webContents.send('apply-preview-state', previewState);
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
