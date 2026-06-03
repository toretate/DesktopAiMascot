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
    }): Promise<string> {
        const { message, apiKey, systemPrompt, model, engine, lmstudioEndpoint } = params;
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

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: targetModel,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: message }
                        ]
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`LM Studio Error: ${response.status} ${errorText}`);
                }

                const resJson: any = await response.json();
                return resJson.choices?.[0]?.message?.content || '';
            } else {
                const targetModel = model || 'gemini-1.5-flash';
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

                console.log(`[ChatAiService] Routing to Gemini: ${geminiUrl} (Model: ${targetModel})`);

                const response = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: message }] }],
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
