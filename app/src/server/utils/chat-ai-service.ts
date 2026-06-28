import { lmStudioTools } from '../skills/tool-use';
import { generateText, ModelMessage, isLoopFinished, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { convertLmStudioToolToVercel } from './tool-adapter';

// 生成テキストのループ崩壊（リピート問題）を検知してカットするヘルパー
function removeRepetitiveLoops(text: string): string {
    if (!text) return text;

    const sentences = text.split(/([。！？\n]+)/);
    const cleanedSentences: string[] = [];
    
    for (let i = 0; i < sentences.length; i++) {
        const current = sentences[i].trim();
        if (!current) {
            cleanedSentences.push(sentences[i]);
            continue;
        }

        let isRepeat = false;
        if (cleanedSentences.length > 0) {
            for (let j = cleanedSentences.length - 1; j >= 0; j--) {
                const prev = cleanedSentences[j].trim();
                if (prev) {
                    if (prev === current) {
                        isRepeat = true;
                    }
                    break;
                }
            }
        }

        if (!isRepeat) {
            cleanedSentences.push(sentences[i]);
        } else {
            if (current.length > 10) {
                break;
            }
        }
    }

    let result = cleanedSentences.join('');
    const repeatRegex = /(.{12,300}?)\1+/g;
    result = result.replace(repeatRegex, '$1');

    return result.trim();
}

// テキストファイルのデコード用ヘルパー
function decodeDataUrlAsText(dataUrl: string): string | null {
    try {
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return null;
        const mimeType = match[1];
        const base64Data = match[2];
        const isText = mimeType.startsWith('text/') || 
                       mimeType.includes('json') || 
                       mimeType.includes('javascript') ||
                       mimeType.includes('xml') ||
                       mimeType.includes('yaml') ||
                       mimeType.includes('html');
        if (isText) {
            const buffer = Buffer.from(base64Data, 'base64');
            return buffer.toString('utf-8');
        }
    } catch (e) {
        console.error('[ChatAiService] Failed to decode data URL as text:', e);
    }
    return null;
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
        tools?: any;
    }): Promise<string> {
        const { message, apiKey, systemPrompt, model, engine, lmstudioEndpoint, history, attachments, tools } = params;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            // システムプロンプトに現在のシステム日時を動的に注入する
            const nowStr = new Date().toLocaleString('ja-JP');
            const timeInstruction = `\n\n[現在のシステム日時]\n${nowStr}`;

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

            // ツール使用ガイドラインを動的に構成
            const activeToolDescriptions: string[] = [];
            filteredTools.forEach(t => {
                activeToolDescriptions.push(t.name);
            });
            const toolListStr = activeToolDescriptions.join(', ');
            const toolUseSection = activeToolDescriptions.length > 0
                ? `- You have access to tools for ${toolListStr}.\n- Always call tools to get accurate information instead of guessing.`
                : `- Do NOT call any tools.`;

            const toolUseGuideline = `\n\n# Tool Use Guidelines\n${toolUseSection}\n- Do NOT output any thought process, self-instructions, or meta-comments like "I got the time..." or "Now I will reply..." in the final response.\n- Answer in Japanese, speaking directly to the user as a friendly mascot character. Output ONLY the natural dialogue/reply.`;

            const finalSystemPrompt = `${systemPrompt || ''}${timeInstruction}${toolUseGuideline}`;

            // 履歴のマッピング
            const messages: ModelMessage[] = [];
            if (history && history.length > 0) {
                // 最初のメッセージが user 以外（assistant など）の場合、APIの制約（最初が user でなければならない等）を回避するため、
                // 先頭にダミーの user メッセージを挿入して履歴が切り捨てられるのを防ぐ
                const firstMsg = history[0];
                if (firstMsg && firstMsg.sender !== 'user') {
                    messages.push({
                        role: 'user',
                        content: 'こんにちは'
                    });
                }

                history.forEach((msg: any) => {
                    const role = msg.sender === 'user' ? 'user' : 'assistant';
                    const text = msg.text || '';
                    if (text.trim()) {
                        messages.push({
                            role,
                            content: text
                        });
                    }
                });
            }

            // 今回のメッセージと添付ファイルの構築
            let finalMessage = message || '';
            if (attachments && attachments.length > 0) {
                const fileTexts: string[] = [];
                for (const att of attachments) {
                    if (att.type === 'file' && att.url.startsWith('data:')) {
                        const textContent = decodeDataUrlAsText(att.url);
                        if (textContent !== null) {
                            fileTexts.push(`--- 添付ファイル: ${att.name} ---\n${textContent}\n---`);
                        } else {
                            fileTexts.push(`[添付ファイル: ${att.name} (バイナリ形式のためテキストプレビューはスキップされました)]`);
                        }
                    }
                }
                if (fileTexts.length > 0) {
                    finalMessage = `${finalMessage}\n\n${fileTexts.join('\n\n')}`.trim();
                }
            }

            const userContent: any[] = [{ type: 'text', text: finalMessage.trim() || 'こんにちは' }];
            
            // 画像の添付
            if (attachments && attachments.length > 0) {
                for (const att of attachments) {
                    if (att.type === 'image' && att.url.startsWith('data:')) {
                        const match = att.url.match(/^data:(image\/\w+);base64,(.+)$/);
                        if (match) {
                            userContent.push({
                                type: 'image',
                                image: match[2],
                                mimeType: match[1]
                            });
                        }
                    }
                }
            }

            messages.push({
                role: 'user',
                content: userContent.length === 1 && userContent[0].type === 'text' ? userContent[0].text : userContent
            });

            // Vercel AI SDK 形式のツール定義に変換
            const vercelTools: Record<string, any> = {};
            filteredTools.forEach(t => {
                vercelTools[t.name] = convertLmStudioToolToVercel(t);
            });

            // プロバイダーとモデルの設定
            let modelProvider: any;
            const currentEngine = engine || 'gemini';

            if (currentEngine === 'lmstudio') {
                const baseEndpoint = (lmstudioEndpoint || '').trim() || 'http://localhost:1234/v1';
                let finalEndpoint = baseEndpoint;
                if (!finalEndpoint.endsWith('/v1') && !finalEndpoint.endsWith('/v1/')) {
                    finalEndpoint = finalEndpoint.endsWith('/') ? `${finalEndpoint}v1` : `${finalEndpoint}/v1`;
                }
                console.log(`[ChatAiService] Routing to LM Studio via Vercel AI SDK: ${finalEndpoint} (Model: ${model || 'unspecified'})`);
                
                const lmstudio = createOpenAI({
                    baseURL: finalEndpoint,
                    apiKey: 'not-needed',
                    compatibility: 'compatible'
                });
                modelProvider = lmstudio.chat(model || 'unspecified');
            } else if (currentEngine === 'gemini') {
                const targetModel = model || 'gemini-1.5-flash';
                console.log(`[ChatAiService] Routing to Gemini via Vercel AI SDK (Model: ${targetModel})`);
                
                const googleInstance = createGoogleGenerativeAI({
                    apiKey: apiKey,
                });
                modelProvider = googleInstance(targetModel);
            } else if (currentEngine === 'openai') {
                const targetModel = model || 'gpt-4o';
                console.log(`[ChatAiService] Routing to OpenAI via Vercel AI SDK (Model: ${targetModel})`);
                
                const openaiInstance = createOpenAI({
                    apiKey: apiKey,
                });
                modelProvider = openaiInstance(targetModel);
            } else {
                throw new Error(`Unsupported AI engine: ${currentEngine}`);
            }

            // デバッグログ
            console.log("[ChatAiService] finalSystemPrompt:", finalSystemPrompt);
            console.log("[ChatAiService] messages:", JSON.stringify(messages, null, 2));
            console.log("[ChatAiService] vercelTools:", Object.keys(vercelTools));
            console.log("[ChatAiService] vercelTools schema example (getCurrentTime):", JSON.stringify(vercelTools.getCurrentTime, null, 2));

            // Vercel AI SDK での生成実行 (ツールが定義されている場合のみ tools / stopWhen を指定する)
            const hasTools = Object.keys(vercelTools).length > 0;
            const generateOptions: any = {
                model: modelProvider,
                system: finalSystemPrompt,
                messages: messages,
                abortSignal: controller.signal
            };

            if (hasTools) {
                generateOptions.tools = vercelTools;
                generateOptions.stopWhen = [isLoopFinished(), stepCountIs(5)];
            }

            let response;
            try {
                response = await generateText(generateOptions);
            } catch (firstTryError: any) {
                const isLmStudio = currentEngine === 'lmstudio';
                // 400 エラーかつ Jinja2 テンプレート関連のエラーと思われる文言が含まれる場合にフォールバック
                const errorStr = (firstTryError.message || '') + (firstTryError.responseBody || '');
                const isTemplateError = firstTryError.statusCode === 400 && 
                    (errorStr.includes('template') || errorStr.includes('jinja') || errorStr.includes('UndefinedValue'));

                if (isLmStudio && hasTools && isTemplateError) {
                    console.warn('[ChatAiService] LM Studio のプロンプトテンプレートエラーを検知しました。ツール呼び出しを無効化して再試行します。', firstTryError.message);
                    const retryOptions = { ...generateOptions };
                    delete retryOptions.tools;
                    delete retryOptions.stopWhen;
                    response = await generateText(retryOptions);
                } else {
                    throw firstTryError;
                }
            }

            clearTimeout(timeoutId);

            let cleanedContent = response.text || '';

            // 思考プロセス（Thinking Process や <think>, <thought> タグ）のクレンジング
            if (cleanedContent.includes('</think>')) {
                cleanedContent = cleanedContent.split(/<\/think>/i).pop() || '';
            }
            if (cleanedContent.includes('</thought>')) {
                cleanedContent = cleanedContent.split(/<\/thought>/i).pop() || '';
            }
            cleanedContent = cleanedContent
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                .replace(/<think>[\s\S]*/gi, '')
                .replace(/<\/think>[\s\S]*/gi, '')
                .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
                .replace(/<thought>[\s\S]*/gi, '')
                .replace(/^Thinking Process:[\s\S]*?(?=\n\n\S|$)/i, '')
                .replace(/\nThinking Process:[\s\S]*?(?=\n\n\S|$)/g, '');

            return removeRepetitiveLoops(cleanedContent);

        } catch (aiError: any) {
            clearTimeout(timeoutId);
            console.error(`[ChatAiService] 詳細なエラー情報:`, aiError);
            if (aiError.responseBody) {
                console.error(`[ChatAiService] APIレスポンス本文:`, aiError.responseBody);
            }
            if (aiError.statusCode) {
                console.error(`[ChatAiService] APIステータスコード:`, aiError.statusCode);
            }
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
