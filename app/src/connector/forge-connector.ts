export interface ForgeGenerateParams {
    prompt: string;
    negativePrompt?: string;
    steps?: number;
    width?: number;
    height?: number;
    cfgScale?: number;
    samplerName?: string;
    modelCheckpoint?: string;
    initImage?: string; // i2i用の元画像 (Base64データ、data:image/png;base64,...プレフィックスは除いた純粋なデータ)
    denoisingStrength?: number; // i2i用のノイズ除去強度
}

/**
 * Stable Diffusion WebUI Forge を使用して画像を生成するコネクタ
 */
export class ForgeConnector {
    /**
     * 画像を生成する (t2i または i2i)
     * @param params 生成パラメータ
     * @param host Forgeサーバーのホスト（例: http://127.0.0.1:5555）
     * @returns 生成された画像のBase64文字列（純粋なBase64データ）
     */
    static async generateImage(params: ForgeGenerateParams, host: string = 'http://127.0.0.1:5555'): Promise<string> {
        const isImg2Img = !!params.initImage;
        const endpoint = isImg2Img ? 'img2img' : 'txt2img';
        const url = `${host}/sdapi/v1/${endpoint}`;
        
        const payload: any = {
            prompt: params.prompt,
            negative_prompt: params.negativePrompt || 'nsfw, low quality, worst quality, deformed, bad anatomy',
            steps: params.steps ?? 25,
            width: params.width ?? 1024,
            height: params.height ?? 1024,
            batch_size: 1,
            cfg_scale: params.cfgScale ?? 7.0,
            sampler_name: params.samplerName ?? 'Euler a'
        };

        if (isImg2Img) {
            // data url プレフィックスがある場合は純粋な Base64 部のみを取り出す
            let rawBase64 = params.initImage!;
            if (rawBase64.startsWith('data:')) {
                rawBase64 = rawBase64.split(',')[1] || rawBase64;
            }
            payload.init_images = [rawBase64];
            payload.denoising_strength = params.denoisingStrength ?? 0.7;
        }

        if (params.modelCheckpoint) {
            payload.override_settings = {
                sd_model_checkpoint: params.modelCheckpoint
            };
        }

        console.log(`[ForgeConnector] Sending request to ${url} ...`);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Forge API returned status ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as { images?: string[] };
            if (!data.images || data.images.length === 0) {
                throw new Error('Forge API returned no images');
            }

            return data.images[0];
        } catch (error: any) {
            console.error('[ForgeConnector] Connection error:', error);
            throw new Error(`Stable Diffusion WebUI Forge との接続エラー: ${error.message}`);
        }
    }

    /**
     * サーバーの稼働状態（ヘルスチェック）を確認する
     * @param host Forgeサーバーのホスト
     * @returns 接続可能な場合は true
     */
    static async health(host: string = 'http://127.0.0.1:5555'): Promise<boolean> {
        const url = `${host}/sdapi/v1/sd-models`; // ヘルスチェック用エンドポイントとしてモデル取得を代用
        try {
            const response = await fetch(url, { method: 'GET' });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * 利用可能なモデル（チェックポイント）一覧を取得する
     * @param host Forgeサーバーのホスト
     * @returns モデル名（title）の配列。失敗時は空配列。
     */
    static async models(host: string = 'http://127.0.0.1:5555'): Promise<string[]> {
        const url = `${host}/sdapi/v1/sd-models`;
        try {
            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) {
                console.error(`[ForgeConnector] sd-models status not ok: ${response.status}`);
                return [];
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                console.error('[ForgeConnector] sd-models response is not an array:', data);
                return [];
            }
            return data.map((item: any) => {
                if (!item) return '';
                return item.title || item.model_name || item.filename || '';
            }).filter(Boolean);
        } catch (error) {
            console.error('[ForgeConnector] Failed to fetch models:', error);
            return [];
        }
    }

    /**
     * 利用可能な LoRA 一覧を取得する
     * @param host Forgeサーバーのホスト
     * @returns LoRA名（name）の配列。失敗時は空配列。
     */
    static async loras(host: string = 'http://127.0.0.1:5555'): Promise<string[]> {
        const url = `${host}/sdapi/v1/loras`;
        try {
            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) return [];
            const data = await response.json() as { name: string }[];
            return data.map(item => item.name);
        } catch (error) {
            console.error('[ForgeConnector] Failed to fetch loras:', error);
            return [];
        }
    }
}
