import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import * as url from 'url';
import { ChatAiService } from '../services/chat-ai-service';
import { VoiceAiService } from '../services/voice-ai-service';
import { authenticateUserToken, parseCookies } from '../middlewares/auth-middleware';

// ユーザーごとのWebSocket接続を管理するマップ（認証なしの場合は 'anonymous' を使用）
const userConnections = new Map<string, Set<WebSocket>>();

function addConnection(userId: string, ws: WebSocket) {
    if (!userConnections.has(userId)) {
        userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(ws);
}

function removeConnection(userId: string, ws: WebSocket) {
    const conns = userConnections.get(userId);
    if (conns) {
        conns.delete(ws);
        if (conns.size === 0) {
            userConnections.delete(userId);
        }
    }
}

function broadcastToUser(userId: string, event: string, data: any) {
    const conns = userConnections.get(userId);
    if (conns) {
        const payload = JSON.stringify({ event, data });
        conns.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    }
}

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

        let userId = 'anonymous';
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
                userId = user.email;
            }
        } catch (authError: any) {
            console.error('[WS] Authentication failed:', authError.message);
            ws.close(4003, `Forbidden: ${authError.message}`);
            return;
        }

        // コネクションの登録
        addConnection(userId, ws);
        console.log(`[WS] Client connected successfully (User: ${userId})`);


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
                        selectedVoiceEngine,
                        irodoriEndpoint,
                        irodoriModel,
                        irodoriVoice,
                        engine,
                        lmstudioEndpoint,
                        history,
                        useTts,
                        attachments,
                        tools
                    } = data;

                    console.log(`=========================================`);
                    console.log(`[WS] chat-send received!`);
                    console.log(` - Message: "${message}"`);
                    console.log(` - Engine: "${engine}"`);
                    console.log(` - Model: "${model}"`);
                    console.log(` - API Key: ${apiKey ? '***(設定あり)***' : '(設定なし)'}`);
                    console.log(` - LM Studio Endpoint: "${lmstudioEndpoint}"`);
                    console.log(` - History elements: ${history ? history.length : 0}`);
                    console.log(` - Attachments count: ${attachments ? attachments.length : 0}`);
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
                            history,
                            attachments,
                            tools
                        });
                    } catch (aiError: any) {
                        console.error('[WS] AI Engine Error:', aiError.message);
                        ws.send(JSON.stringify({
                            event: 'chat-error',
                            data: { message: `AIサーバーとの通信エラー: ${aiError.message}` }
                        }));
                        return;
                    }

                    // タイマータグのパース
                    let timerData: { seconds: number; memo: string } | null = null;
                    const timerMatch = reply.match(/\[TIMER:(\d+),(.+?)\]/i);
                    if (timerMatch && timerMatch[1] && timerMatch[2]) {
                        timerData = {
                            seconds: parseInt(timerMatch[1], 10),
                            memo: timerMatch[2].trim()
                        };
                    }

                    // タイマータグを除去したクリーンな応答
                    const cleanReply = reply.replace(/\[TIMER:.*?\]/gi, '').trim();

                    // 感情タグのパース
                    let detectedEmotion = 'neutral';
                    const emotionMatch = cleanReply.match(/\[(\w+)\]/);
                    if (emotionMatch && emotionMatch[1]) {
                        detectedEmotion = emotionMatch[1].toLowerCase().trim();
                    }

                    const speechText = cleanReply.replace(/\[\w+\]/g, '').trim();

                    // 3. AI応答テキストのプッシュ
                    ws.send(JSON.stringify({
                        event: 'chat-response',
                        data: {
                            text: cleanReply,
                            speechText: speechText,
                            emotion: detectedEmotion
                        }
                    }));

                    // タイマーが検出された場合、サーバー側でセットする
                    if (timerData) {
                        const durationMs = timerData.seconds * 1000;
                        console.log(`[WS] Timer registered for user ${userId}: ${timerData.seconds}s, Memo: "${timerData.memo}"`);
                        setTimeout(() => {
                            console.log(`[WS] Timer triggered for user ${userId}: "${timerData!.memo}"`);
                            broadcastToUser(userId, 'timer-trigger', {
                                memo: timerData!.memo
                            });
                        }, durationMs);
                    }

                    // 4. 音声合成 (VOICEVOX または irodori-tts)
                    if (speechText && useTts !== false) {
                        const voiceEngine = selectedVoiceEngine || 'voicevox';
                        const baseUrl = voicevoxEndpoint || 'http://localhost:50021';
                        const speaker = voicevoxSpeakerId !== undefined ? voicevoxSpeakerId : 2;
                        const irodoriUrl = irodoriEndpoint || 'http://localhost:7861';
                        const irodoriModelName = irodoriModel || 'irodori-tts-500m-v3';
                        const irodoriVoiceName = irodoriVoice || 'default';

                        // 文節ごとに分割
                        const sentences = speechText
                            .split(/(?<=[。！？\n])/)
                            .map(s => s.trim())
                            .filter(s => s.length > 0);

                        // 並行して音声合成リクエストを開始
                        const synthPromises = sentences.map(sentence => {
                            if (voiceEngine === 'irodori') {
                                return VoiceAiService.synthesizeIrodori(sentence, irodoriUrl, irodoriModelName, irodoriVoiceName, detectedEmotion);
                            } else {
                                return VoiceAiService.synthesize(sentence, speaker, baseUrl);
                            }
                        });

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
            console.log(`[WS] Client disconnected (User: ${userId})`);
            removeConnection(userId, ws);
        });
    });
}
