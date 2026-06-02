import express from 'express';
import cors from 'cors';

import path from 'path';
import fs from 'fs';

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

// 設定データをセーブするエンドポイント
app.post('/api/config', (req, res) => {
    try {
        console.log('[Server] Save config request received');
        const newConfig = req.body;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 4), 'utf8');
        console.log('[Server] config.json saved successfully');
        return res.json({ success: true });
    } catch (error: any) {
        console.error('[Server] Failed to save config:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// マスコットのアセットフォルダ(mascots/)を静的ファイル配信エンドポイントとしてホスト
const MASCOTS_DIR = path.join(__dirname, '../../mascots');
app.use('/mascots', express.static(MASCOTS_DIR));
console.log(`[Server] Hosting mascots directory from: ${MASCOTS_DIR}`);

// 疎通確認(ping)用エンドポイント
app.get('/api/ping', (req, res) => {
    console.log('[Server] Ping request received');
    res.json({
        success: true,
        message: 'pong',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Desktop AI Mascot Server is running!`);
    console.log(` URL: http://localhost:${PORT}`);
    console.log(`=========================================`);
});
