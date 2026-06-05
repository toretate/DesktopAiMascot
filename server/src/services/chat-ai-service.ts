import { LMStudioClient } from '@lmstudio/sdk';

// HTTPエンドポイントをLM Studio SDK用のWebSocket形式に変換するヘルパー
function getSdkEndpoint(httpEndpoint: string): string {
    let wsEndpoint = (httpEndpoint || '').trim();
    if (!wsEndpoint) {
        return 'ws://127.0.0.1:1234';
    }
    if (wsEndpoint.startsWith('http://')) {
        wsEndpoint = wsEndpoint.replace('http://', 'ws://');
    } else if (wsEndpoint.startsWith('https://')) {
        wsEndpoint = wsEndpoint.replace('https://', 'wss://');
    } else if (!wsEndpoint.startsWith('ws://') && !wsEndpoint.startsWith('wss://')) {
        wsEndpoint = 'ws://' + wsEndpoint;
    }
    wsEndpoint = wsEndpoint.replace(/\/v1\/?$/, '');
    wsEndpoint = wsEndpoint.replace(/\/api\/v1(\/models)?\/?$/, '');
    if (wsEndpoint.endsWith('/')) {
        wsEndpoint = wsEndpoint.slice(0, -1);
    }
    return wsEndpoint;
}

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
    }): Promise<string> {
        const { message, apiKey, systemPrompt, model, engine, lmstudioEndpoint, history, attachments } = params;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const currentEngine = engine || 'gemini';
            if (currentEngine === 'lmstudio') {
                const sdkEndpoint = getSdkEndpoint(lmstudioEndpoint);
                const targetModel = model || 'unspecified';

                console.log(`[ChatAiService] Routing to LM Studio SDK: ${sdkEndpoint} (Model: ${targetModel})`);

                const client = new LMStudioClient({ baseUrl: sdkEndpoint });
                const llm = await client.llm.model(targetModel);

                const messagesPayload: any[] = [];
                if (systemPrompt && systemPrompt.trim()) {
                    messagesPayload.push({ role: 'system', content: systemPrompt });
                }

                if (history && history.length > 0) {
                    history.forEach((msg: any) => {
                        const text = msg.text || '';
                        if (text.trim()) {
                            messagesPayload.push({
                                role: msg.sender === 'user' ? 'user' : 'assistant',
                                content: text
                            });
                        }
                    });
                }

                // 今回のメッセージ（画像添付ありを考慮）
                const userContent: any[] = [{ type: 'text', text: message || '' }];
                if (attachments && attachments.length > 0) {
                    for (const att of attachments) {
                        if (att.type === 'image' && att.url.startsWith('data:')) {
                            const match = att.url.match(/^data:(image\/\w+);base64,(.+)$/);
                            if (match) {
                                userContent.push({
                                    type: 'image',
                                    image: {
                                        base64: match[2]
                                    }
                                });
                            }
                        }
                    }
                }

                messagesPayload.push({
                    role: 'user',
                    content: userContent.length > 1 ? userContent : (message || 'こんにちは')
                });

                const response = await llm.respond(messagesPayload);
                const rawContent = response.content || '';
                
                // 思考プロセス（Thinking Process や <thought> タグ）のクレンジング
                let cleanedContent = rawContent
                    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
                    .replace(/<thought>[\s\S]*/gi, '')
                    .replace(/^Thinking Process:[\s\S]*?(?=\n\n\S|$)/i, '')
                    .replace(/\nThinking Process:[\s\S]*?(?=\n\n\S|$)/g, '');
                
                return cleanedContent.trim();
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
