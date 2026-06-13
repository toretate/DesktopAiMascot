import { ipcMain } from 'electron';

export function registerIrodoriHandlers() {
    // irodori-tts v3 (OpenAI 互換) による音声合成のハンドラー
    ipcMain.handle('synthesize-irodori', async (event, text: string, endpoint: string, model: string, voice: string, emotion?: string) => {
        const defaultEndpoint = 'http://127.0.0.1:8088';
        const baseUrl = endpoint || defaultEndpoint;
        let targetModel = model || 'irodori-tts';
        if (targetModel === 'irodori-tts-500m-v3') {
            targetModel = 'irodori-tts';
        }
        const targetVoice = voice || 'default';

        // 感情表現機能：irodori-tts v3 ではテキストに特定の絵文字を含めることで感情制御ができるため、
        // 感情フラグがある場合はテキストの末尾に絵文字を付与する。
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

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

        try {
            console.log(`[IrodoriTTS] 音声合成開始: "${textWithEmotion}" (Model: ${targetModel}, Voice: ${targetVoice})`);
            const url = baseUrl.endsWith('/')
                ? `${baseUrl}v1/audio/speech`
                : `${baseUrl}/v1/audio/speech`;

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

            // バイナリデータを取得しBase64に変換
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');

            console.log(`[IrodoriTTS] 音声合成成功: ${buffer.length} bytes`);
            return base64;

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('[IrodoriTTS] irodori-ttsとの接続エラー (タイムアウト)');
            } else {
                console.warn('[IrodoriTTS] irodori-ttsとの接続エラー:', error.message);
            }
            return null;
        }
    });
}
