import { defineEventHandler, createError } from 'h3';
import fs from 'fs';
import path from 'path';
import { USERS_DIR } from '../utils/paths';

function getUserTasksPath(userId: string): string {
    return path.join(USERS_DIR, userId, 'tasks.json');
}

export default defineEventHandler(async (event) => {
    try {
        if (!event.context.user) {
            throw createError({
                statusCode: 401,
                statusMessage: '認証情報が見つかりません。'
            });
        }

        const userId = event.context.user.id;
        const tasksPath = getUserTasksPath(userId);

        let data = {
            categories: [],
            tasks: [],
            enableNotification: true,
            notificationMinutes: 5,
            completionGraceSeconds: 5,
            defaultDurationHours: 1,
            muteNotificationsDuringMeetings: false
        };

        if (fs.existsSync(tasksPath)) {
            let fileData: string;
            try {
                fileData = fs.readFileSync(tasksPath, 'utf8');
            } catch (e: any) {
                // 既存ファイルの読み取り失敗はエラーとして返す。
                // 空の success を返すとクライアントが LocalStorage の正常データを空で上書きして消失するため。
                console.error(`[Server] tasks.json の読み取りに失敗しました: ${e.message}`);
                throw createError({
                    statusCode: 500,
                    statusMessage: `tasks.json の読み取りに失敗しました: ${e.message}`
                });
            }
            try {
                const parsed = JSON.parse(fileData);
                data = { ...data, ...parsed };
            } catch (e: any) {
                // JSON 破損時も同様にエラーを返し、クライアント側のローカルデータを保護する。
                console.error(`[Server] tasks.json の解析に失敗しました（破損の可能性）: ${e.message}`);
                throw createError({
                    statusCode: 500,
                    statusMessage: `tasks.json が破損しています: ${e.message}`
                });
            }
        }

        return { success: true, ...data };
    } catch (error: any) {
        console.error('[Server] Failed to load tasks:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
