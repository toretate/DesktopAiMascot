import { LmStudioConnector } from '../connector/lmstudio-connector';
import { lmStudioTools } from '../skills/tool-use';

// Gemini用のツール定義マッピング
const geminiToolsMap: Record<string, any> = {
    getCurrentTime: {
        name: 'getCurrentTime',
        description: '現在のシステム時刻（日付と時間）を取得します。',
        parameters: {
            type: 'OBJECT',
            properties: {},
            required: []
        }
    },
    getGPSLocation: {
        name: 'getGPSLocation',
        description: '現在のGPS位置情報（市区町村、国、緯度、経度など）を取得します。',
        parameters: {
            type: 'OBJECT',
            properties: {},
            required: []
        }
    },
    getWeather: {
        name: 'getWeather',
        description: '指定された緯度・経度、または都市の現在の天気予報を取得します。',
        parameters: {
            type: 'OBJECT',
            properties: {
                latitude: { type: 'NUMBER', description: '緯度（例: 35.6895）' },
                longitude: { type: 'NUMBER', description: '経度（例: 139.6917）' },
                city: { type: 'STRING', description: '都市名（表示用）' }
            },
            required: ['latitude', 'longitude']
        }
    },
    adjustVolume: {
        name: 'adjustVolume',
        description: 'PCの音量を調整します。',
        parameters: {
            type: 'OBJECT',
            properties: {
                volume: { type: 'INTEGER', description: '設定する音量（0〜100の整数）' }
            },
            required: ['volume']
        }
    },
    launchApp: {
        name: 'launchApp',
        description: '指定されたアプリケーション（電卓、メモ帳など）を起動します。',
        parameters: {
            type: 'OBJECT',
            properties: {
                appName: { type: 'STRING', description: '起動するアプリケーション名またはコマンド（例: calc, notepad, cmd）' }
            },
            required: ['appName']
        }
    },
    searchWeb: {
        name: 'searchWeb',
        description: 'DuckDuckGoを使用してWeb検索を行い、検索結果（タイトル、要約、URL）を取得します。',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: { type: 'STRING', description: '検索クエリ（日本語・英語どちらも可）' }
            },
            required: ['query']
        }
    }
};

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
            // システムプロンプトに現在のシステム日時を動的に注入する（ツール非対応モデルやツール呼び出し失敗時のフォールバック）
            const nowStr = new Date().toLocaleString('ja-JP');
            const timeInstruction = `\n\n[現在のシステム日時]\n${nowStr}`;
            const finalSystemPrompt = `${systemPrompt || ''}${timeInstruction}`;

            const currentEngine = engine || 'gemini';
            if (currentEngine === 'lmstudio') {
                return await LmStudioConnector.generateResponse({
                    message,
                    systemPrompt: finalSystemPrompt,
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

                // ツール有効・無効に基づくフィルタリング
                const filteredTools = lmStudioTools.filter(tool => {
                    if (!tools) return true; // 設定がない場合はすべて有効

                    switch (tool.name) {
                        case 'launchApp':
                            return tools.toolsAppLauncher !== false;
                        case 'getCurrentTime':
                            return tools.toolsCurrentTime !== false;
                        case 'getGPSLocation':
                            return tools.toolsGpsLocation !== false;
                        case 'adjustVolume':
                            return tools.toolsVolume !== false;
                        case 'getWeather':
                            return tools.toolsWeather !== false;
                        case 'searchWeb':
                            return tools.toolsWebSearch !== false;
                        default:
                            return true;
                    }
                });

                // Gemini用のツール定義の構築
                const functionDeclarations = filteredTools
                    .map(t => geminiToolsMap[t.name])
                    .filter(Boolean);

                const toolsPayload = functionDeclarations.length > 0
                    ? [{ functionDeclarations }]
                    : undefined;

                let currentContents = [...contents];
                let loopCount = 0;
                const maxLoops = 5;
                let finalResponseText = '';

                while (loopCount < maxLoops) {
                    const requestBody: any = {
                        contents: currentContents,
                        systemInstruction: { parts: [{ text: finalSystemPrompt || 'You are a helpful assistant.' }] }
                    };
                    if (toolsPayload) {
                        requestBody.tools = toolsPayload;
                    }

                    console.log(`[ChatAiService] Sending request to Gemini (loop ${loopCount + 1})...`);
                    const response = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody),
                        signal: controller.signal
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Gemini API Error: ${response.status} ${errorText}`);
                    }

                    const resJson: any = await response.json();
                    const candidate = resJson.candidates?.[0];
                    if (!candidate) {
                        throw new Error("No candidate found in Gemini response.");
                    }

                    const modelContent = candidate.content;
                    if (!modelContent || !modelContent.parts) {
                        throw new Error("Invalid Gemini response structure (no content or parts).");
                    }

                    // 応答を履歴に追加
                    currentContents.push(modelContent);

                    // functionCall を含んでいるか確認
                    const functionCalls = modelContent.parts.filter((p: any) => p.functionCall);
                    if (functionCalls.length === 0) {
                        // ツール呼び出しがなければ、これが最終応答テキスト
                        finalResponseText = modelContent.parts.map((p: any) => p.text || '').join('');
                        break;
                    }

                    // ツールを順番に実行し、結果を functionResponse に詰める
                    const responseParts: any[] = [];
                    for (const part of functionCalls) {
                        const { name, args } = part.functionCall;
                        console.log(`[ChatAiService] Gemini requested tool: ${name} with args:`, args);
                        const targetTool = filteredTools.find(t => t.name === name);
                        
                        let result: any;
                        if (targetTool) {
                            try {
                                const toolOutput = await targetTool.implementation(args, {} as any);
                                let responseData: any;
                                try {
                                    responseData = typeof toolOutput === 'string' ? JSON.parse(toolOutput) : toolOutput;
                                    if (responseData === null || typeof responseData !== 'object') {
                                        responseData = { result: toolOutput };
                                    }
                                } catch {
                                    responseData = { result: toolOutput };
                                }
                                result = responseData;
                            } catch (err: any) {
                                console.error(`[ChatAiService] Error executing tool ${name}:`, err);
                                result = { error: err.message || 'Tool execution failed' };
                            }
                        } else {
                            console.warn(`[ChatAiService] Tool ${name} is requested but not found or not enabled.`);
                            result = { error: `Tool ${name} is not found or not enabled.` };
                        }

                        responseParts.push({
                            functionResponse: {
                                name: name,
                                response: result
                            }
                        });
                    }

                    currentContents.push({
                        role: 'function',
                        parts: responseParts
                    });

                    loopCount++;
                }

                clearTimeout(timeoutId);

                if (loopCount >= maxLoops && !finalResponseText) {
                    throw new Error("Exceeded maximum tool execution loops.");
                }

                return finalResponseText;
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
