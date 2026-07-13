import { describe, it, expect } from 'vitest';
import { ChatAiService } from '../utils/chat-ai-service';

describe('ChatAiService の LM Studio 実機統合テスト (Mockなし)', () => {
    // LM Studio のエンドポイント (環境変数から取得、デフォルトは http://localhost:1234/v1)
    const lmstudioEndpoint = process.env.TEST_LMSTUDIO_ENDPOINT || 'http://localhost:1234/v1';
    const endpointWasExplicitlySet = Boolean(process.env.TEST_LMSTUDIO_ENDPOINT);

    // 実際に接続可能かどうかを判定し、接続できない場合はテストをスキップする
    const checkConnection = async (): Promise<boolean> => {
        try {
            const res = await fetch(`${lmstudioEndpoint}/models`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json();
                console.log('[Real Test] Available models in LM Studio:', data);
                return true;
            }
            const errorMsg = `LM Studio returned non-ok status: ${res.status}`;
            console.warn(`[Real Test] ${errorMsg}`);
            if (endpointWasExplicitlySet) {
                throw new Error(`LM Studio への接続に失敗しました (${errorMsg}): ${lmstudioEndpoint}`);
            }
            return false;
        } catch (e: any) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.warn(`[Real Test] LM Studio is not running at ${lmstudioEndpoint}. Skipping real connection test. (Error: ${errorMsg})`);
            if (endpointWasExplicitlySet) {
                throw new Error(`LM Studio への接続に失敗しました (Error: ${errorMsg}): ${lmstudioEndpoint}`);
            }
            return false;
        }
    };

    it('generateResponse_実機接続_予定の問い合わせに対してツールを実行し結果を踏まえた回答を返すこと', async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            if (endpointWasExplicitlySet) {
                throw new Error(`LM Studio に接続できません: ${lmstudioEndpoint}`);
            }
            console.log('[Real Test] Connection check failed. Test skipped.');
            return;
        }

        // 実機での呼び出しを実行
        const reply = await ChatAiService.generateResponse({
            message: '今日の予定の一覧は？',
            apiKey: 'not-needed',
            systemPrompt: 'あなたは優秀なアシスタントです。',
            model: 'qwen3.5-9b-uncensored-hauhaucs-aggressive', 
            engine: 'lmstudio',
            lmstudioEndpoint: lmstudioEndpoint,
            tools: {
                toolsCurrentTime: true,
                toolsGpsLocation: true,
                toolsWeather: true,
                toolsVolume: true,
                toolsAppLauncher: true,
                toolsWebSearch: true
            },
            onToolExecute: async (toolName, args) => {
                console.log(`[Real Test onToolExecute] Intercepted tool: ${toolName}`, args);
                if (toolName === 'manageTasks' && args.action === 'search') {
                    return JSON.stringify({
                        success: true,
                        message: 'タスク・予定が 1 件見つかりました：\n- [未完了] LM Studio 実機テスト会議 (予定日時: 2026/07/07 15:00:00)'
                    });
                }
                return null;
            }
        });

        console.log('[Real Test Result Reply]:', reply);
        
        // 最終回答に、ツールから提供された情報が含まれていることを検証
        expect(reply).toBeTruthy();
        expect(reply).toContain('テスト会議');
    }, 60000);

    it('generateResponse_実機接続_タスク追加の指示に対してaddTaskツールを呼び出すこと', async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            if (endpointWasExplicitlySet) {
                throw new Error(`LM Studio に接続できません: ${lmstudioEndpoint}`);
            }
            return;
        }

        let toolCalled = false;
        let scheduledAtValue: string | undefined;

        const reply = await ChatAiService.generateResponse({
            message: '「7月20日までに牛乳を買う」というタスクを追加して',
            apiKey: 'not-needed',
            systemPrompt: 'あなたは優秀なアシスタントです。',
            model: 'qwen3.5-9b-uncensored-hauhaucs-aggressive',
            engine: 'lmstudio',
            lmstudioEndpoint: lmstudioEndpoint,
            tools: {},
            onToolExecute: async (toolName, args) => {
                console.log(`[Real Test onToolExecute] Intercepted tool: ${toolName}`, args);
                if (toolName === 'manageTasks' && args.action === 'add') {
                    toolCalled = true;
                    scheduledAtValue = args.scheduledAt;
                    return JSON.stringify({
                        success: true,
                        message: 'タスク「7月20日までに牛乳を買う」を追加しました。'
                    });
                }
                return null;
            }
        });

        console.log('[Real Test Result Reply (Add)]:', reply);
        expect(toolCalled).toBe(true);
        expect(scheduledAtValue).toBeTruthy();
        // 2026年7月20日の日付が scheduledAt に入っていることを検証
        expect(scheduledAtValue).toMatch(/2026-07-20/);
        expect(reply).toBeTruthy();
    }, 60000);

    it('generateResponse_実機接続_タスク更新の指示に対してupdateTaskツールを呼び出すこと', async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            if (endpointWasExplicitlySet) {
                throw new Error(`LM Studio に接続できません: ${lmstudioEndpoint}`);
            }
            return;
        }

        let toolCalled = false;

        const reply = await ChatAiService.generateResponse({
            message: 'タスクID task_123 の状態を完了にして',
            apiKey: 'not-needed',
            systemPrompt: 'あなたは優秀なアシスタントです。',
            model: 'qwen3.5-9b-uncensored-hauhaucs-aggressive',
            engine: 'lmstudio',
            lmstudioEndpoint: lmstudioEndpoint,
            tools: {},
            onToolExecute: async (toolName, args) => {
                console.log(`[Real Test onToolExecute] Intercepted tool: ${toolName}`, args);
                if (toolName === 'manageTasks' && args.action === 'update') {
                    toolCalled = true;
                    expect(args.id).toBe('task_123');
                    expect(args.completed).toBe(true);
                    return JSON.stringify({
                        success: true,
                        message: 'タスクを更新しました。'
                    });
                }
                return null;
            }
        });

        console.log('[Real Test Result Reply (Update)]:', reply);
        expect(toolCalled).toBe(true);
        expect(reply).toBeTruthy();
    }, 60000);

    it('generateResponse_実機接続_タスク削除の指示に対してdeleteTaskツールを呼び出すこと', async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            if (endpointWasExplicitlySet) {
                throw new Error(`LM Studio に接続できません: ${lmstudioEndpoint}`);
            }
            return;
        }

        let toolCalled = false;

        const reply = await ChatAiService.generateResponse({
            message: 'タスクID task_123 を削除して',
            apiKey: 'not-needed',
            systemPrompt: 'あなたは優秀なアシスタントです。',
            model: 'qwen3.5-9b-uncensored-hauhaucs-aggressive',
            engine: 'lmstudio',
            lmstudioEndpoint: lmstudioEndpoint,
            tools: {},
            onToolExecute: async (toolName, args) => {
                console.log(`[Real Test onToolExecute] Intercepted tool: ${toolName}`, args);
                if (toolName === 'manageTasks' && args.action === 'delete') {
                    toolCalled = true;
                    expect(args.id).toBe('task_123');
                    return JSON.stringify({
                        success: true,
                        message: 'タスクを削除しました。'
                    });
                }
                return null;
            }
        });

        console.log('[Real Test Result Reply (Delete)]:', reply);
        expect(toolCalled).toBe(true);
        expect(reply).toBeTruthy();
    }, 60000);

    it('generateResponse_実機接続_天気問い合わせに対してgetWeatherを呼び出すこと', async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            if (endpointWasExplicitlySet) {
                throw new Error(`LM Studio に接続できません: ${lmstudioEndpoint}`);
            }
            return;
        }

        let toolCalled = false;

        const reply = await ChatAiService.generateResponse({
            message: '東京の天気を教えて',
            apiKey: 'not-needed',
            systemPrompt: 'あなたは優秀なアシスタントです。',
            model: 'qwen3.5-9b-uncensored-hauhaucs-aggressive',
            engine: 'lmstudio',
            lmstudioEndpoint: lmstudioEndpoint,
            tools: {},
            onToolExecute: async (toolName, args) => {
                console.log(`[Real Test onToolExecute] Intercepted tool: ${toolName}`, args);
                if (toolName === 'getWeather') {
                    toolCalled = true;
                    expect(args.city).toBe('東京');
                    return JSON.stringify({
                        city: '東京',
                        temperature: '25°C',
                        weather: '晴れ'
                    });
                }
                return null;
            }
        });

        console.log('[Real Test Result Reply (Weather)]:', reply);
        expect(toolCalled).toBe(true);
        expect(reply).toBeTruthy();
    }, 60000);

    it('generateResponse_実機接続_一時的リマインドに対してTIMERタグを付与しmanageTasksを呼ばないこと', async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            if (endpointWasExplicitlySet) {
                throw new Error(`LM Studio に接続できません: ${lmstudioEndpoint}`);
            }
            return;
        }

        let taskToolCalled = false;

        const reply = await ChatAiService.generateResponse({
            // クライアント側と同じく TIMER 指示を systemPrompt に手動で追加して再現
            message: '3分後に通知して',
            apiKey: 'not-needed',
            systemPrompt: 'あなたは優秀なアシスタントです。\n# Timer Instructions\nユーザーから「〇分後に教えて」などの一時的リマインドを求められた場合は、会話の応答テキストの末尾に [TIMER:秒数,お知らせ内容] のフォーマットでタイマー起動タグを付与してください。一時的リマインドは manageTasks ツールでは絶対に登録しないでください。',
            model: 'qwen3.5-9b-uncensored-hauhaucs-aggressive',
            engine: 'lmstudio',
            lmstudioEndpoint: lmstudioEndpoint,
            tools: {},
            onToolExecute: async (toolName, args) => {
                console.log(`[Real Test onToolExecute] Intercepted tool: ${toolName}`, args);
                if (toolName === 'manageTasks') {
                    taskToolCalled = true;
                }
                return null;
            }
        });

        console.log('[Real Test Result Reply (Timer Tag)]:', reply);
        expect(taskToolCalled).toBe(false);
        expect(reply).toMatch(/\[TIMER:\d+,.*?\]/);
    }, 60000);

    it('generateResponse_実機接続_メモ追加に対してmanageMemosを呼び出すこと', async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            if (endpointWasExplicitlySet) {
                throw new Error(`LM Studio に接続できません: ${lmstudioEndpoint}`);
            }
            return;
        }

        let toolCalled = false;

        const reply = await ChatAiService.generateResponse({
            message: '買い物メモに牛乳を追加して',
            apiKey: 'not-needed',
            systemPrompt: 'あなたは優秀なアシスタントです。',
            model: 'qwen3.5-9b-uncensored-hauhaucs-aggressive',
            engine: 'lmstudio',
            lmstudioEndpoint: lmstudioEndpoint,
            tools: {},
            onToolExecute: async (toolName, args) => {
                console.log(`[Real Test onToolExecute] Intercepted tool: ${toolName}`, args);
                if (toolName === 'manageMemos' && args.action === 'add') {
                    toolCalled = true;
                    expect(args.content).toContain('牛乳');
                    return JSON.stringify({
                        success: true,
                        message: 'メモを追加しました。'
                    });
                }
                return null;
            }
        });

        console.log('[Real Test Result Reply (Memo Add)]:', reply);
        expect(toolCalled).toBe(true);
        expect(reply).toBeTruthy();
    }, 60000);

    it('generateResponse_実機接続_過去に実行済みの依頼を再実行しないこと（履歴再実行防止）', async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            if (endpointWasExplicitlySet) {
                throw new Error(`LM Studio に接続できません: ${lmstudioEndpoint}`);
            }
            return;
        }

        let toolCalled = false;

        const reply = await ChatAiService.generateResponse({
            message: 'こんにちは',
            apiKey: 'not-needed',
            systemPrompt: 'あなたは優秀なアシスタントです。',
            model: 'qwen3.5-9b-uncensored-hauhaucs-aggressive',
            engine: 'lmstudio',
            lmstudioEndpoint: lmstudioEndpoint,
            tools: {},
            // 履歴に過去のタスク追加依頼とその完了応答がある状態にする
            history: [
                { sender: 'user', text: '買い物メモに牛乳を追加して' },
                { sender: 'assistant', text: '買い物メモに牛乳を追加したよ！' }
            ],
            onToolExecute: async (toolName, args) => {
                console.log(`[Real Test onToolExecute] Intercepted tool: ${toolName}`, args);
                toolCalled = true; // 何かしらのツールが呼ばれたらNG
                return null;
            }
        });

        console.log('[Real Test Result Reply (History Loop Prevention)]:', reply);
        expect(toolCalled).toBe(false);
    }, 60000);

    it('generateResponse_実機接続_削除確認後の「はい」で未完了の依頼を継続実行すること', async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            if (endpointWasExplicitlySet) {
                throw new Error(`LM Studio に接続できません: ${lmstudioEndpoint}`);
            }
            return;
        }

        let toolCalled = false;

        const reply = await ChatAiService.generateResponse({
            message: 'はい、削除してください',
            apiKey: 'not-needed',
            systemPrompt: 'あなたは優秀なアシスタントです。',
            model: 'qwen3.5-9b-uncensored-hauhaucs-aggressive',
            engine: 'lmstudio',
            lmstudioEndpoint: lmstudioEndpoint,
            tools: {},
            // 履歴に「削除して」「本当に削除しますか？」が入っている
            history: [
                { sender: 'user', text: 'タスクID task_123 を削除して' },
                { sender: 'assistant', text: 'タスクID task_123 を削除してもいいですか？' }
            ],
            onToolExecute: async (toolName, args) => {
                console.log(`[Real Test onToolExecute] Intercepted tool: ${toolName}`, args);
                if (toolName === 'manageTasks' && args.action === 'delete') {
                    toolCalled = true;
                    expect(args.id).toBe('task_123');
                    return JSON.stringify({
                        success: true,
                        message: 'タスクを削除しました。'
                    });
                }
                return null;
            }
        });

        console.log('[Real Test Result Reply (Confirm Flow)]:', reply);
        expect(toolCalled).toBe(true);
        expect(reply).toBeTruthy();
    }, 60000);
});
