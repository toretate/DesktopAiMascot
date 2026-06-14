// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { getSdkEndpoint, LmStudioConnector } from '../lmstudio-connector';

const USE_REAL_LMSTUDIO = process.env.USE_REAL_LMSTUDIO === 'true';

// LMStudioClient のモック化
vi.mock('@lmstudio/sdk', async (importOriginal) => {
    const original = await importOriginal<typeof import('@lmstudio/sdk')>();
    if (process.env.USE_REAL_LMSTUDIO === 'true') {
        return original;
    }

    const mockRespond = vi.fn().mockResolvedValue({
        content: 'こんにちは！テストレスポンスです。'
    } as any);
    const mockModel = vi.fn().mockResolvedValue({
        respond: mockRespond
    });
    const mockListDownloaded = vi.fn().mockResolvedValue([
        {
            type: 'llm',
            modelKey: 'mock-model-1',
            vision: true,
            trainedForToolUse: false,
            reasoning: true
        },
        {
            type: 'embedding',
            modelKey: 'mock-embedding-1',
            vision: false,
            trainedForToolUse: false
        }
    ]);

    const LMStudioClientMock = vi.fn().mockImplementation(() => {
        return {
            llm: {
                model: mockModel
            },
            system: {
                listDownloadedModels: mockListDownloaded
            }
        };
    });

    return {
        LMStudioClient: LMStudioClientMock
    };
});

describe('getSdkEndpoint', () => {
    test('getSdkEndpoint - エンドポイントが空の場合にデフォルト値が返ること', () => {
        expect(getSdkEndpoint('')).toBe('ws://127.0.0.1:1234');
        expect(getSdkEndpoint('   ')).toBe('ws://127.0.0.1:1234');
    });

    test('getSdkEndpoint - http:// が ws:// に変換されること', () => {
        expect(getSdkEndpoint('http://localhost:1234')).toBe('ws://localhost:1234');
    });

    test('getSdkEndpoint - https:// が wss:// に変換されること', () => {
        expect(getSdkEndpoint('https://localhost:1234')).toBe('wss://localhost:1234');
    });

    test('getSdkEndpoint - プロトコルがない場合に ws:// が付与されること', () => {
        expect(getSdkEndpoint('localhost:1234')).toBe('ws://localhost:1234');
    });

    test('getSdkEndpoint - 末尾の /v1 などのパスが正しく除去されること', () => {
        expect(getSdkEndpoint('http://localhost:1234/v1')).toBe('ws://localhost:1234');
        expect(getSdkEndpoint('http://localhost:1234/v1/')).toBe('ws://localhost:1234');
        expect(getSdkEndpoint('http://localhost:1234/api/v1/models')).toBe('ws://localhost:1234');
        expect(getSdkEndpoint('http://localhost:1234/api/v1/models/')).toBe('ws://localhost:1234');
        expect(getSdkEndpoint('http://localhost:1234/')).toBe('ws://localhost:1234');
    });
});

