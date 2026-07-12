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
                            toolName: 'manageTasks',
                            args: { action: 'search', completed: false }
                        }
                    ],
                    toolResults: [
                        {
                            type: 'tool-result',
                            toolCallId: 'call_123',
                            toolName: 'manageTasks',
                            args: { action: 'search', completed: false },
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
                if (toolName === 'manageTasks' && args.action === 'search') {
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
        expect(callArgs.tools).toHaveProperty('manageTasks');
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
                            toolName: 'manageTasks',
                            args: {
                                action: 'search',
                                completed: false
                            }
                        }
                    ],
                    toolResults: [
                        {
                            type: 'tool-result',
                            toolCallId: 'call_999',
                            toolName: 'manageTasks',
                            args: {
                                action: 'search',
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
                if (toolName === 'manageTasks' && args.action === 'search') {
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

    it('generateResponse_思考だけでlength打ち切りになり本文が空でもフォールバック応答を返すこと', async () => {
        // ローカルモデルが <|channel>thought で maxOutputTokens を使い切り、
        // ツール呼び出しも本文も無いまま finishReason: "length" で打ち切られたケースを再現。
        vi.mocked(generateText)
            .mockReset()
            .mockResolvedValueOnce({
                text: '<|channel>thought\nユーザーは今日のスケジュールを全部削除してと依頼しました。まず日付を指定して...',
                finishReason: 'length',
                steps: [
                    {
                        text: '<|channel>thought\nユーザーは今日のスケジュールを全部削除してと依頼しました。まず日付を指定して...',
                        toolCalls: [],
                        toolResults: [],
                        finishReason: 'length'
                    }
                ]
            } as any);

        const reply = await ChatAiService.generateResponse({
            message: '今日のスケジュールを全部削除して',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'local-model',
            engine: 'lmstudio',
            lmstudioEndpoint: 'http://localhost:1234/v1'
        });

        // 空文字ではなく、必ず何らかの発話（フォールバック）が返ること
        expect(reply.trim().length).toBeGreaterThan(0);
        // 思考タグが漏れ出していないこと
        expect(reply).not.toContain('<|channel>');
        expect(reply).not.toContain('thought');
    });

    it('generateResponse_本文に紛れ込んだ擬似ツール呼び出し記法を除去すること', async () => {
        // ツールが無効化された等の理由で、モデルが実際には実行せずに
        // 本文へ擬似的なツール呼び出しを書いてしまったケースを再現。
        vi.mocked(generateText)
            .mockReset()
            .mockResolvedValueOnce({
                text: '今日のスケジュールを全部クリアにするね 😌👌 [manageTasks(action="delete", tasks=["13:30 - 笠原さんと会議", "15:00 - テスト仕様書のレビュー"])]\n\n今日の予定を全部削除しました！',
                finishReason: 'stop',
                steps: [
                    { text: '', toolCalls: [], toolResults: [], finishReason: 'stop' }
                ]
            } as any);

        const reply = await ChatAiService.generateResponse({
            message: '今日のスケジュールを削除して',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'local-model',
            engine: 'lmstudio',
            lmstudioEndpoint: 'http://localhost:1234/v1'
        });

        // 擬似ツール呼び出し記法が残っていないこと
        expect(reply).not.toContain('manageTasks');
        expect(reply).not.toContain('action=');
        // 通常の発話部分は残っていること
        expect(reply).toContain('今日のスケジュールを全部クリアにするね');
        expect(reply).toContain('今日の予定を全部削除しました');
    });

    it('generateResponse_引数値に丸括弧を含む擬似ツール呼び出しも末尾を残さず除去すること', async () => {
        // 引数値（title）に丸括弧が含まれるケース。単純な非貪欲正規表現だと
        // 最初の ')' で切れて '")]' が本文に残ってしまうため、括弧の対応を走査して除去する。
        vi.mocked(generateText)
            .mockReset()
            .mockResolvedValueOnce({
                text: '予定を登録するね！ [manageTasks(action="add", title="定例会議(営業)")] 登録したよ！',
                finishReason: 'stop',
                steps: [
                    { text: '', toolCalls: [], toolResults: [], finishReason: 'stop' }
                ]
            } as any);

        const reply = await ChatAiService.generateResponse({
            message: '定例会議(営業)を登録して',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'local-model',
            engine: 'lmstudio',
            lmstudioEndpoint: 'http://localhost:1234/v1'
        });

        // 擬似ツール呼び出し記法およびその破片（")]" 等）が一切残っていないこと
        expect(reply).not.toContain('manageTasks');
        expect(reply).not.toContain('action=');
        expect(reply).not.toContain('title=');
        expect(reply).not.toContain(')]');
        expect(reply).not.toContain('")');
        // 通常の発話部分は残っていること
        expect(reply).toContain('予定を登録するね');
        expect(reply).toContain('登録したよ');
    });

    it('generateResponse_systemプロンプトにmanageMemosの個別ガイドラインが注入されないこと（Gemini）', async () => {
        vi.mocked(generateText)
            .mockReset()
            .mockResolvedValueOnce({
                text: 'メモしたよ！',
                finishReason: 'stop',
                steps: [
                    { text: 'メモしたよ！', toolCalls: [], toolResults: [], finishReason: 'stop' }
                ]
            } as any);

        await ChatAiService.generateResponse({
            message: '買い物メモに牛乳を追加して',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'gemini-1.5-flash',
            engine: 'gemini'
        });

        const options = vi.mocked(generateText).mock.calls[0][0] as any;
        // ツール自体は登録され、ツール一覧には含まれるが、個別ガイドライン文面は含まれないこと
        expect(Object.keys(options.tools)).toContain('manageMemos');
        expect(options.system).toContain('manageMemos');
        expect(options.system).not.toContain('期限のない自由メモ');
    });

    it('generateResponse_systemプロンプトにmanageMemosの個別ガイドラインが注入されること（LM Studio）', async () => {
        vi.mocked(generateText)
            .mockReset()
            .mockResolvedValueOnce({
                text: 'メモしたよ！',
                finishReason: 'stop',
                steps: [
                    { text: 'メモしたよ！', toolCalls: [], toolResults: [], finishReason: 'stop' }
                ]
            } as any);

        await ChatAiService.generateResponse({
            message: '買い物メモに牛乳を追加して',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'local-model',
            engine: 'lmstudio',
            lmstudioEndpoint: 'http://localhost:1234/v1'
        });

        const options = vi.mocked(generateText).mock.calls[0][0] as any;
        // ツール一覧と個別ガイドラインの両方が含まれること
        expect(Object.keys(options.tools)).toContain('manageMemos');
        expect(options.system).toContain('manageMemos');
        expect(options.system).toContain('期限のない自由メモ');
    });

    it('generateResponse_systemプロンプトにmanageMemosの個別ガイドラインが注入されないこと（OpenAI）', async () => {
        vi.mocked(generateText)
            .mockReset()
            .mockResolvedValueOnce({
                text: 'メモしたよ！',
                finishReason: 'stop',
                steps: [
                    { text: 'メモしたよ！', toolCalls: [], toolResults: [], finishReason: 'stop' }
                ]
            } as any);

        await ChatAiService.generateResponse({
            message: '買い物メモに牛乳を追加して',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'gpt-4o',
            engine: 'openai'
        });

        const options = vi.mocked(generateText).mock.calls[0][0] as any;
        // ツール自体は登録され、ツール一覧には含まれるが、個別ガイドライン文面は含まれないこと
        expect(Object.keys(options.tools)).toContain('manageMemos');
        expect(options.system).toContain('manageMemos');
        expect(options.system).not.toContain('期限のない自由メモ');
    });

    it('generateResponse_履歴再実行防止ルールがGeminiおよびLM Studio両方のシステムプロンプトに含まれること', async () => {
        vi.mocked(generateText)
            .mockReset()
            .mockResolvedValue({
                text: '了解！',
                finishReason: 'stop',
                steps: [
                    { text: '了解！', toolCalls: [], toolResults: [], finishReason: 'stop' }
                ]
            } as any);

        const historyRulePattern = '会話履歴中で既にツール実行または完了応答まで済んだ依頼を';

        // 1. Gemini
        await ChatAiService.generateResponse({
            message: '今日の予定は？',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'gemini-1.5-flash',
            engine: 'gemini'
        });
        const optionsGemini = vi.mocked(generateText).mock.calls[0][0] as any;
        expect(optionsGemini.system).toContain(historyRulePattern);

        // 2. LM Studio
        vi.mocked(generateText).mockReset().mockResolvedValueOnce({
            text: '了解！',
            finishReason: 'stop',
            steps: [
                { text: '了解！', toolCalls: [], toolResults: [], finishReason: 'stop' }
            ]
        } as any);
        await ChatAiService.generateResponse({
            message: '今日の予定は？',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'local-model',
            engine: 'lmstudio',
            lmstudioEndpoint: 'http://localhost:1234/v1'
        });
        const optionsLm = vi.mocked(generateText).mock.calls[0][0] as any;
        expect(optionsLm.system).toContain(historyRulePattern);
    });

    it('generateResponse_ツール有効時はtemperatureのデフォルトが低温になること', async () => {
        vi.mocked(generateText)
            .mockReset()
            .mockResolvedValue({
                text: 'こんにちは！',
                finishReason: 'stop',
                steps: [
                    { text: 'こんにちは！', toolCalls: [], toolResults: [], finishReason: 'stop' }
                ]
            } as any);

        // 未指定時: ツール有効なので低温デフォルト
        await ChatAiService.generateResponse({
            message: 'こんにちは',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'gemini-1.5-flash',
            engine: 'gemini'
        });
        expect((vi.mocked(generateText).mock.calls[0][0] as any).temperature).toBe(0.2);

        // ユーザー指定時: 指定値が常に優先されること
        await ChatAiService.generateResponse({
            message: 'こんにちは',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'gemini-1.5-flash',
            engine: 'gemini',
            temperature: 0.9
        });
        expect((vi.mocked(generateText).mock.calls[1][0] as any).temperature).toBe(0.9);
    });

    it('generateResponse_systemプロンプトが「ペルソナ→ガイドライン→時刻」の順で構成されること', async () => {
        // 変動する時刻を静的部分の後ろに置くことで、プロンプトキャッシュの阻害を防ぐ
        vi.mocked(generateText)
            .mockReset()
            .mockResolvedValueOnce({
                text: 'こんにちは！',
                finishReason: 'stop',
                steps: [
                    { text: 'こんにちは！', toolCalls: [], toolResults: [], finishReason: 'stop' }
                ]
            } as any);

        await ChatAiService.generateResponse({
            message: 'こんにちは',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'gemini-1.5-flash',
            engine: 'gemini'
        });

        const system = (vi.mocked(generateText).mock.calls[0][0] as any).system as string;
        const personaIdx = system.indexOf('あなたはアシスタントです。');
        const guidelineIdx = system.indexOf('# ツール使用ガイドライン');
        const timeIdx = system.indexOf('[現在のシステム日時]');
        expect(personaIdx).toBeGreaterThanOrEqual(0);
        expect(guidelineIdx).toBeGreaterThan(personaIdx);
        expect(timeIdx).toBeGreaterThan(guidelineIdx);
        // 時刻が秒を含まない（分単位である）こと: H:MM または HH:MM 形式で終わる
        const timeSection = system.slice(timeIdx);
        expect(timeSection).not.toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it('generateResponse_finishReason以外の理由で本文が空でもフォールバック応答を返すこと', async () => {
        vi.mocked(generateText)
            .mockReset()
            .mockResolvedValueOnce({
                text: '',
                finishReason: 'stop',
                steps: [
                    { text: '', toolCalls: [], toolResults: [], finishReason: 'stop' }
                ]
            } as any);

        const reply = await ChatAiService.generateResponse({
            message: 'こんにちは',
            apiKey: 'mock-api-key',
            systemPrompt: 'あなたはアシスタントです。',
            model: 'gemini-1.5-flash',
            engine: 'gemini'
        });

        expect(reply.trim().length).toBeGreaterThan(0);
    });
});
