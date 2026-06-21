import { defineEventHandler, createError } from 'h3';
import fs from 'fs';
import path from 'path';
import { HISTORY_TEMPLATE_PATH, USERS_DIR } from '../utils/paths';

function getUserHistoryPath(userId: string): string {
    return path.join(USERS_DIR, userId, 'chat_history.json');
}

export default defineEventHandler(async (event) => {
    try {
        console.log('[Server] Load chat history request received');
        if (!event.context.user) {
            throw createError({
                statusCode: 401,
                statusMessage: '認証情報が見つかりません。'
            });
        }

        const userId = event.context.user.id;
        const userHistoryPath = getUserHistoryPath(userId);
        const userDir = path.dirname(userHistoryPath);

        // ユーザーディレクトリの自動生成
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        // 履歴ファイルが存在しない場合のマイグレーション／初期化処理
        if (!fs.existsSync(userHistoryPath)) {
            if (fs.existsSync(HISTORY_TEMPLATE_PATH)) {
                fs.copyFileSync(HISTORY_TEMPLATE_PATH, userHistoryPath);
                console.log(`[Server] ルートの chat_history.json をユーザー用履歴として初期化コピーしました: ${userId}`);
            } else {
                fs.writeFileSync(userHistoryPath, JSON.stringify({}, null, 4), 'utf8');
                console.log(`[Server] 空の chat_history.json を作成しました: ${userId}`);
            }
        }

        const data = fs.readFileSync(userHistoryPath, 'utf8');
        return { success: true, history: JSON.parse(data) };
    } catch (error: any) {
        console.error('[Server] Failed to load chat history:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
