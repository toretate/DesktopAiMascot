import { WebSocket, WebSocketServer } from 'ws';
import { ChatAiService } from '../services/chat-ai-service';
import { VoiceAiService } from '../services/voice-ai-service';

export function setupWebSocket(wss: WebSocketServer) {
    wss.on('connection', (ws: WebSocket) => {
        console.log('[WS] Client connected');

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
                        lmstudioEndpoint
                    } = data;

                    console.log(`=========================================`);
                    console.log(`[WS] chat-send received!`);
                    console.log(` - Message: "${message}"`);
                    console.log(` - Engine: "${engine}"`);
                    console.log(` - Model: "${model}"`);
                    console.log(` - API Key: ${apiKey ? '***(設定あり)***' : '(設定なし)'}`);
                    console.log(` - LM Studio Endpoint: "${lmstudioEndpoint}"`);
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
                            lmstudioEndpoint
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

                        const base64Audio = await VoiceAiService.synthesize(speechText, speaker, baseUrl);
                        if (base64Audio) {
                            // 4.3 音声データのプッシュ
                            ws.send(JSON.stringify({
                                event: 'chat-audio',
                                data: { audio: base64Audio }
                            }));
                        }
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
