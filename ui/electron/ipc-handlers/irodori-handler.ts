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
            textWithEmotion += getIrodoriEmoji(emotion);
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

    // Irodori-TTS の疎通確認およびボイス一覧取得のハンドラー
    ipcMain.handle('get-irodori-voices', async (event, endpoint: string) => {
        const defaultEndpoint = 'http://127.0.0.1:8088';
        const apiBase = endpoint || defaultEndpoint;
        const url = apiBase.endsWith('/') ? `${apiBase}v1/audio/voices` : `${apiBase}/v1/audio/voices`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

        try {
            console.log(`[IrodoriTTS] 疎通確認・ボイスリスト取得開始: ${url}`);
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const rawVoices: any = await response.json();
            if (rawVoices && Array.isArray(rawVoices.data)) {
                console.log(`[IrodoriTTS] 疎通成功。取得ボイス数: ${rawVoices.data.length}`);
                return { success: true, voices: rawVoices.data };
            } else {
                throw new Error('Invalid response format');
            }

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('[IrodoriTTS] 疎通確認・ボイスリスト取得エラー (タイムアウト)');
                return { success: false, voices: [], error: '接続がタイムアウトしました。' };
            } else {
                console.warn('[IrodoriTTS] 疎通確認・ボイスリスト取得エラー:', error.message);
                return { success: false, voices: [], error: '接続に失敗しました。' };
            }
        }
    });
}

/**
 * 感情名に対応する Irodori-TTS の感情表現用絵文字を取得します。
 * @param emotion 感情名
 * @returns 感情表現用絵文字（先頭にスペースを含む）
 */
function getIrodoriEmoji(emotion?: string): string {
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

