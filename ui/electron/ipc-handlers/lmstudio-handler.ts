import { ipcMain } from 'electron';
import { LmStudioConnector } from '../../src/connector/lmstudio-connector';

export function registerLmStudioHandlers() {
    // 7. LM Studio (ローカル) による対話処理のハンドラー
    ipcMain.handle('ask-lmstudio', async (event, message: string, systemPrompt: string, modelName: string, endpoint: string, history?: any[], attachments?: any[]) => {
        try {
            return await LmStudioConnector.generateResponse({
                message,
                systemPrompt,
                model: modelName,
                endpoint,
                history,
                attachments
            });
        } catch (error: any) {
            console.error('[LmStudio] SDK接続・対話エラー:', error);
            return `Error: LM Studioとの接続に失敗しました。接続設定を確認してください。(${error.message})`;
        }
    });

    // 8. LM Studio (ローカル) 疎通確認およびモデル一覧取得のハンドラー
    ipcMain.handle('get-lmstudio-models', async (event, endpoint: string) => {
        return await LmStudioConnector.getModels(endpoint);
    });
}
