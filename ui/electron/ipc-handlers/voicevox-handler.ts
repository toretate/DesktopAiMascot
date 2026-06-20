import { ipcMain } from 'electron';

export function registerVoicevoxHandlers(config: any) {
    // 6. VOICEVOXによる音声合成のハンドラー
    ipcMain.handle('synthesize-voicevox', async (event, text: string, speakerId: number, endpoint?: string) => {
        const defaultEndpoint = 'http://localhost:50021';
        const baseUrl = endpoint || defaultEndpoint;
        const showVoiceLog = config.get().showVoiceLog !== false;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

        try {
            if (showVoiceLog) {
                console.log(`[VoiceVox] 音声合成クエリ作成開始: ${text}`);
            }
            const encodedText = encodeURIComponent(text);
            const queryUrl = baseUrl.endsWith('/')
                ? `${baseUrl}audio_query?text=${encodedText}&speaker=${speakerId}`
                : `${baseUrl}/audio_query?text=${encodedText}&speaker=${speakerId}`;

            // 1. クエリ作成
            const queryResponse = await fetch(queryUrl, {
                method: 'POST',
                signal: controller.signal
            });

            if (!queryResponse.ok) {
                throw new Error(`Query Error: ${queryResponse.status}`);
            }

            const audioQuery = await queryResponse.json();
            if (showVoiceLog) {
                console.log('[VoiceVox] AudioQuery作成成功');
            }

            // 2. 音声合成
            const synthesisUrl = baseUrl.endsWith('/')
                ? `${baseUrl}synthesis?speaker=${speakerId}`
                : `${baseUrl}/synthesis?speaker=${speakerId}`;
            const synthResponse = await fetch(synthesisUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(audioQuery),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!synthResponse.ok) {
                throw new Error(`Synthesis Error: ${synthResponse.status}`);
            }

            // バイナリデータを取得しBase64に変換
            const arrayBuffer = await synthResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');

            if (showVoiceLog) {
                console.log(`[VoiceVox] 音声合成成功: ${buffer.length} bytes`);
            }
            return base64;

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('VoiceVoxとの接続エラー (タイムアウト)');
            } else {
                console.warn('VoiceVoxとの接続エラー');
            }
            return null;
        }
    });

    // 6-2. VOICEVOX の疎通確認および話者（スタイル）一覧取得のハンドラー
    ipcMain.handle('get-voicevox-speakers', async (event, endpoint: string) => {
        const defaultEndpoint = 'http://localhost:50021';
        const apiBase = endpoint || defaultEndpoint;
        const url = apiBase.endsWith('/') ? `${apiBase}speakers` : `${apiBase}/speakers`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

        try {
            console.log(`[VoiceVox] 疎通確認・話者リスト取得開始: ${url}`);
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const rawSpeakers: any = await response.json();
            const speakers: { name: string, value: number }[] = [];

            // 話者とスタイルのネスト構造をフラットにマッピング
            for (const sp of rawSpeakers) {
                for (const style of sp.styles || []) {
                    speakers.push({
                        name: `${sp.name} (${style.name})`,
                        value: Number(style.id)
                    });
                }
            }

            console.log(`[VoiceVox] 疎通成功。取得話者スタイル数: ${speakers.length}`);
            return { success: true, speakers };

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.warn('VoiceVoxとの接続確認エラー (タイムアウト)');
                return { success: false, speakers: [], error: '接続がタイムアウトしました。' };
            } else {
                console.warn('VoiceVoxとの接続確認エラー');
                return { success: false, speakers: [], error: '接続に失敗しました。' };
            }
        }
    });
}
