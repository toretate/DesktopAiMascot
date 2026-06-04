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
    }): Promise<string> {
        const { message, apiKey, systemPrompt, model, engine, lmstudioEndpoint, history } = params;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const currentEngine = engine || 'gemini';
            if (currentEngine === 'lmstudio') {
                const defaultEndpoint = 'http://127.0.0.1:1234/v1/';
                const apiBase = lmstudioEndpoint || defaultEndpoint;
                const url = apiBase.endsWith('/') ? `${apiBase}chat/completions` : `${apiBase}/chat/completions`;
                const targetModel = model || 'unspecified';

                console.log(`[ChatAiService] Routing to LM Studio: ${url} (Model: ${targetModel})`);

                const rawPayload: any[] = [];
                if (history && history.length > 0) {
                    history.forEach((msg: any) => {
                        const text = msg.text || '';
                        if (text.trim()) {
                            rawPayload.push({
                                role: msg.sender === 'user' ? 'user' : 'assistant',
                                content: text
                            });
                        }
                    });
                }
                rawPayload.push({ role: 'user', content: message || 'こんにちは' });

                // 同一ロールの連続を結合する
                const mergedPayload: any[] = [];
                rawPayload.forEach((msg) => {
                    if (mergedPayload.length === 0) {
                        mergedPayload.push(msg);
                    } else {
                        const last = mergedPayload[mergedPayload.length - 1];
                        if (last.role === msg.role) {
                            last.content = `${last.content}\n${msg.content}`;
                        } else {
                            mergedPayload.push(msg);
                        }
                    }
                });

                // 最初のメッセージが assistant の場合は除外する（Jinjaテンプレートのパースエラー対策）
                while (mergedPayload.length > 0 && mergedPayload[0].role === 'assistant') {
                    mergedPayload.shift();
                }

                const messagesPayload: any[] = [];
                if (systemPrompt && systemPrompt.trim()) {
                    messagesPayload.push({ role: 'system', content: systemPrompt });
                }
                messagesPayload.push(...mergedPayload);

                console.log(`[ChatAiService] Sending messages to LM Studio:`, JSON.stringify(messagesPayload, null, 2));

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: targetModel,
                        messages: messagesPayload
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`LM Studio Error: ${response.status} ${errorText}`);
                }

                const resJson: any = await response.json();
                const rawContent = resJson.choices?.[0]?.message?.content || '';
                
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
                // 最後に今回のメッセージを追加
                contents.push({
                    role: 'user',
                    parts: [{ text: message }]
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
