import { defineEventHandler, readBody, createError } from 'h3';
import fs from 'fs';
import path from 'path';
import { USERS_DIR } from '../utils/paths';

function getUserHistoryPath(userId: string): string {
    return path.join(USERS_DIR, userId, 'chat_history.json');
}

export default defineEventHandler(async (event) => {
    try {
        console.log('[Server] Save chat history request received');
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

        const history = await readBody(event);
        fs.writeFileSync(userHistoryPath, JSON.stringify(history, null, 4), 'utf8');
        console.log(`[Server] chat_history.json saved successfully for user: ${userId}`);
        return { success: true };
    } catch (error: any) {
        console.error('[Server] Failed to save chat history:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
