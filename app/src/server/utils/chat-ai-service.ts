import { lmStudioTools } from '../skills/tool-use';
import { generateText, ModelMessage, stepCountIs } from 'ai';
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
        lmstudioEndpoint?: string;
        temperature?: number;
        frequencyPenalty?: number;
        repetitionPenalty?: number;
        maxOutputTokens?: number;
        enableThinking?: boolean;
        history?: any[];
        attachments?: any[];
        tools?: any;
        onToolResult?: (toolName: string, input: any, output: any) => void;
        onToolExecute?: (toolName: string, args: any) => Promise<any>;
    }): Promise<string> {
        const { message, apiKey, systemPrompt, model, engine, lmstudioEndpoint, temperature, frequencyPenalty, repetitionPenalty, maxOutputTokens, enableThinking, history, attachments, tools, onToolResult, onToolExecute } = params;
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
                ? `- 以下のツールが使用可能です: ${toolListStr}\n- 現在の情報や天気、時間、アプリの起動、音量の調整、および【ユーザーが一覧で管理するタスク／予定（スケジュール）の追加・登録・検索・更新・削除】について尋ねられたり依頼された場合は、絶対に自分で推測して会話だけで完了せず、必ず定義された対応するツール（manageTasks。追加時は action: "add" を指定し、期限付きの予定にする場合は scheduledAt も指定してください）を呼び出してください。\n- 【重要な区別】「〇分後に通知して」「後で教えて」「カップ麺ができたら知らせて」のような、その場限りで一覧に残さない一時的なリマインド（マスコットが一度だけ声かけするだけのもの）は、manageTasks では登録せず、後述のタイマー通知タグを使ってください。逆に、ユーザーが後から一覧で管理・確認したいTODOや予定は必ず manageTasks を使い、タイマータグでは扱わないでください。\n- 【履歴の扱い】会話履歴（過去のやり取り）は文脈把握のためだけに提供されています。履歴の中にある過去のタスク追加・予定登録・リマインドの依頼は既に対応済みです。最新（今回）のユーザーメッセージで新たに依頼された場合のみツールを呼び出し、履歴にある過去の依頼を蒸し返して再登録しないでください。`
                : `- 利用可能なツールはありません。`;

            const toolUseGuideline = `\n\n# ツール使用ガイドライン\n${toolUseSection}\n- タスクやスケジュールの追加時には、ツールを呼び出した後に、ユーザーに「登録しました」と伝える応答を返してください。\n- 最終的な回答には、思考プロセス（Thinking Process）や、自己指示、"<|channel>thought" や "<|channel>" などの特殊なチャンネルタグ、メタコメント（"現在時刻を取得しました"、"ツールを実行します" など）を一切含めないでください。\n- 回答は日本語で、フレンドリーなマスコットキャラクターとしてユーザーに直接語りかけるように記述してください。出力するテキストは、自然なセリフ（発話内容）のみにしてください。`;

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

            // ツール実行結果を確実に収集する一時配列
            const executedTools: Array<{ toolName: string; input: any; output: any }> = [];

            // Vercel AI SDK 形式 of ツール定義に変換
            const vercelTools: Record<string, any> = {};
            filteredTools.forEach(t => {
                vercelTools[t.name] = convertLmStudioToolToVercel(
                    t,
                    (input, output) => {
                        executedTools.push({ toolName: t.name, input, output });
                    },
                    async (args) => {
                        if (onToolExecute) {
                            return await onToolExecute(t.name, args);
                        }
                        return null;
                    }
                );
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
                const additionalBody: any = {};
                if (repetitionPenalty !== undefined) {
                    additionalBody.repetition_penalty = repetitionPenalty;
                }
                if (enableThinking === false) {
                    additionalBody.reasoning_format = 'none';
                    additionalBody.include_reasoning = false;
                }
                const chatSettings = Object.keys(additionalBody).length > 0 ? {
                    additionalBody
                } : {};
                modelProvider = lmstudio.chat(model || 'unspecified', chatSettings);
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

            // Vercel AI SDK での生成実行 (ツールが定義されている場合のみ tools / stopWhen を指定する)
            const hasTools = Object.keys(vercelTools).length > 0;
            const generateOptions: any = {
                model: modelProvider,
                system: finalSystemPrompt,
                messages: messages,
                temperature: temperature !== undefined ? temperature : 0.7,
                frequencyPenalty: frequencyPenalty !== undefined ? frequencyPenalty : 0.0,
                maxOutputTokens: maxOutputTokens !== undefined ? maxOutputTokens : 2048,
                abortSignal: controller.signal
            };

            if (hasTools) {
                generateOptions.tools = vercelTools;
                generateOptions.stopWhen = stepCountIs(5);
            }

            let response;
            try {
                response = await generateText(generateOptions);


                // ツール呼び出しの有無をログ出力
                // Vercel AI SDK の toolResults の仕様不整合や undefined 化を回避するため、
                // 実際に execute された実績である executedTools キャッシュから直接通知を送信する
                if (executedTools.length > 0) {
                    console.log(`[ChatAiService] Dispatching ${executedTools.length} executed tools directly from cache`);
                    executedTools.forEach(et => {
                        if (onToolResult) {
                            onToolResult(et.toolName, et.input, et.output);
                        }
                    });
                }
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

            console.log("[ChatAiService] raw generateText response.text:", response.text);
            console.log("[ChatAiService] generateText response steps:", JSON.stringify(response.steps.map(s => ({
                text: s.text,
                toolCalls: s.toolCalls,
                toolResults: s.toolResults,
                finishReason: s.finishReason
            })), null, 2));
            let cleanedContent = response.text || '';

            // 思考プロセス（Thinking Process や <think>, <thought> タグ、<|channel>thought タグ）のクレンジング
            if (cleanedContent.includes('</think>')) {
                cleanedContent = cleanedContent.split(/<\/think>/i).pop() || '';
            }
            if (cleanedContent.includes('</thought>')) {
                cleanedContent = cleanedContent.split(/<\/thought>/i).pop() || '';
            }
            if (cleanedContent.includes('channel|>')) {
                cleanedContent = cleanedContent.split(/channel\|>/gi).pop() || '';
            }

            cleanedContent = cleanedContent
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                .replace(/<think>[\s\S]*/gi, '')
                .replace(/<\/think>[\s\S]*/gi, '')
                .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
                .replace(/<thought>[\s\S]*/gi, '')
                .replace(/<\|channel>thought[\s\S]*?<channel\|>/gi, '')
                .replace(/<\|channel>thought[\s\S]*/gi, '')
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
