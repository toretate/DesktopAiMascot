export type IrodoriTtsParameters = {
    text: string;
    endpoint: string;
    model: string;
    voice: string;
    emotion?: string;
}

export type IrodoriTtsModelResult = {
    object: "list",
    data: {
        id: string,
        object: string,
        created: number,
        owned_by: string,
    }[]
}

export type IrodoriTtsVoiceItem = {
    id: string;
    object: "voice";
    ref_wav: string;
    ref_latent: string | null;
    no_ref: boolean;
}

export type IrodoriTtsVoicesResult = {
    object: "list";
    data: IrodoriTtsVoiceItem[];
}

export type IrodoriTtsUploadVoiceResult = {
    id: string;
    object: "voice_file";
    filename: string;
    bytes: number;
    created_at: number;
}

type IrodoriSpecificOptions = {
    num_steps?: number,          // Number of diffusion steps. Higher can improve quality but takes longer.
    seed?: number,               // Fixed random seed for reproducible output.
    cfg_scale_text?: number,     // Strength of text guidance.
    cfg_scale_speaker?: number,  // Strength of speaker/reference-voice guidance.
    lora_adapter?: string,       // PEFT LoRA adapter directory to load dynamically for this request. The adapter is not merged into the base checkpoint.
    t_schedule_mode?: string,    // Sampling schedule, usually linear or sway.
    sway_coeff?: number,         // Sway schedule coefficient when using t_schedule_mode: "sway".
    chunking_enabled?: boolean,  // Enable chunking inference.
    chunk_min_chars?: number,    // Minimum non-space characters before a chunk split point is used.
    first_sentence_chunk_min_chars?: number, // Optional minimum non-space characters used only for splitting the first sentence.
}

/**
 * Dynamic LoRA loading is per runtime process.
 * The first request for an adapter loads it into memory;
 * later requests for the same adapter reuse the cached adapter.
 * To run the base model after an adapter has been loaded, omit lora_adapter or set it to null, "none", or "base".
 * Dynamic LoRA is not compatible with IRODORI_COMPILE_MODEL=true.
 */
export type IrodoriTtsSpeechInputParam = {
    model: "irodori-tts" | string, // Use irodori-tts unless you changed IRODORI_MODEL_NAME.
    input: string, // Text to synthesize.
    voice?: string | { id: string }, // Voice ID, or { "id": "voice_id" }. Uses IRODORI_DEFAULT_VOICE if omitted.
    response_format?: "wav" | "mp3" | "flac" | "opus" | "aac" | "pcm",
    speed?: number, // speeking speed. 0.25～4.0. Higher is faster; internally this is converted to an inverse duration scale.
    stream_format?: string, // Set to sse to receive chunk-level Server-Sent Events.
    irodori?: IrodoriSpecificOptions, // Irodori-specific inference options.
}

export class IrodoriTtsConnector {

    /**
     * GET /health エンドポイントへの接続
     * Returns server status and current configuration. This endpoint does not load the model.
     * @param endpoint エンドポイントURL
     * @returns true: 正常, false: 異常
     */
    public static async health(endpoint: string): Promise<boolean> {
        const url = endpoint.endsWith('/')
            ? `${endpoint}health`
            : `${endpoint}/health`;
        const response = await fetch(url, {
            method: 'GET'
        });
        return response.ok;
    }

    /**
     * GET /v1/models
     * Returns the model ID accepted by the speech endpoint.
     * 
     * @param endpoint エンドポイントURL
     * @returns model names
     */
    public static async models(endpoint: string): Promise<IrodoriTtsModelResult | null> {
        const url = endpoint.endsWith('/')
            ? `${endpoint}v1/models`
            : `${endpoint}/v1/models`;
        const response = await fetch(url, {
            method: 'GET'
        });
        if (!response.ok) {
            return null;
        }
        const data = await response.json() as IrodoriTtsModelResult;
        return data;
    }

    /**
     * GET /v1/audio/voices
     * 登録されているボイス（話者）の一覧を取得します。
     * @param endpoint エンドポイントURL
     * @returns ボイス一覧
     */
    public static async listVoices(endpoint: string): Promise<IrodoriTtsVoicesResult | null> {
        const url = endpoint.endsWith('/')
            ? `${endpoint}v1/audio/voices`
            : `${endpoint}/v1/audio/voices`;
        try {
            const response = await fetch(url, {
                method: 'GET'
            });
            if (!response.ok) {
                return null;
            }
            return await response.json() as IrodoriTtsVoicesResult;
        } catch (e) {
            console.error('[IrodoriTtsConnector] ボイス一覧取得エラー:', e);
            return null;
        }
    }

