import { filterEnabledTools } from '../skills/tool-use';
import { generateText, ModelMessage, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { convertLmStudioToolToVercel } from './tool-adapter';

// 共通ガイドラインテンプレートの読み込み
import toolUseGuidelineTemplate from '@prompt/tool-use-guideline';

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

// モデルがツールを実行せず、本文中に擬似的なツール呼び出し記法
// （例: [manageTasks(action="delete", ...)] や manageTasks(...)）を書いてしまうことがある。
// これは実際には何も実行されていない上にユーザーには無意味なので除去する。
// 正規表現ではなく括弧の対応を走査することで、引数値に丸括弧を含むケース
// （例: title="会議(定例)"）でも末尾が本文に残らないようにする。
// 感情タグ [happy] やタイマータグ [TIMER:...] は「ツール名(」の形にならないため影響を受けない。
function stripPseudoToolCalls(text: string, toolNames: string[]): string {
    if (!text || toolNames.length === 0) return text;

    // 開始位置（ツール名の直後に '(' が続く箇所）を探す正規表現
    const namePattern = toolNames
        .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
    const startRegex = new RegExp(`(?:${namePattern})\\s*\\(`, 'gi');

    // openIdx の '(' に対応する ')' の位置を返す（引用符内の括弧は無視）。見つからなければ -1
    const findMatchingParen = (s: string, openIdx: number): number => {
        let depth = 0;
        let quote: string | null = null;
        for (let i = openIdx; i < s.length; i++) {
            const ch = s[i];
            if (quote) {
                if (ch === quote) quote = null;
                continue;
            }
            if (ch === '"' || ch === "'") { quote = ch; continue; }
            if (ch === '(') depth++;
            else if (ch === ')') {
                depth--;
                if (depth === 0) return i;
            }
        }
        return -1;
    };

    let out = '';
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = startRegex.exec(text)) !== null) {
        const nameStart = m.index;
        const parenStart = m.index + m[0].length - 1; // '(' の位置
        const closeIdx = findMatchingParen(text, parenStart);
        // 対応する ')' が無い場合は誤削除を避けてそのまま残す
        if (closeIdx === -1) continue;

        // 直前の空白と、それを跨いだ先頭の '[' を巻き込む
        let from = nameStart;
        let p = nameStart - 1;
        while (p >= 0 && (text[p] === ' ' || text[p] === '\t')) p--;
        if (p >= 0 && text[p] === '[') from = p;

        // 末尾の空白と閉じ ']' を巻き込む
        let to = closeIdx + 1;
        while (to < text.length && (text[to] === ' ' || text[to] === '\t')) to++;
        if (to < text.length && text[to] === ']') to++;
        else to = closeIdx + 1; // ']' が無ければ空白は消さずに ')' の直後まで

        out += text.slice(lastIndex, from);
        lastIndex = to;
        startRegex.lastIndex = to;
    }
    out += text.slice(lastIndex);

    return out
        .replace(/[ \t]+\n/g, '\n')   // 行末の余分な空白を除去
        .replace(/\n{3,}/g, '\n\n')   // 除去後に生じる過剰な空行を2行までに圧縮
        .trim();
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
            // システムプロンプトに現在のシステム日時を動的に注入する。
            // 秒を含めるとプロンプトキャッシュ（ローカルLLMのKVプレフィックスキャッシュ等）が
            // 毎ターン無効化されるため、粒度は分単位に留める。
            const nowStr = new Date().toLocaleString('ja-JP', {
                year: 'numeric', month: 'numeric', day: 'numeric',
                weekday: 'short', hour: '2-digit', minute: '2-digit'
            });
            const timeInstruction = `\n\n[現在のシステム日時]\n${nowStr}`;

            // ツール有効・無効に基づくフィルタリング
            const filteredTools = filterEnabledTools(tools);

            // ツール使用ガイドラインを動的に構成
            const activeToolDescriptions: string[] = [];
            const activeToolPrompts: string[] = [];

            filteredTools.forEach(t => {
                activeToolDescriptions.push(t.tool.name);
                activeToolPrompts.push(t.prompt.trim());
            });

            const toolListStr = activeToolDescriptions.join(', ');
            let toolUseSection = '';
            if (activeToolDescriptions.length > 0) {
                toolUseSection = `- 以下のツールが使用可能です: ${toolListStr}\n` + activeToolPrompts.join('\n');
            } else {
                toolUseSection = `- 利用可能なツールはありません。`;
            }

            // 置換値に $ が含まれても $& 等の特殊置換として解釈されないよう、関数形式で置換する
            const toolUseGuideline = toolUseGuidelineTemplate.replace('{{toolUseSection}}', () => toolUseSection);

            // 変動する時刻は静的部分（ペルソナ＋ガイドライン）の後ろに置き、プレフィックスのキャッシュ効率を保つ
            const finalSystemPrompt = `${systemPrompt || ''}\n\n${toolUseGuideline}${timeInstruction}`;

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
                vercelTools[t.tool.name] = convertLmStudioToolToVercel(
                    t.tool,
                    (input, output) => {
                        executedTools.push({ toolName: t.tool.name, input, output });
                    },
                    async (args) => {
                        if (onToolExecute) {
                            return await onToolExecute(t.tool.name, args);
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
                // ツール有効時は tool-calling の安定性を優先して低温をデフォルトにする（ユーザー指定は常に優先）
                temperature: temperature !== undefined ? temperature : (hasTools ? 0.2 : 0.7),
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
                    // jinja テンプレートエラーの具体的な原因を追えるよう、レスポンス本文をそのまま出力する。
                    // （ツールを無効化するとタスク／予定の追加・削除が実行されないため、根本原因の特定が重要）
                    if (firstTryError.responseBody) {
                        console.warn('[ChatAiService] テンプレートエラーの詳細(responseBody):', firstTryError.responseBody);
                    }
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

            // 本文に紛れ込んだ擬似的なツール呼び出し記法を除去する（引数内の丸括弧にも対応。詳細は stripPseudoToolCalls）
            if (filteredTools.length > 0) {
                cleanedContent = stripPseudoToolCalls(cleanedContent, filteredTools.map(t => t.tool.name));
            }

            const finalReply = removeRepetitiveLoops(cleanedContent);

            // 応答が空になるケースへのフォールバック。
            // 特にローカルモデルが思考(<|channel>thought 等)だけで maxOutputTokens を使い切り
            // finishReason が "length" で打ち切られると、思考クレンジング後に本文が空になり、
            // ツール呼び出しも発火しないまま UI が無反応になる。必ず何か発話を返す。
            if (!finalReply.trim()) {
                const finishReason = response.finishReason;
                console.warn(`[ChatAiService] クレンジング後の応答が空です (finishReason: ${finishReason})。フォールバック応答を返します。`);
                if (finishReason === 'length') {
                    return 'うーん、考えているうちに言葉が長くなりすぎちゃったみたい…！ごめんね、もう一度お願いできる？（応答長の上限を上げると安定するよ）';
                }
                return 'ごめんね、うまく応答を作れなかったみたい…。もう一度話しかけてくれる？';
            }

            return finalReply;

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
