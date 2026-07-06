import { describe, it, expect } from 'vitest';
import { ChatAiService } from '../utils/chat-ai-service';

describe('ChatAiService の LM Studio 実機統合テスト (Mockなし)', () => {
    // LM Studio のエンドポイント (環境変数から取得、デフォルトは http://localhost:1234/v1)
    const lmstudioEndpoint = process.env.TEST_LMSTUDIO_ENDPOINT || 'http://localhost:1234/v1';

    // 実際に接続可能かどうかを判定し、接続できない場合はテストをスキップする
    const checkConnection = async (): Promise<boolean> => {
        try {
            const res = await fetch(`${lmstudioEndpoint}/models`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json();
                console.log('[Real Test] Available models in LM Studio:', data);
                return true;
            }
            return false;
        } catch (e) {
            console.warn(`[Real Test] LM Studio is not running at ${lmstudioEndpoint}. Skipping real connection test.`);
            return false;
        }
    };

    it('generateResponse_実機接続_予定の問い合わせに対してツールを実行し結果を踏まえた回答を返すこと', async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            // LM Studio が起動していない場合はテストをスキップ
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
                if (toolName === 'searchTasks') {
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
        if (!isConnected) return;

        let toolCalled = false;

        const reply = await ChatAiService.generateResponse({
            message: '「牛乳を買う」というタスクを追加して',
            apiKey: 'not-needed',
            systemPrompt: 'あなたは優秀なアシスタントです。',
            model: 'qwen3.5-9b-uncensored-hauhaucs-aggressive',
            engine: 'lmstudio',
            lmstudioEndpoint: lmstudioEndpoint,
            tools: {},
            onToolExecute: async (toolName, args) => {
                console.log(`[Real Test onToolExecute] Intercepted tool: ${toolName}`, args);
                if (toolName === 'addTask') {
                    toolCalled = true;
                    return JSON.stringify({
                        success: true,
                        message: 'タスク「牛乳を買う」を追加しました。'
                    });
                }
                return null;
            }
        });

        console.log('[Real Test Result Reply (Add)]:', reply);
        expect(toolCalled).toBe(true);
        expect(reply).toBeTruthy();
    }, 60000);

    it('generateResponse_実機接続_タスク更新の指示に対してupdateTaskツールを呼び出すこと', async () => {
        const isConnected = await checkConnection();
        if (!isConnected) return;

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
                if (toolName === 'updateTask') {
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
        if (!isConnected) return;

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
                if (toolName === 'deleteTask') {
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
});
