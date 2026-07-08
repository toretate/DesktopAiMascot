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
            notificationMinutes: 5
        };

        if (fs.existsSync(tasksPath)) {
            try {
                const fileData = fs.readFileSync(tasksPath, 'utf8');
                const parsed = JSON.parse(fileData);
                data = { ...data, ...parsed };
            } catch (e: any) {
                console.error(`[Server] tasks.json のロードに失敗しました: ${e.message}`);
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
