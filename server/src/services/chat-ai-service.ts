import { LmStudioConnector } from '../connector/lmstudio-connector';

export class ChatAiService {
    /**
     * AIエンジンにメッセージを送信し、応答テキストを取得します。
     * @returns 応答テキスト
     */
    public static async generateResponse(params: {
        message: string;
        apiKey: string;
        systemPrompt: string;
        model: string;
        engine: string;
        lmstudioEndpoint: string;
        history?: any[];
        attachments?: any[];
        tools?: any;
    }): Promise<string> {
        const { message, apiKey, systemPrompt, model, engine, lmstudioEndpoint, history, attachments, tools } = params;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const currentEngine = engine || 'gemini';
            if (currentEngine === 'lmstudio') {
                return await LmStudioConnector.generateResponse({
                    message,
                    systemPrompt,
                    model,
                    endpoint: lmstudioEndpoint,
                    history,
                    attachments,
                    tools
                });
            } else {
                const targetModel = model || 'gemini-1.5-flash';
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

                console.log(`[ChatAiService] Routing to Gemini: ${geminiUrl} (Model: ${targetModel})`);

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

                const response = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: contents,
                        systemInstruction: { parts: [{ text: systemPrompt || 'You are a helpful assistant.' }] }
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Gemini API Error: ${response.status} ${errorText}`);
                }

                const resJson: any = await response.json();
                return resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
        } catch (aiError: any) {
            clearTimeout(timeoutId);
            if (aiError.name === 'AbortError') {
                console.warn(`[ChatAiService] ${engine || 'Gemini'}との接続エラー (タイムアウト/タスクキャンセル)`);
            } else if (aiError.name === 'TypeError' || aiError.code === 'ECONNREFUSED') {
                console.warn(`[ChatAiService] ${engine || 'Gemini'}との接続エラー (接続失敗/ネットワークエラー)`);
            } else {
                console.warn(`[ChatAiService] ${engine || 'Gemini'}との接続エラー:`, aiError.message);
            }
            throw aiError;
        }
    }
}
