import express from 'express';
import cors from 'cors';

import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import { VoiceAiService } from './services/voice-ai-service';
import { ChatAiService } from './services/chat-ai-service';
import removeBackgroundRoute from './routes/remove-background';
import configRoute from './routes/config';
import pingRoute from './routes/ping';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// 画像データ（Base64）の送受信に対応するため、リクエストボディのサイズ上限を50MBに設定
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// マスコットのアセットフォルダ(mascots/)を静的ファイル配信エンドポイントとしてホスト
const MASCOTS_DIR = path.join(__dirname, '../../mascots');
app.use('/mascots', express.static(MASCOTS_DIR));
console.log(`[Server] Hosting mascots directory from: ${MASCOTS_DIR}`);

// APIルートの登録
app.use('/api', removeBackgroundRoute);
app.use('/api', configRoute);
app.use('/api', pingRoute);

// HTTP サーバーを作成し、Express をラップ
const server = http.createServer(app);

// WebSocket サーバーの構築
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
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

server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Desktop AI Mascot Server is running!`);
    console.log(` URL: http://localhost:${PORT}`);
    console.log(`=========================================`);
});
