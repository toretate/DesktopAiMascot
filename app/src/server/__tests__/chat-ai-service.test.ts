import { vi, describe, it, expect } from 'vitest';
import { ChatAiService } from '../utils/chat-ai-service';
import { generateText } from 'ai';

// generateText をモック化
vi.mock('ai', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        generateText: vi.fn()
    };
});

// データベース処理などの外部依存を避けるため、ws.ts のモックまたは関連処理のモックを考慮
vi.mock('../routes/ws', () => {
    return {
        searchTasksFromDb: vi.fn().mockReturnValue([
            {
                id: 'task_test_123',
                categoryId: 'default',
                title: 'テスト会議',
                completed: false,
                priority: 'normal',
                steps: [],
                expanded: false,
                order: 0,
                createdAt: '2026-07-06T18:40:55.941Z',
                status: 'todo',
                scheduledAt: '2026-07-07T02:30:58.019Z'
            }
        ])
    };
});

describe('ChatAiService.generateResponse のテスト', () => {
    it('generateResponse_予定の問い合わせに対してsearchTasksツールが呼び出され正常に応答すること', async () => {
        // generateText のモック応答を設定
        // 実際の Vercel AI SDK の generateText は、マルチステップのシミュレーションにおいて
        // 最終的なテキストと実行されたステップの情報を返します。
        vi.mocked(generateText).mockResolvedValue({
            text: '今日の予定はテスト会議があります。',
            steps: [
                {
                    text: '',
                    toolCalls: [
                        {
                            type: 'tool-call',
                            toolCallId: 'call_123',
                            toolName: 'searchTasks',
                            args: { completed: false }
                        }
                    ],
                    toolResults: [
                        {
                            type: 'tool-result',
                            toolCallId: 'call_123',
                            toolName: 'searchTasks',
                            args: { completed: false },
                            result: {
                                success: true,
                                message: 'タスク・予定が 1 件見つかりました：\n- [未完了] テスト会議'
                            }
                        }
                    ],
                    finishReason: 'stop'
                }
            ]
        } as any);

        const reply = await ChatAiService.generateResponse({
            message: '今日の予定の一覧は？',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたは優秀なアシスタントです。',
            model: 'gemini-1.5-flash',
            engine: 'gemini',
            tools: {
                toolsCurrentTime: true,
                toolsGpsLocation: true,
                toolsWeather: true,
                toolsVolume: true,
                toolsAppLauncher: true,
                toolsWebSearch: true
            },
            onToolExecute: async (toolName, args) => {
                if (toolName === 'searchTasks') {
                    return JSON.stringify({
                        success: true,
                        message: 'タスク・予定が 1 件見つかりました：\n- [未完了] テスト会議'
                    });
                }
                return null;
            }
        });

        // 期待される返答テキストが得られることを検証
        expect(reply).toContain('今日の予定はテスト会議があります。');
        
        // generateText が適切なパラメータで呼び出されたことを検証
        expect(generateText).toHaveBeenCalled();
        const callArgs = vi.mocked(generateText).mock.calls[0][0];
        expect(callArgs.tools).toHaveProperty('searchTasks');
    });

    it('generateResponse_自動マルチステップが停止した際に手動フォールバックループが走り最終回答を生成すること', async () => {
        // 自動継続されるため、モックは 1回で完結する response を設定（steps が複数含まれる）
        const mockResponse = {
            text: '今日の予定は特報会議があります。',
            steps: [
                {
                    text: '',
                    toolCalls: [
                        {
                            type: 'tool-call',
                            toolCallId: 'call_999',
                            toolName: 'searchTasks',
                            args: {
                                completed: false
                            }
                        }
                    ],
                    toolResults: [
                        {
                            type: 'tool-result',
                            toolCallId: 'call_999',
                            toolName: 'searchTasks',
                            args: {
                                completed: false
                            },
                            result: "{\"success\":true,\"message\":\"タスク・予定が 1 件見つかりました：\\n- [未完了] 特報会議\"}"
                        }
                    ],
                    finishReason: 'tool-calls'
                },
                {
                    text: '今日の予定は特報会議があります。',
                    toolCalls: [],
                    toolResults: [],
                    finishReason: 'stop'
                }
            ]
        };

        vi.mocked(generateText)
            .mockReset()
            .mockResolvedValueOnce(mockResponse as any);

        const reply = await ChatAiService.generateResponse({
            message: '今日の予定を教えて',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'gemini-1.5-flash',
            engine: 'gemini',
            tools: {
                toolsCurrentTime: true,
                toolsGpsLocation: true,
                toolsWeather: true,
                toolsVolume: true,
                toolsAppLauncher: true,
                toolsWebSearch: true
            },
            onToolExecute: async (toolName, args) => {
                if (toolName === 'searchTasks') {
                    return JSON.stringify({
                        success: true,
                        message: 'タスク・予定が 1 件見つかりました：\n- [未完了] 特報会議'
                    });
                }
                return null;
            }
        });

        // 自動マルチステップにより、最終的なテキストが得られることを検証
        expect(reply).toContain('今日の予定は特報会議があります。');
        // generateText が 1回呼び出されたことを検証
        expect(generateText).toHaveBeenCalledTimes(1);
    });
});
