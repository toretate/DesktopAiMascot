import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../middlewares/auth-middleware';

const router = Router();
const HISTORY_TEMPLATE_PATH = path.join(__dirname, '../../../chat_history.json');

// ユーザーごとのチャット履歴ファイルパスを返すヘルパー関数
function getUserHistoryPath(userId: string): string {
    return path.join(__dirname, `../../../server/users/${userId}/chat_history.json`);
}

// チャット履歴を取得するエンドポイント
router.get('/history', authMiddleware, (req, res) => {
    try {
        console.log('[Server] Load chat history request received');
        if (!req.user) {
            return res.status(401).json({ success: false, error: '認証情報が見つかりません。' });
        }

        const userId = req.user.id;
        const userHistoryPath = getUserHistoryPath(userId);
        const userDir = path.dirname(userHistoryPath);

        // ユーザーディレクトリの自動生成
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        // 履歴ファイルが存在しない場合のマイグレーション／初期化処理
        if (!fs.existsSync(userHistoryPath)) {
            if (fs.existsSync(HISTORY_TEMPLATE_PATH)) {
                // ルートの chat_history.json をテンプレートとしてコピー
                fs.copyFileSync(HISTORY_TEMPLATE_PATH, userHistoryPath);
                console.log(`[Server] ルートの chat_history.json をユーザー用履歴として初期化コピーしました: ${userId}`);
            } else {
                // デフォルトの空履歴を作成
                fs.writeFileSync(userHistoryPath, JSON.stringify({}, null, 4), 'utf8');
                console.log(`[Server] 空の chat_history.json を作成しました: ${userId}`);
            }
        }

        const data = fs.readFileSync(userHistoryPath, 'utf8');
        return res.json({ success: true, history: JSON.parse(data) });
    } catch (error: any) {
        console.error('[Server] Failed to load chat history:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// チャット履歴を保存するエンドポイント
router.post('/history', authMiddleware, (req, res) => {
    try {
        console.log('[Server] Save chat history request received');
        if (!req.user) {
            return res.status(401).json({ success: false, error: '認証情報が見つかりません。' });
        }

        const userId = req.user.id;
        const userHistoryPath = getUserHistoryPath(userId);
        const userDir = path.dirname(userHistoryPath);

        // ユーザーディレクトリの自動生成
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        const history = req.body;
        fs.writeFileSync(userHistoryPath, JSON.stringify(history, null, 4), 'utf8');
        console.log(`[Server] chat_history.json saved successfully for user: ${userId}`);
        return res.json({ success: true });
    } catch (error: any) {
        console.error('[Server] Failed to save chat history:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