describe('LmStudioConnector', () => {
    beforeEach(async () => {
        if (!USE_REAL_LMSTUDIO) {
            vi.clearAllMocks();
        }
    });

    test('generateResponse - 正常なパラメータでテキスト応答が生成されること', async () => {
        if (USE_REAL_LMSTUDIO) return; // 結合テスト用は別で実行するためスキップ

        const { LMStudioClient } = await import('@lmstudio/sdk');
        const result = await LmStudioConnector.generateResponse({
            message: 'こんにちは',
            systemPrompt: 'あなたは親切なAIです。',
            model: 'mock-model-1',
            endpoint: 'http://localhost:1234'
        });

        expect(result).toBe('こんにちは！テストレスポンスです。');

        const clientInstance = vi.mocked(LMStudioClient).mock.results[0].value;
        expect(clientInstance.llm.model).toHaveBeenCalledWith('mock-model-1');

        const mockModelInstance = await clientInstance.llm.model.mock.results[0].value;
        expect(mockModelInstance.respond).toHaveBeenCalledWith([
            { role: 'system', content: 'あなたは親切なAIです。' },
            { role: 'user', content: 'こんにちは' }
        ]);
    });

    test('generateResponse - 思考プロセスやタグがクレンジングされること', async () => {
        if (USE_REAL_LMSTUDIO) return;

        const { LMStudioClient } = await import('@lmstudio/sdk');
        const clientInstance = new LMStudioClient({ baseUrl: 'ws://localhost:1234' });
        const mockModelInstance = await clientInstance.llm.model('mock-model-1');

        // レスポンスに <think> タグが含まれる場合のモック設定
        vi.mocked(mockModelInstance.respond).mockResolvedValueOnce({
            content: '<think>内部の思考プロセスです。</think>こんにちは！'
        } as any);

        const result1 = await LmStudioConnector.generateResponse({
            message: 'テスト',
            systemPrompt: '',
            model: 'mock-model-1',
            endpoint: 'http://localhost:1234'
        });
        expect(result1).toBe('こんにちは！');

        // レスポンスに <thought> タグが含まれる場合のモック設定
        vi.mocked(mockModelInstance.respond).mockResolvedValueOnce({
            content: '<thought>思考中...</thought>お答えします。'
        } as any);

        const result2 = await LmStudioConnector.generateResponse({
            message: 'テスト',
            systemPrompt: '',
            model: 'mock-model-1',
            endpoint: 'http://localhost:1234'
        });
        expect(result2).toBe('お答えします。');

        // レスポンスに Thinking Process: が含まれる場合のモック設定
        vi.mocked(mockModelInstance.respond).mockResolvedValueOnce({
            content: 'Thinking Process: \n1. 解析\n2. 回答生成\n\nこんにちは！'
        } as any);

        const result3 = await LmStudioConnector.generateResponse({
            message: 'テスト',
            systemPrompt: '',
            model: 'mock-model-1',
            endpoint: 'http://localhost:1234'
        });
        expect(result3).toBe('こんにちは！');
    });

    test('generateResponse - 履歴が正しくマッピングされること', async () => {
        if (USE_REAL_LMSTUDIO) return;

        const { LMStudioClient } = await import('@lmstudio/sdk');
        const history = [
            { sender: 'assistant', text: '最初の無視されるべき会話' },
            { sender: 'user', text: 'ユーザーの最初の会話' },
            { sender: 'assistant', text: 'アシスタントの返答' }
        ];

        await LmStudioConnector.generateResponse({
            message: '次のメッセージ',
            systemPrompt: 'システム',
            model: 'mock-model-1',
            endpoint: 'http://localhost:1234',
            history
        });

        const clientInstance = vi.mocked(LMStudioClient).mock.results[0].value;
        const mockModelInstance = await clientInstance.llm.model.mock.results[0].value;

        expect(mockModelInstance.respond).toHaveBeenCalledWith([
            { role: 'system', content: 'システム' },
            { role: 'user', content: 'ユーザーの最初の会話' },
            { role: 'assistant', content: 'アシスタントの返答' },
            { role: 'user', content: '次のメッセージ' }
        ]);
    });

    test('generateResponse - テキスト添付ファイルがデコードされてメッセージに追加されること', async () => {
        if (USE_REAL_LMSTUDIO) return;

        const { LMStudioClient } = await import('@lmstudio/sdk');
        const textBase64 = Buffer.from('添付テキストの内容です。').toString('base64');
        const attachments = [
            {
                type: 'file',
                name: 'test.txt',
                url: `data:text/plain;base64,${textBase64}`
            }
        ];

        await LmStudioConnector.generateResponse({
            message: 'こんにちは',
            systemPrompt: '',
            model: 'mock-model-1',
            endpoint: 'http://localhost:1234',
            attachments
        });

        const clientInstance = vi.mocked(LMStudioClient).mock.results[0].value;
        const mockModelInstance = await clientInstance.llm.model.mock.results[0].value;

        expect(mockModelInstance.respond).toHaveBeenCalledWith([
            {
                role: 'user',
                content: 'こんにちは\n\n--- 添付ファイル: test.txt ---\n添付テキストの内容です。\n---'
            }
        ]);
    });

    test('generateResponse - 画像添付がある場合にマルチモーダル形式のペイロードが生成されること', async () => {
        if (USE_REAL_LMSTUDIO) return;

        const { LMStudioClient } = await import('@lmstudio/sdk');
        const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const attachments = [
            {
                type: 'image',
                name: 'pixel.png',
                url: `data:image/png;base64,${imageBase64}`
            }
        ];

        await LmStudioConnector.generateResponse({
            message: '画像を見てください',
            systemPrompt: '',
            model: 'mock-model-1',
            endpoint: 'http://localhost:1234',
            attachments
        });

        const clientInstance = vi.mocked(LMStudioClient).mock.results[0].value;
        const mockModelInstance = await clientInstance.llm.model.mock.results[0].value;

        expect(mockModelInstance.respond).toHaveBeenCalledWith([
            {
                role: 'user',
                content: [
                    { type: 'text', text: '画像を見てください' },
                    {
                        type: 'image',
                        image: {
                            base64: imageBase64
                        }
                    }
                ]
            }
        ]);
    });

    test('getModels - モデル一覧が正常に取得できること', async () => {
        if (USE_REAL_LMSTUDIO) return;

        const result = await LmStudioConnector.getModels('http://localhost:1234');

        expect(result.success).toBe(true);
        expect(result.models).toEqual([
            {
                id: 'mock-model-1',
                capabilities: {
                    vision: true,
                    trained_for_tool_use: false,
                    reasoning: true
                }
            }
        ]);
    });

    test('getModels - エラー発生時に success: false とエラーメッセージが返ること', async () => {
        if (USE_REAL_LMSTUDIO) return;

        const { LMStudioClient } = await import('@lmstudio/sdk');
        const clientInstance = new LMStudioClient({ baseUrl: 'ws://localhost:1234' });
        vi.mocked(clientInstance.system.listDownloadedModels).mockRejectedValueOnce(new Error('Connection refused'));

        const result = await LmStudioConnector.getModels('http://localhost:1234');

        expect(result.success).toBe(false);
        expect(result.models).toEqual([]);
        expect(result.error).toContain('LM Studioへの接続に失敗しました。');
    });

    // 実際の LM Studio 接続テスト
    test('getModels & generateResponse - 実際のLM Studioサーバーに接続してデータが取得・送信できること', async () => {
        if (!USE_REAL_LMSTUDIO) {
            console.log('[LMStudio Integration Test] USE_REAL_LMSTUDIOがfalseのため、実際の接続テストをスキップします。');
            return;
        }

        const endpoint = process.env.TEST_LMSTUDIO_ENDPOINT || 'http://127.0.0.1:1234';
        console.log(`[LMStudio Integration Test] 実際のLM Studioに接続してテストします... (Endpoint: ${endpoint})`);

        // 1. モデル一覧取得テスト
        const modelsResult = await LmStudioConnector.getModels(endpoint);
        expect(modelsResult.success).toBe(true);
        expect(Array.isArray(modelsResult.models)).toBe(true);
        console.log(`[LMStudio Integration Test] 取得モデル数: ${modelsResult.models.length}`);

        if (modelsResult.models.length === 0) {
            console.log('[LMStudio Integration Test] ロードされているモデルがないため、応答生成テストをスキップします。');
            return;
        }

        const activeModel = modelsResult.models[0].id;
        console.log(`[LMStudio Integration Test] 使用モデル: ${activeModel}`);

        // 2. 応答生成テスト
        const responseText = await LmStudioConnector.generateResponse({
            message: 'Hello, testing connection. Reply with "OK".',
            systemPrompt: 'You are a test assistant.',
            model: activeModel,
            endpoint: endpoint
        });

        expect(responseText).not.toBeNull();
        expect(typeof responseText).toBe('string');
        expect(responseText.length).toBeGreaterThan(0);
        console.log(`[LMStudio Integration Test] レスポンス内容: ${responseText}`);
    }, 30000);
});

