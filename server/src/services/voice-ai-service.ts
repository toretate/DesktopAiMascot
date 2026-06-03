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
}
