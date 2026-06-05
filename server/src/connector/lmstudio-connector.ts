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

export class LmStudioConnector {
    public static async generateResponse(params: {
        message: string;
        systemPrompt: string;
        model: string;
        endpoint: string;
        history?: any[];
        attachments?: any[];
    }): Promise<string> {
        const { message, systemPrompt, model, endpoint, history, attachments } = params;
        const sdkEndpoint = getSdkEndpoint(endpoint);
        const targetModel = model || 'unspecified';

        console.log(`[LmStudioConnector] Routing to LM Studio SDK: ${sdkEndpoint} (Model: ${targetModel})`);

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
    }
}
