import express from 'express';
import cors from 'cors';

import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import removeBackgroundRoute from './routes/remove-background';
import configRoute from './routes/config';
import pingRoute from './routes/ping';
import { setupWebSocket } from './routes/websocket';

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

setupWebSocket(wss);

server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Desktop AI Mascot Server is running!`);
    console.log(` URL: http://localhost:${PORT}`);
    console.log(`=========================================`);
});
