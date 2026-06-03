import express from 'express';
import cors from 'cors';

import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer } from 'ws';
import { removeBackground } from './services/remove-bg-service';
import { VoiceAiService } from './services/voice-ai-service';

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_PATH = path.join(__dirname, '../../config.json');

app.use(cors());
// 画像データ（Base64）の送受信に対応するため、リクエストボディのサイズ上限を50MBに設定
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// 背景削除APIエンドポイント
app.post('/api/remove-background', async (req, res) => {
    try {
        const { imagePath, mascotId, engine } = req.body;
        console.log(`[Server] Background removal request received for mascot: ${mascotId}, engine: ${engine}`);

        if (!imagePath) {
            return res.status(400).json({ success: false, error: 'imagePath is required' });
        }

        let inputBuffer: Buffer;
        let mimeType = 'image/png';

        if (imagePath.startsWith('data:image/')) {
            // Base64 DataURL → Buffer → Blob に変換して渡す
            const matches = imagePath.match(/^data:([a-zA-Z+/]+);base64,(.+)$/s);
            if (!matches || matches.length < 3) {
                return res.status(400).json({ success: false, error: 'Invalid data URL format' });
            }
            mimeType = matches[1];
            const base64Data = matches[2];
            inputBuffer = Buffer.from(base64Data, 'base64');
            console.log(`[Server] DataURL converted to Buffer (mimeType: ${mimeType}, size: ${inputBuffer.length} bytes)`);
        } else if (imagePath.startsWith('/mascots/')) {
            // サーバー静的ファイルパスからファイルを直接読み込む
            const filePath = path.join(MASCOTS_DIR, imagePath.replace('/mascots/', ''));
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ success: false, error: `File not found: ${filePath}` });
            }
            inputBuffer = fs.readFileSync(filePath);
            const ext = path.extname(filePath).replace('.', '').replace('jpg', 'jpeg');
            mimeType = `image/${ext}`;
            console.log(`[Server] File loaded as Buffer: ${filePath}`);
        } else {
            return res.status(400).json({ success: false, error: 'Unsupported image source format' });
        }

        console.log(`[Server] Processing background removal using engine: ${engine}...`);
        
        const outputBuffer = await removeBackground(inputBuffer, mimeType, engine);
        const base64Image = `data:image/png;base64,${outputBuffer.toString('base64')}`;

        console.log('[Server] Background removal succeeded');
        return res.json({ success: true, image: base64Image });
    } catch (error: any) {
        console.error('[Server] Background removal failed:', error.message);
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

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);

                let reply = '';
                try {
                    const currentEngine = engine || 'gemini';
                    if (currentEngine === 'lmstudio') {
                        // LM Studio への接続
                        const defaultEndpoint = 'http://127.0.0.1:1234/v1/';
                        const apiBase = lmstudioEndpoint || defaultEndpoint;
                        const url = apiBase.endsWith('/') ? `${apiBase}chat/completions` : `${apiBase}/chat/completions`;
                        const targetModel = model || 'unspecified';

                        console.log(`[WS] Routing to LM Studio: ${url} (Model: ${targetModel})`);

                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                model: targetModel,
                                messages: [
                                    { role: 'system', content: systemPrompt },
                                    { role: 'user', content: message }
                                ]
                            }),
                            signal: controller.signal
                        });

                        clearTimeout(timeoutId);

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`LM Studio Error: ${response.status} ${errorText}`);
                        }

                        const resJson: any = await response.json();
                        reply = resJson.choices?.[0]?.message?.content || '';
                    } else {
                        // Gemini への接続
                        const targetModel = model || 'gemini-1.5-flash';
                        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

                        console.log(`[WS] Routing to Gemini: ${geminiUrl} (Model: ${targetModel})`);

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
                    }
                } catch (aiError: any) {
                    clearTimeout(timeoutId);
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
