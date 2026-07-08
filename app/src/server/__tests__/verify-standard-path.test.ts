import { describe, it } from 'vitest';
import { generateText, tool, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

describe('Standard Multistep Path Verification', () => {
    const lmstudioEndpoint = process.env.TEST_LMSTUDIO_ENDPOINT || 'http://localhost:1234/v1';

    // 検索ツールの定義 (本番の schema を簡易再現)
    const testSearchTasksTool = tool({
        description: 'タスク（TODO）やスケジュール（予定）を検索します。',
        inputSchema: z.object({
            query: z.string().optional().describe('タイトルに含まれる検索キーワード'),
            date: z.string().optional().describe('予定日 (YYYY-MM-DD)'),
            completed: z.boolean().optional().describe('完了状態で絞り込む場合は true'),
            action: z.enum(['add', 'search', 'delete']).optional().describe('操作アクション'),
            tags: z.array(z.string()).optional().describe('タグのリスト')
        }),
        execute: async (args) => {
            console.log('[Verify Test] searchTasks executed with args:', args);
            return JSON.stringify({
                success: true,
                message: 'タスク・予定が 1 件見つかりました：\n- [未完了] 検証ブランチテスト会議 (予定日時: 2026/07/07 15:00:00)'
            });
        }
    });

    // Outgoing fetch body interceptor
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
        if (url && typeof url === 'string' && url.includes('/chat/completions')) {
            console.log('--- SENT REQUEST BODY ---');
            console.log(options?.body ? JSON.stringify(JSON.parse(options.body), null, 2) : 'No body');
            console.log('-------------------------');
        }
        return originalFetch(url, options);
    };

    const runStandardVerification = async (engine: 'gemini' | 'lmstudio') => {
        console.log('--- testSearchTasksTool Dump ---');
        console.log('testSearchTasksTool.parameters:', JSON.stringify((testSearchTasksTool as any).parameters, null, 2));
        console.log('testSearchTasksTool.inputSchema:', JSON.stringify((testSearchTasksTool as any).inputSchema, null, 2));
        console.log('--------------------------------');

        let modelProvider: any;
        if (engine === 'gemini') {
            const google = createGoogleGenerativeAI({
                apiKey: process.env.GEMINI_API_KEY || 'dummy'
            });
            modelProvider = google('gemini-1.5-flash');
        } else {
            const lmstudio = createOpenAI({
                baseURL: lmstudioEndpoint,
                apiKey: 'not-needed',
                compatibility: 'compatible'
            });
            modelProvider = lmstudio.chat('qwen3.5-9b-uncensored-hauhaucs-aggressive');
        }

        try {
            console.log(`[Verify Test] Starting generateText for ${engine} using standard stopWhen path...`);
            const result = await generateText({
                model: modelProvider,
                system: 'あなたはアシスタントです。質問に対して適切なツールを実行して、その結果をもとに日本語の会話文で回答してください。思考プロセスやシステムログなどのタグは一切含めず、純粋なセリフのみを出力してください。',
                messages: [
                    {
                        role: 'user',
                        content: '今日の予定を教えて。'
                    }
                ],
                tools: {
                    searchTasks: testSearchTasksTool
                },
                stopWhen: stepCountIs(5)
            });

            console.log(`[Verify Test] Execution completed successfully.`);
            console.log(` - text: "${result.text}"`);
            console.log(` - finishReason: "${result.finishReason}"`);
            result.steps.forEach((step, idx) => {
                console.log(`   Step ${idx + 1}: text="${step.text}", finishReason="${step.finishReason}", toolCalls=${step.toolCalls.length}`);
            });
        } catch (error: any) {
            console.error(`[Verify Test] ${engine} failed with exception!`);
            console.error('--- ERROR MESSAGE ---');
            console.error(error.message || error);
            console.error('--- STACK TRACE ---');
            console.error(error.stack || 'No stack trace');
            console.error('--- FULL ERROR OBJECT ---');
            console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            console.error('----------------------');
            throw error;
        }
    };

    it('Verify standard path on Gemini', async () => {
        // APIキーがある場合のみ実行
        if (!process.env.GEMINI_API_KEY) {
            console.warn('[Verify Test] GEMINI_API_KEY is not set. Skipping Gemini test.');
            return;
        }
        await runStandardVerification('gemini');
    });

    it('Verify standard path on LM Studio', async () => {
        // 接続確認をしてから実行
        try {
            const res = await fetch(`${lmstudioEndpoint}/models`, { signal: AbortSignal.timeout(3000) });
            if (!res.ok) {
                console.warn('[Verify Test] LM Studio is not active. Skipping LM Studio test.');
                return;
            }
        } catch (e) {
            console.warn('[Verify Test] LM Studio connection failed. Skipping LM Studio test.');
            return;
        }
        await runStandardVerification('lmstudio');
    }, 60000);
});
