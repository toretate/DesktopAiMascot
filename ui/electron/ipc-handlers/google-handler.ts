import { ipcMain } from 'electron';
import { AiExpressionService } from '../../src/skills/expression-service/expression-service';

export function registerGoogleHandlers() {
    // 5. Gemini APIによる対話処理のハンドラー
    ipcMain.handle('ask-gemini', async (event, message: string, apiKey: string, systemPrompt: string, modelName: string, history?: any[], attachments?: any[]) => {
        const model = modelName || 'gemini-3.1-flash-lite';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

        try {
            console.log('=== Google AI Studio 送信開始 ===');
            console.log(`[GoogleAiStudio] 使用モデル: ${model}`);

            // 履歴のマッピング
            const contents = (history || []).map((msg: any) => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));
            
            // 今回のメッセージと添付ファイルの構築
            const parts: any[] = [{ text: message || '' }];
            if (attachments && attachments.length > 0) {
                for (const att of attachments) {
                    if (att.type === 'image' && att.url.startsWith('data:')) {
                        const match = att.url.match(/^data:(image\/\w+);base64,(.+)$/);
                        if (match) {
                            parts.push({
                                inlineData: {
                                    mimeType: match[1],
                                    data: match[2]
                                }
                            });
                        }
                    }
                }
            }

            // 最後に今回のメッセージを追加
            contents.push({
                role: 'user',
                parts: parts
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: contents,
                    systemInstruction: {
                        parts: [{ text: systemPrompt || 'You are a helpful assistant.' }]
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} ${errorText}`);
            }

            const data: any = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            console.log(`[GoogleAiStudio] レスポンス内容取得成功`);
            console.log('=== Google AI Studio 送信完了 ===');
            return text || 'Error: 空の返答を受信しました。';

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('Google AI Studioとの接続エラー (タイムアウト)');
                return 'Error: Google AI Studioとの接続がタイムアウトしました。';
            } else {
                console.warn('Google AI Studioとの接続エラー:', error.message);
                return `Error: Google AI Studioとの接続に失敗しました`;
            }
        }
    });

    // 5-3. Get available Imagen models from Google AI Studio
    ipcMain.handle('get-imagen-models', async (event, apiKey: string) => {
        return await AiExpressionService.getImagenModels(apiKey);
    });

    // 5-4. Get available chat models from Google AI Studio
    ipcMain.handle('get-gemini-models', async (event, apiKey: string) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            console.log(`[GoogleAiStudio] Starting to fetch chat models`);
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data: any = await response.json();
            const models = (data.models || [])
                .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m: any) => m.name.replace('models/', ''));

            console.log(`[GoogleAiStudio] Successfully fetched ${models.length} chat models`);
            return { success: true, models };
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('Google AI Studioとの接続確認エラー (タイムアウト)');
                return { success: false, models: [], error: '接続がタイムアウトしました。' };
            } else {
                console.warn('Google AI Studioとの接続確認エラー:', error.message);
                return { success: false, models: [], error: '接続に失敗しました。' };
            }
        }
    });

    // 5-2. Gemini Visionによるスプライトシート解析（表情切り出し支援）
    ipcMain.handle('analyze-sprite-sheet', async (event, base64Image: string, apiKey: string) => {
        return await AiExpressionService.analyzeSpriteSheet(base64Image, apiKey);
    });
}
