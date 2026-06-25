import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ForgeConnector } from '../forge-connector';

describe('ForgeConnector', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    test('generateImage - 正常に画像が生成されBase64文字列が返ること', async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({
                images: ['mocked_base64_image_data']
            })
        };

        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await ForgeConnector.generateImage({
            prompt: '1girl, anime style',
            steps: 20
        }, 'http://127.0.0.1:5555');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:5555/sdapi/v1/txt2img', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: '1girl, anime style',
                negative_prompt: 'nsfw, low quality, worst quality, deformed, bad anatomy',
                steps: 20,
                width: 1024,
                height: 1024,
                batch_size: 1,
                cfg_scale: 7.0,
                sampler_name: 'Euler a'
            })
        });

        expect(result).toBe('mocked_base64_image_data');
    });

    test('generateImage - 正常に i2i 画像が生成されBase64文字列が返ること', async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({
                images: ['mocked_i2i_base64_image_data']
            })
        };

        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await ForgeConnector.generateImage({
            prompt: 'make it night',
            initImage: 'data:image/png;base64,dummy_input_base64',
            denoisingStrength: 0.6,
            steps: 20
        }, 'http://127.0.0.1:5555');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:5555/sdapi/v1/img2img', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: 'make it night',
                negative_prompt: 'nsfw, low quality, worst quality, deformed, bad anatomy',
                steps: 20,
                width: 1024,
                height: 1024,
                batch_size: 1,
                cfg_scale: 7.0,
                sampler_name: 'Euler a',
                init_images: ['dummy_input_base64'],
                denoising_strength: 0.6
            })
        });

        expect(result).toBe('mocked_i2i_base64_image_data');
    });

    test('generateImage - APIがエラーを返した際に適切な接続エラーを投げること', async () => {
        const mockResponse = {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
        };

        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        await expect(
            ForgeConnector.generateImage({ prompt: 'error test' }, 'http://127.0.0.1:5555')
        ).rejects.toThrow('Stable Diffusion WebUI Forge との接続エラー: Forge API returned status 500: Internal Server Error');
    });

    test('generateImage - APIからの画像レスポンスが空のときにエラーを投げること', async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({
                images: []
            })
        };

        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        await expect(
            ForgeConnector.generateImage({ prompt: 'empty test' }, 'http://127.0.0.1:5555')
        ).rejects.toThrow('Stable Diffusion WebUI Forge との接続エラー: Forge API returned no images');
    });

    test('health - 接続可能な場合に true を返すこと', async () => {
        const mockResponse = {
            ok: true
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await ForgeConnector.health('http://127.0.0.1:5555');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:5555/sdapi/v1/sd-models', {
            method: 'GET'
        });
        expect(result).toBe(true);
    });

    test('health - 接続エラー時に false を返すこと', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('Connection timed out'));
        vi.stubGlobal('fetch', fetchMock);

        const result = await ForgeConnector.health('http://127.0.0.1:5555');
        expect(result).toBe(false);
    });

    test('models - 正常に応答した時にモデル名の配列を返すこと', async () => {
        const mockResponse = {
            ok: true,
            json: async () => [
                { title: 'sdxl_model_v1.safetensors [hash]', model_name: 'sdxl_model_v1' },
                { title: 'sd_model_v2.safetensors [hash]', model_name: 'sd_model_v2' }
            ]
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await ForgeConnector.models('http://127.0.0.1:5555');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:5555/sdapi/v1/sd-models', {
            method: 'GET'
        });
        expect(result).toEqual([
            'sdxl_model_v1.safetensors [hash]',
            'sd_model_v2.safetensors [hash]'
        ]);
    });

    test('models - 異常応答した時に空配列を返すこと', async () => {
        const mockResponse = {
            ok: false
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await ForgeConnector.models('http://127.0.0.1:5555');
        expect(result).toEqual([]);
    });

    test('loras - 正常に応答した時にLoRA名の配列を返すこと', async () => {
        const mockResponse = {
            ok: true,
            json: async () => [
                { name: 'lora_detailed_anime', alias: 'detailed_anime', path: 'loras/1.safetensors' },
                { name: 'lora_outfit_v1', alias: 'outfit_v1', path: 'loras/2.safetensors' }
            ]
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await ForgeConnector.loras('http://127.0.0.1:5555');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:5555/sdapi/v1/loras', {
            method: 'GET'
        });
        expect(result).toEqual(['lora_detailed_anime', 'lora_outfit_v1']);
    });

    test('loras - 異常応答した時に空配列を返すこと', async () => {
        const mockResponse = {
            ok: false
        };
        const fetchMock = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('fetch', fetchMock);

        const result = await ForgeConnector.loras('http://127.0.0.1:5555');
        expect(result).toEqual([]);
    });
});
