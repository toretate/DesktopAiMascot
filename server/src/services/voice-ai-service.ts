export class VoiceAiService {
    /**
     * VOICEVOXを使用して音声を合成し、Base64形式の音声データを返します。
     * @param text 音声合成するテキスト
     * @param speakerId 話者ID
     * @param endpoint VOICEVOXのエンドポイントURL
     * @returns Base64エンコードされた音声データ。エラー時は null
     */
    public static async synthesize(text: string, speakerId: number, endpoint: string): Promise<string | null> {
        const baseUrl = endpoint || 'http://localhost:50021';
        const speaker = speakerId !== undefined ? speakerId : 2;

        console.log(`[VoiceAiService] VOICEVOX synthesize start for: "${text}"`);
        
        const voiceController = new AbortController();
        const voiceTimeoutId = setTimeout(() => voiceController.abort(), 60000);

        try {
            const encodedText = encodeURIComponent(text);
            const queryUrl = baseUrl.endsWith('/')
                ? `${baseUrl}audio_query?text=${encodedText}&speaker=${speaker}`
                : `${baseUrl}/audio_query?text=${encodedText}&speaker=${speaker}`;

            // 1. クエリ作成
            const queryResponse = await fetch(queryUrl, {
                method: 'POST',
                signal: voiceController.signal
            });

            if (!queryResponse.ok) {
                throw new Error(`VOICEVOX Query Error: ${queryResponse.status}`);
            }

            const audioQuery = await queryResponse.json();

            // 2. 音声合成
            const synthesisUrl = baseUrl.endsWith('/')
                ? `${baseUrl}synthesis?speaker=${speaker}`
                : `${baseUrl}/synthesis?speaker=${speaker}`;
            
            const synthResponse = await fetch(synthesisUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(audioQuery),
                signal: voiceController.signal
            });

            clearTimeout(voiceTimeoutId);

            if (!synthResponse.ok) {
                throw new Error(`VOICEVOX Synthesis Error: ${synthResponse.status}`);
            }

            const arrayBuffer = await synthResponse.arrayBuffer();
            const base64Audio = Buffer.from(arrayBuffer).toString('base64');

            console.log(`[VoiceAiService] VOICEVOX synthesize success`);
            return base64Audio;
        } catch (voiceError: any) {
            clearTimeout(voiceTimeoutId);
            if (voiceError.name === 'AbortError') {
                console.warn('[VoiceAiService] VOICEVOXとの接続エラー (タイムアウト/タスクキャンセル)');
            } else if (voiceError.name === 'TypeError' || voiceError.code === 'ECONNREFUSED') {
                console.warn('[VoiceAiService] VOICEVOXとの接続エラー (接続失敗/ネットワークエラー)');
            } else {
                console.warn('[VoiceAiService] VOICEVOXとの接続エラー:', voiceError.message);
            }
            return null;
        }
    }

    /**
     * irodori-tts (OpenAI 互換) を使用して音声を合成し、Base64形式の音声データを返します。
     * @param text 音声合成するテキスト
     * @param endpoint irodori-ttsのエンドポイントURL
     * @param model 使用するモデル名
     * @param voice 使用するボイス名
     * @param emotion 感情名 (happy, sad, angry, surprised, neutral)
     * @returns Base64エンコードされた音声データ。エラー時は null
     */
    public static async synthesizeIrodori(text: string, endpoint: string, model: string, voice: string, emotion?: string): Promise<string | null> {
        const baseUrl = endpoint || 'http://127.0.0.1:8088';
        let targetModel = model || 'irodori-tts';
        if (targetModel === 'irodori-tts-500m-v3') {
            targetModel = 'irodori-tts';
        }
        const targetVoice = voice || 'default';

        let textWithEmotion = text;
        if (emotion) {
            const lowerEmotion = emotion.toLowerCase();
            if (lowerEmotion === 'happy' || lowerEmotion === '喜び' || lowerEmotion === '嬉') {
                textWithEmotion += ' 😊';
            } else if (lowerEmotion === 'sad' || lowerEmotion === '悲しみ' || lowerEmotion === '哀') {
                textWithEmotion += ' 😢';
            } else if (lowerEmotion === 'angry' || lowerEmotion === '怒り' || lowerEmotion === '怒') {
                textWithEmotion += ' 💢';
            } else if (lowerEmotion === 'surprised' || lowerEmotion === '驚き' || lowerEmotion === '驚') {
                textWithEmotion += ' 😲';
            }
        }

        console.log(`[VoiceAiService] irodori-tts synthesize start for: "${textWithEmotion}"`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const url = baseUrl.endsWith('/') ? `${baseUrl}v1/audio/speech` : `${baseUrl}/v1/audio/speech`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: targetModel,
                    input: textWithEmotion,
                    voice: targetVoice,
                    response_format: 'mp3'
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`OpenAI TTS Error: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const base64Audio = Buffer.from(arrayBuffer).toString('base64');

            console.log(`[VoiceAiService] irodori-tts synthesize success`);
            return base64Audio;
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('[VoiceAiService] irodori-ttsとの接続エラー (タイムアウト/タスクキャンセル)');
            } else if (error.name === 'TypeError' || error.code === 'ECONNREFUSED') {
                console.warn('[VoiceAiService] irodori-ttsとの接続エラー (接続失敗/ネットワークエラー)');
            } else {
                console.warn('[VoiceAiService] irodori-ttsとの接続エラー:', error.message);
            }
            return null;
        }
    }
}
