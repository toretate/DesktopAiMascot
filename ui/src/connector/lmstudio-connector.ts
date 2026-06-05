import { LMStudioClient } from '@lmstudio/sdk';

// HTTPエンドポイントをLM Studio SDK用のWebSocket/TCP形式に変換するヘルパー
export function getSdkEndpoint(httpEndpoint: string): string {
    let wsEndpoint = (httpEndpoint || '').trim();
    if (!wsEndpoint) {
        return 'ws://127.0.0.1:1234';
    }
    // http(s):// を ws(s):// に変換
    if (wsEndpoint.startsWith('http://')) {
        wsEndpoint = wsEndpoint.replace('http://', 'ws://');
    } else if (wsEndpoint.startsWith('https://')) {
        wsEndpoint = wsEndpoint.replace('https://', 'wss://');
    } else if (!wsEndpoint.startsWith('ws://') && !wsEndpoint.startsWith('wss://')) {
        wsEndpoint = 'ws://' + wsEndpoint;
    }
    // 末尾の /v1 や /v1/ などを除去
    wsEndpoint = wsEndpoint.replace(/\/v1\/?$/, '');
    // 末尾の /api/v1/models などの独自パスがある場合も除去
    wsEndpoint = wsEndpoint.replace(/\/api\/v1(\/models)?\/?$/, '');
    // 末尾の / を除去
    if (wsEndpoint.endsWith('/')) {
        wsEndpoint = wsEndpoint.slice(0, -1);
    }
    return wsEndpoint;
}

export class LmStudioConnector {
    public static async generateResponse(params: {
        message: string;
        systemPrompt: string;
        model: string;
        endpoint: string;
        history?: any[];
        attachments?: any[];
    }): Promise<string> {
        const { message, systemPrompt, model: modelName, endpoint, history, attachments } = params;
        const sdkEndpoint = getSdkEndpoint(endpoint);
        const model = modelName || 'unspecified';

        console.log('=== LmStudio SDK 送信開始 ===');
        console.log(`[LmStudio] SDK エンドポイント: ${sdkEndpoint}`);
        console.log(`[LmStudio] 使用モデル: ${model}`);
        console.log(`[LmStudio] 送信メッセージ: ${message}`);

        const client = new LMStudioClient({ baseUrl: sdkEndpoint });
        const llm = await client.llm.model(model);

        // 履歴のマッピング
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

        // 思考プロセス（Thinking Process や <thought> タグ、<|channel>thought タグなど）のクレンジング
        const cleanedContent = rawContent
            .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
            .replace(/<thought>[\s\S]*/gi, '')
            .replace(/<\|channel>thought[\s\S]*?<channel\|>/gi, '')
            .replace(/<\|channel>thought[\s\S]*/gi, '')
            .replace(/^Thinking Process:[\s\S]*?(?=\n\n\S|$)/i, '')
            .replace(/\nThinking Process:[\s\S]*?(?=\n\n\S|$)/g, '');

        const text = cleanedContent.trim();

        console.log(`[LmStudio] レスポンス内容: ${text}`);
        console.log('=== LmStudio SDK 送信完了 ===');
        return text || 'Error: 空の返答を受信しました。';
    }

    public static async getModels(endpoint: string): Promise<{ success: boolean; models: any[]; error?: string }> {
        const sdkEndpoint = getSdkEndpoint(endpoint);

        try {
            console.log(`[LmStudio] SDK 疎通確認・モデル一覧取得開始: ${sdkEndpoint}`);
            const client = new LMStudioClient({ baseUrl: sdkEndpoint });
            const loaded = await client.llm.listLoaded();

            const models = loaded.map((m: any) => ({
                id: m.id || m.key || m.path || '',
                capabilities: {
                    vision: m.capabilities?.vision ?? false,
                    trained_for_tool_use: m.capabilities?.trainedForToolUse ?? false,
                    reasoning: m.capabilities?.reasoning ?? false
                }
            }));
            
            console.log(`[LmStudio] 疎通成功。取得モデル数: ${models.length}`);
            return { success: true, models };
        } catch (error: any) {
            console.error('[LmStudio] SDK 疎通エラー:', error);
            return { success: false, models: [], error: `LM Studioへの接続に失敗しました。(${error.message})` };
        }
    }
}
