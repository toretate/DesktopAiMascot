import { describe, test, expect, vi, beforeEach } from 'vitest';
import { IrodoriTtsConnector, IrodoriTtsSpeechInputParam } from '../irodori-tts';

const USE_REAL_TTS = process.env.USE_REAL_TTS === 'true';

describe('IrodoriTtsConnector', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    test('synthesize - 正常なパラメータで音声合成リクエストが成功しBase64文字列が返ること', async () => {
        const dummyAudioData = new Uint8Array([1, 2, 3, 4]);
        const mockResponse = {
            ok: true,
            arrayBuffer: async () => dummyAudioData.buffer
        };

        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const params: IrodoriTtsSpeechInputParam = {
            input: 'テストです。',
            model: 'irodori-tts',
            voice: 'none'
        };

        const result = await IrodoriTtsConnector.synthesize(params, undefined, 'http://127.0.0.1:8088');

        // APIリクエストの検証
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8088/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'irodori-tts',
                input: 'テストです。',
                voice: 'none',
                response_format: 'mp3'
            })
        });

        // 戻り値の検証 (btoa("String.fromCharCode(1, 2, 3, 4)") -> AQIDBA==)
        expect(result).toBe('AQIDBA==');
    });

    test('synthesize - 感情パラメータ（happy）がある場合に絵文字が付与されること', async () => {
        const dummyAudioData = new Uint8Array([0]);
        const mockResponse = {
            ok: true,
            arrayBuffer: async () => dummyAudioData.buffer
        };

        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const params: IrodoriTtsSpeechInputParam = {
            input: 'こんにちは',
            model: 'irodori-tts',
            voice: 'none'
        };

        await IrodoriTtsConnector.synthesize(params, 'happy', 'http://127.0.0.1:8088');

        // 送信データに絵文字が付与されていることの検証
        const callArgs = fetchMock.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.input).toBe('こんにちは 😊');
    });

    test('synthesize - モデル名が irodori-tts-500m-v3 の場合に irodori-tts に自動変換されること', async () => {
        const dummyAudioData = new Uint8Array([0]);
        const mockResponse = {
            ok: true,
            arrayBuffer: async () => dummyAudioData.buffer
        };

        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const params: IrodoriTtsSpeechInputParam = {
            input: 'こんにちは',
            model: 'irodori-tts-500m-v3',
            voice: 'none'
        };

        await IrodoriTtsConnector.synthesize(params, undefined, 'http://127.0.0.1:8088');

        // モデル名が自動変換されていることの検証
        const callArgs = fetchMock.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.model).toBe('irodori-tts');
    });

    test('synthesize - 接続エラー時に null を返すこと', async () => {
        const mockResponse = {
            ok: false,
            status: 400
        };

        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const params: IrodoriTtsSpeechInputParam = {
            input: 'エラーテスト',
            model: 'irodori-tts',
            voice: 'none'
        };

        const result = await IrodoriTtsConnector.synthesize(params, undefined, 'http://127.0.0.1:8088');

        expect(result).toBeNull();
    });

    test('synthesize - 実際のTTSサーバーに接続して音声が取得できること', async () => {
        if (!USE_REAL_TTS) {
            console.log('[IrodoriTTS Integration Test] USE_REAL_TTSがfalseのため、実際の接続テストをスキップします。');
            return;
        }

        const testVoice = process.env.TEST_TTS_VOICE || 'miyako';
        console.log(`[IrodoriTTS Integration Test] 実際のTTSサーバーに接続してテストします... (Voice: ${testVoice})`);

        const params: IrodoriTtsSpeechInputParam = {
            input: 'テスト音声合成です。',
            model: 'irodori-tts',
            voice: testVoice
        };

        const result = await IrodoriTtsConnector.synthesize(params, 'neutral', 'http://127.0.0.1:8088');

        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
        expect(result!.length).toBeGreaterThan(0);
        console.log(`[IrodoriTTS Integration Test] 音声取得成功: ${result!.length} 文字 (Base64)`);
    }, 30000);

    test('health - 正常に応答（status 200）した時に true を返すこと', async () => {
        const mockResponse = {
            ok: true
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await IrodoriTtsConnector.health('http://127.0.0.1:8088');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8088/health', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        expect(result).toBe(true);
    });

    test('health - 異常応答（status 500）した時に false を返すこと', async () => {
        const mockResponse = {
            ok: false
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await IrodoriTtsConnector.health('http://127.0.0.1:8088');
        expect(result).toBe(false);
    });

    test('models - 正常に応答（status 200）した時に IrodoriTtsModelResult をパースして返すこと', async () => {
        const dummyModelsData = {
            object: "list",
            data: [
                {
                    id: "irodori-tts",
                    object: "model",
                    created: 123456,
                    owned_by: "irodori-tts"
                }
            ]
        };
        const mockResponse = {
            ok: true,
            json: async () => dummyModelsData
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await IrodoriTtsConnector.models('http://127.0.0.1:8088');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8088/v1/models', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        expect(result).toEqual(dummyModelsData);
    });

    test('models - 異常応答した時に null を返すこと', async () => {
        const mockResponse = {
            ok: false
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await IrodoriTtsConnector.models('http://127.0.0.1:8088');
        expect(result).toBeNull();
    });

    test('health & models - 実際のTTSサーバーに接続してデータが取得できること', async () => {
        if (!USE_REAL_TTS) {
            console.log('[IrodoriTTS Integration Test] USE_REAL_TTSがfalseのため、実際の接続テストをスキップします。');
            return;
        }

        console.log('[IrodoriTTS Integration Test] health / models 実際の接続テストを実行します...');
        const healthOk = await IrodoriTtsConnector.health('http://127.0.0.1:8088');
        expect(healthOk).toBe(true);

        const modelsData = await IrodoriTtsConnector.models('http://127.0.0.1:8088');
        expect(modelsData).not.toBeNull();
        expect(modelsData!.object).toBe('list');
        expect(Array.isArray(modelsData!.data)).toBe(true);
        console.log('[IrodoriTTS Integration Test] 取得モデル名:', modelsData!.data.map(m => m.id).join(', '));
    }, 10000);

    test('listVoices - 正常に応答（status 200）した時に IrodoriTtsVoicesResult をパースして返すこと', async () => {
        const dummyVoicesData = {
            object: "list",
            data: [
                { id: "default", object: "voice", ref_wav: "voices/default.wav", ref_latent: null, no_ref: false },
                { id: "miyako", object: "voice", ref_wav: "voices/miyako.wav", ref_latent: null, no_ref: false }
            ]
        };
        const mockResponse = {
            ok: true,
            json: async () => dummyVoicesData
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await IrodoriTtsConnector.listVoices('http://127.0.0.1:8088');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8088/v1/audio/voices', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        expect(result).toEqual(dummyVoicesData);
    });

    test('listVoices - 異常応答した時に null を返すこと', async () => {
        const mockResponse = {
            ok: false
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await IrodoriTtsConnector.listVoices('http://127.0.0.1:8088');
        expect(result).toBeNull();
    });

    test('uploadVoice - 正常に応答（status 200）した時に IrodoriTtsUploadVoiceResult をパースして返すこと', async () => {
        const dummyUploadData = {
            id: 'test_voice',
            object: 'voice_file',
            filename: 'test_voice.wav',
            bytes: 4,
            created_at: 123456
        };
        const mockResponse = {
            ok: true,
            json: async () => dummyUploadData
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const dummyFile = new Blob([new Uint8Array([0, 0, 0, 0])], { type: 'audio/wav' });
        const result = await IrodoriTtsConnector.uploadVoice('http://127.0.0.1:8088', dummyFile, 'test_voice');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const callArgs = fetchMock.mock.calls[0];
        expect(callArgs[0]).toBe('http://127.0.0.1:8088/v1/audio/voices');
        expect(callArgs[1].method).toBe('POST');
        expect(callArgs[1].body).toBeInstanceOf(FormData);
        expect(result).toEqual(dummyUploadData);
    });

    test('uploadVoice - 異常応答した時に null を返すこと', async () => {
        const mockResponse = {
            ok: false
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const dummyFile = new Blob([new Uint8Array([0, 0, 0, 0])], { type: 'audio/wav' });
        const result = await IrodoriTtsConnector.uploadVoice('http://127.0.0.1:8088', dummyFile, 'test_voice');
        expect(result).toBeNull();
    });

    test('listVoices & uploadVoice - 実際のTTSサーバーに接続してデータが取得・送信できること', async () => {
        if (!USE_REAL_TTS) {
            console.log('[IrodoriTTS Integration Test] USE_REAL_TTSがfalseのため、実際の接続テストをスキップします。');
            return;
        }

        console.log('[IrodoriTTS Integration Test] listVoices 実際の接続テストを実行します...');
        const voicesData = await IrodoriTtsConnector.listVoices('http://127.0.0.1:8088');
        expect(voicesData).not.toBeNull();
        expect(Array.isArray(voicesData!.data)).toBe(true);
        console.log('[IrodoriTTS Integration Test] 取得ボイス一覧:', voicesData!.data.map(v => v.id).join(', '));

        console.log('[IrodoriTTS Integration Test] uploadVoice 実際の接続テストを実行します...');
        // テスト用のダミー音声ファイル (wav形式の非常に小さなダミーヘッダー)
        const wavHeader = new Uint8Array([
            82, 73, 70, 70, // "RIFF"
            36, 0, 0, 0,    // chunk size
            87, 65, 86, 69, // "WAVE"
            102, 109, 116, 32, // "fmt "
            16, 0, 0, 0,    // subchunk size
            1, 0,           // audio format (PCM)
            1, 0,           // num channels (1)
            68, 172, 0, 0,  // sample rate (44100)
            136, 88, 1, 0,  // byte rate
            2, 0,           // block align
            16, 0,          // bits per sample
            100, 97, 116, 97, // "data"
            0, 0, 0, 0      // data chunk size
        ]);
        const dummyFile = new Blob([wavHeader], { type: 'audio/wav' });
        const voiceId = `test_integration_voice_${Date.now()}`;

        const uploadResult = await IrodoriTtsConnector.uploadVoice('http://127.0.0.1:8088', dummyFile, voiceId);
        expect(uploadResult).not.toBeNull();
        expect(uploadResult!.id).toBe(voiceId);
        console.log(`[IrodoriTTS Integration Test] ボイスアップロード成功: ${uploadResult!.id}`);
    }, 15000);
});
