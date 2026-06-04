import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import * as url from 'url';
import { ChatAiService } from '../services/chat-ai-service';
import { VoiceAiService } from '../services/voice-ai-service';
import { authenticateUserToken, parseCookies } from '../middlewares/auth-middleware';

export function setupWebSocket(wss: WebSocketServer) {
    wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
        console.log('[WS] Client connecting...');

        const requestUrl = req.url || '';
        const parsedUrl = url.parse(requestUrl, true);
        
        // 1. クエリパラメータから token を取得 (モバイル等)
        let token = parsedUrl.query.token as string;

        // 2. クエリパラメータにない場合は Cookie から取得 (Web/Electron)
        if (!token) {
            const cookies = parseCookies(req.headers.cookie);
            token = cookies['session_token'];
        }

        try {
            if (!process.env.GOOGLE_CLIENT_ID) {
                console.warn('[WS] 警告: GOOGLE_CLIENT_ID が環境変数に設定されていません。認証なしで接続を許可します。');
            } else {
                if (!token) {
                    console.log('[WS] Authentication failed: No token provided');
                    ws.close(4001, 'Unauthorized: Token is required');
                    return;
                }
                const user = await authenticateUserToken(token);
                console.log(`[WS] Authentication successful for user: ${user.email}`);
            }
        } catch (authError: any) {
            console.error('[WS] Authentication failed:', authError.message);
            ws.close(4003, `Forbidden: ${authError.message}`);
            return;
        }

        console.log('[WS] Client connected successfully');


        ws.on('message', async (messageData) => {
            try {
                const rawMessage = messageData.toString();
                const parsed = JSON.parse(rawMessage);
                const { event, data } = parsed;

                if (event === 'chat-send') {
                    const {
                        message,
                        apiKey,
                        systemPrompt,
                        model,
                        voicevoxSpeakerId,
                        voicevoxEndpoint,
                        engine,
                        lmstudioEndpoint,
                        history
                    } = data;

                    console.log(`=========================================`);
                    console.log(`[WS] chat-send received!`);
                    console.log(` - Message: "${message}"`);
                    console.log(` - Engine: "${engine}"`);
                    console.log(` - Model: "${model}"`);
                    console.log(` - API Key: ${apiKey ? '***(設定あり)***' : '(設定なし)'}`);
                    console.log(` - LM Studio Endpoint: "${lmstudioEndpoint}"`);
                    console.log(` - History elements: ${history ? history.length : 0}`);
                    console.log(`=========================================`);

                    // 1. 考え中ステータスをプッシュ
                    ws.send(JSON.stringify({
                        event: 'chat-status',
                        data: { status: 'thinking' }
                    }));

                    let reply = '';
                    try {
                        reply = await ChatAiService.generateResponse({
                            message,
                            apiKey,
                            systemPrompt,
                            model,
                            engine,
                            lmstudioEndpoint,
                            history
                        });
                    } catch (aiError: any) {
                        console.error('[WS] AI Engine Error:', aiError.message);
                        ws.send(JSON.stringify({
                            event: 'chat-error',
                            data: { message: `AIサーバーとの通信エラー: ${aiError.message}` }
                        }));
                        return;
                    }

                    // 感情タグのパース
                    let detectedEmotion = 'neutral';
                    const emotionMatch = reply.match(/\[(\w+)\]/);
                    if (emotionMatch && emotionMatch[1]) {
                        detectedEmotion = emotionMatch[1].toLowerCase().trim();
                    }

                    const speechText = reply.replace(/\[\w+\]/g, '').trim();

                    // 3. AI応答テキストのプッシュ
                    ws.send(JSON.stringify({
                        event: 'chat-response',
                        data: {
                            text: reply,
                            speechText: speechText,
                            emotion: detectedEmotion
                        }
                    }));

                    // 4. VOICEVOXによる音声合成
                    if (speechText) {
                        const baseUrl = voicevoxEndpoint || 'http://localhost:50021';
                        const speaker = voicevoxSpeakerId !== undefined ? voicevoxSpeakerId : 2;

                        // 文節ごとに分割
                        const sentences = speechText
                            .split(/(?<=[。！？\n])/)
                            .map(s => s.trim())
                            .filter(s => s.length > 0);

                        // 並行して音声合成リクエストを開始
                        const synthPromises = sentences.map(sentence =>
                            VoiceAiService.synthesize(sentence, speaker, baseUrl)
                        );

                        // 完了順（テキスト内の登場順）にクライアントにプッシュ送信
                        (async () => {
                            for (const promise of synthPromises) {
                                try {
                                    const base64Audio = await promise;
                                    if (base64Audio) {
                                        ws.send(JSON.stringify({
                                            event: 'chat-audio',
                                            data: { audio: base64Audio }
                                        }));
                                    }
                                } catch (err) {
                                    console.error('[WS] VOICEVOX並行合成エラー:', err);
                                }
                            }
                        })();
                    }
                }
            } catch (e: any) {
                console.error('[WS] Error processing message:', e.message);
            }
        });

        ws.on('close', () => {
            console.log('[WS] Client disconnected');
        });
    });
}
