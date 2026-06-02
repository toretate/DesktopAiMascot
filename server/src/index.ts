import express from 'express';
import cors from 'cors';

import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_PATH = path.join(__dirname, '../../config.json');

app.use(cors());
app.use(express.json());

// 設定データをロードするエンドポイント
app.get('/api/config', (req, res) => {
    try {
        console.log('[Server] Load config request received');
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf8');
            return res.json({ success: true, config: JSON.parse(data) });
        } else {
            console.log('[Server] config.json does not exist. Returning empty object.');
            return res.json({ success: true, config: {} });
        }
    } catch (error: any) {
        console.error('[Server] Failed to load config:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// マスコットのアセットフォルダ(mascots/)を静的ファイル配信エンドポイントとしてホスト
const MASCOTS_DIR = path.join(__dirname, '../../mascots');
app.use('/mascots', express.static(MASCOTS_DIR));
console.log(`[Server] Hosting mascots directory from: ${MASCOTS_DIR}`);

// Base64 DataURL をデコードしてファイルに保存し、静的URLパスを返す関数
function saveBase64Image(base64Data: string, mascotId: string, assetType: string, assetId: string): string {
    const matches = base64Data.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return base64Data; // Base64ではない、または不正な形式の場合はそのまま返す
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const dataBuffer = Buffer.from(matches[2], 'base64');
    
    // ディレクトリパスを作成
    const targetDir = path.join(MASCOTS_DIR, mascotId, assetType);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `${assetId}.${ext}`;
    const filePath = path.join(targetDir, filename);
    
    fs.writeFileSync(filePath, dataBuffer);
    console.log(`[Server] Saved asset to ${filePath}`);

    // 静的配信用の相対URLパスを返す (/mascots/...)
    return `/mascots/${mascotId}/${assetType}/${filename}`;
}

// 設定データをセーブするエンドポイント
app.post('/api/config', (req, res) => {
    try {
        console.log('[Server] Save config request received');
        const newConfig = req.body;

        // Base64画像データの抽出と保存・置換
        if (newConfig && Array.isArray(newConfig.mascots)) {
            for (const mascot of newConfig.mascots) {
                const mascotId = mascot.id;
                if (!mascotId) continue;

                // avatar の処理
                if (mascot.avatar && mascot.avatar.startsWith('data:image/')) {
                    mascot.avatar = saveBase64Image(mascot.avatar, mascotId, 'avatar', 'avatar');
                }

                // assets.outfits の処理
                if (mascot.assets && Array.isArray(mascot.assets.outfits)) {
                    for (const outfit of mascot.assets.outfits) {
                        if (outfit.path && outfit.path.startsWith('data:image/')) {
                            outfit.path = saveBase64Image(outfit.path, mascotId, 'outfits', outfit.id);
                        }
                    }
                }

                // assets.expressions の処理
                if (mascot.assets && Array.isArray(mascot.assets.expressions)) {
                    for (const expr of mascot.assets.expressions) {
                        if (expr.path && expr.path.startsWith('data:image/')) {
                            expr.path = saveBase64Image(expr.path, mascotId, 'expressions', expr.id);
                        }
                    }
                }

                // assets.poses の処理
                if (mascot.assets && Array.isArray(mascot.assets.poses)) {
                    for (const pose of mascot.assets.poses) {
                        if (pose.path && pose.path.startsWith('data:image/')) {
                            pose.path = saveBase64Image(pose.path, mascotId, 'poses', pose.id);
                        }
                    }
                }
            }
        }

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 4), 'utf8');
        console.log('[Server] config.json saved successfully');
        return res.json({ success: true, config: newConfig });
    } catch (error: any) {
        console.error('[Server] Failed to save config:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 疎通確認(ping)用エンドポイント
app.get('/api/ping', (req, res) => {
    console.log('[Server] Ping request received');
    res.json({
        success: true,
        message: 'pong',
        timestamp: new Date().toISOString()
    });
});

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
                    voicevoxEndpoint 
                } = data;

                console.log(`[WS] chat-send received: "${message}"`);

                // 1. 考え中ステータスをプッシュ
                ws.send(JSON.stringify({
                    event: 'chat-status',
                    data: { status: 'thinking' }
                }));

                // 2. Gemini APIリクエストの実行
                const targetModel = model || 'gemini-2.0-flash-exp';
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);

                let reply = '';
                try {
                    const response = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: [{ text: message }] }],
                            systemInstruction: { parts: [{ text: systemPrompt || 'You are a helpful assistant.' }] }
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Gemini API Error: ${response.status} ${errorText}`);
                    }

                    const resJson: any = await response.json();
                    reply = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
                } catch (geminiError: any) {
                    clearTimeout(timeoutId);
                    console.error('[WS] Gemini Error:', geminiError.message);
                    ws.send(JSON.stringify({
                        event: 'chat-error',
                        data: { message: `Geminiとの通信エラー: ${geminiError.message}` }
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

                    console.log(`[WS] VOICEVOX synthesize start for: "${speechText}"`);
                    
                    const voiceController = new AbortController();
                    const voiceTimeoutId = setTimeout(() => voiceController.abort(), 60000);

                    try {
                        const encodedText = encodeURIComponent(speechText);
                        const queryUrl = baseUrl.endsWith('/')
                            ? `${baseUrl}audio_query?text=${encodedText}&speaker=${speaker}`
                            : `${baseUrl}/audio_query?text=${encodedText}&speaker=${speaker}`;

                        // 4.1 クエリ作成
                        const queryResponse = await fetch(queryUrl, {
                            method: 'POST',
                            signal: voiceController.signal
                        });

                        if (!queryResponse.ok) {
                            throw new Error(`VOICEVOX Query Error: ${queryResponse.status}`);
                        }

                        const audioQuery = await queryResponse.json();

                        // 4.2 音声合成
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

                        console.log(`[WS] VOICEVOX synthesize success`);

                        // 4.3 音声データのプッシュ
                        ws.send(JSON.stringify({
                            event: 'chat-audio',
                            data: { audio: base64Audio }
                        }));
                    } catch (voiceError: any) {
                        clearTimeout(voiceTimeoutId);
                        console.error('[WS] VOICEVOX Error:', voiceError.message);
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