    public static async uploadVoice(
        endpoint: string,
        file: Blob | File,
        voiceId?: string
    ): Promise<IrodoriTtsUploadVoiceResult | null> {
        const url = endpoint.endsWith('/')
            ? `${endpoint}v1/audio/voices`
            : `${endpoint}/v1/audio/voices`;

        let filename = 'voice.wav';
        if (file instanceof File) {
            filename = file.name;
        } else {
            const extMap: Record<string, string> = {
                'audio/wav': '.wav',
                'audio/wave': '.wav',
                'audio/x-wav': '.wav',
                'audio/mpeg': '.mp3',
                'audio/mp3': '.mp3',
                'audio/ogg': '.ogg',
                'audio/opus': '.opus',
                'audio/flac': '.flac',
                'audio/x-flac': '.flac',
                'audio/webm': '.webm',
                'audio/aac': '.aac',
                'audio/x-m4a': '.m4a',
                'audio/m4a': '.m4a'
            };
            const ext = extMap[file.type] || '.wav';
            const base = voiceId || 'voice';
            filename = base.endsWith(ext) ? base : `${base}${ext}`;
        }

        const formData = new FormData();
        formData.append('file', file, filename);
        if (voiceId) {
            formData.append('voice_id', voiceId);
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const errorText = typeof response.text === 'function'
                    ? await response.text().catch(() => '')
                    : '';
                console.error(`[IrodoriTtsConnector] ボイスアップロードエラー (Status: ${response.status}):`, errorText);
                return null;
            }
            return await response.json() as IrodoriTtsUploadVoiceResult;
        } catch (e) {
            console.error('[IrodoriTtsConnector] ボイスアップロードエラー:', e);
            return null;
        }
    }


    /**
     * irodori-tts を使用して音声を合成し、Base64形式の音声データを返します。
     * @param params 音声合成のパラメータ
     * @param endpoint エンドポイントURL (例: http://127.0.0.1:8088)
     * @returns Base64エンコードされた音声データ。エラー時は null
     */
    public static async synthesize(params: IrodoriTtsSpeechInputParam, emotion?: string, endpoint?: string): Promise<string | null> {
        const baseEndpoint = endpoint || 'http://127.0.0.1:8088';
        let targetModel = params.model || 'irodori-tts';
        if (targetModel === 'irodori-tts-500m-v3') {
            targetModel = 'irodori-tts';
        }
        const targetVoice = params.voice || 'none';

        // 感情表現用絵文字付与
        let textWithEmotion = params.input;
        if (emotion) {
            textWithEmotion += IrodoriTtsConnector.getIrodoriEmoji(emotion);
        }

        try {
            const url = baseEndpoint.endsWith('/')
                ? `${baseEndpoint}v1/audio/speech`
                : `${baseEndpoint}/v1/audio/speech`;

            const irodoriParams: IrodoriTtsSpeechInputParam = {
                model: targetModel,
                input: textWithEmotion,
                voice: targetVoice,
                response_format: 'mp3'
            };

            if (params.speed) {
                irodoriParams.speed = params.speed;
            }

            // ミヤコ用設定
            if (!params.irodori) {
                params.irodori = {
                    lora_adapter: "models/adapters/miyako",
                }
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(irodoriParams)
            });

            if (!response.ok) {
                throw new Error(`OpenAI TTS Error: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();

            // Base64に変換
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        } catch (e) {
            console.error('[IrodoriTtsConnector] 音声合成エラー:', e);
            return null;
        }
    }

    /**
     * 感情名に対応する Irodori-TTS の感情表現用絵文字を取得します。
     * @param emotion 感情名
     * @returns 感情表現用絵文字（先頭にスペースを含む）
     */
    public static getIrodoriEmoji(emotion?: string): string {
        if (!emotion) return '';
        const lower = emotion.toLowerCase().trim();

        // 28種類の感情表現 (SillyTavern互換)
        switch (lower) {
            case 'admiration':
                return ' 🫶';
            case 'amusement':
                return ' 🤭';
            case 'anger':
                return ' 😠';
            case 'annoyance':
                return ' 😒';
            case 'approval':
                return ' 👌';
            case 'caring':
                return ' 🫶';
            case 'confusion':
                return ' 🤔';
            case 'curiosity':
                return ' 🤔';
            case 'desire':
                return ' 😏';
            case 'disappointment':
                return ' 😮‍💨';
            case 'disapproval':
                return ' 🙄';
            case 'disgust':
                return ' 😒';
            case 'embarrassment':
                return ' 🫣';
            case 'excitement':
                return ' 😆';
            case 'fear':
                return ' 😱';
            case 'gratitude':
                return ' 🙏';
            case 'grief':
                return ' 😭';
            case 'joy':
                return ' 😆';
            case 'love':
                return ' 🫶';
            case 'nervousness':
                return ' 🥺';
            case 'optimism':
                return ' 😊';
            case 'pride':
                return ' 😏';
            case 'realization':
                return ' 😲';
            case 'relief':
                return ' 😌';
            case 'remorse':
                return ' 😭';
            case 'sadness':
                return ' 😭';
            case 'surprise':
                return ' 😲';
            case 'neutral':
                return '';
        }

        // 既存のショートカットおよび日本語の感情判定
        if (lower === 'happy' || lower === '嬉' || lower === '楽') {
            return ' 😊';
        }
        if (lower === '喜び' || lower === 'joy') {
            return ' 😆';
        }
        if (lower === 'sad' || lower === '悲しみ' || lower === '哀' || lower === '悲') {
            return ' 😭';
        }
        if (lower === 'angry' || lower === '怒り' || lower === '怒') {
            return ' 😠';
        }
        if (lower === 'surprised' || lower === '驚き' || lower === '驚') {
            return ' 😲';
        }
        if (lower === 'nervous' || lower === '不安') {
            return ' 🥺';
        }
        if (lower === 'scared' || lower === '恐れ' || lower === '恐怖') {
            return ' 😱';
        }
        if (lower === '安堵' || lower === 'ホッ') {
            return ' 😌';
        }
        if (lower === '照れ' || lower === '恥ずかしい') {
            return ' 🫣';
        }

        return '';
    }
}
