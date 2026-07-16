import { defineEventHandler, createError, readBody } from 'h3';
import path from 'path';
import fs from 'fs';
import { USERS_DIR } from '../utils/paths';
import { safeWriteFileSync } from '../utils/fs-helpers';

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
        const userDir = path.dirname(tasksPath);

        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        const body = await readBody(event);
        const {
            categories,
            tasks,
            enableNotification,
            notificationMinutes,
            completionGraceSeconds,
            defaultDurationHours,
            muteNotificationsDuringMeetings
        } = body;
        const parsedDefaultDurationHours = Number(defaultDurationHours);

        const dataToSave = {
            categories: categories || [],
            tasks: tasks || [],
            enableNotification: enableNotification !== undefined ? enableNotification : true,
            notificationMinutes: notificationMinutes !== undefined ? notificationMinutes : 5,
            completionGraceSeconds: completionGraceSeconds !== undefined ? completionGraceSeconds : 5,
            defaultDurationHours: Number.isFinite(parsedDefaultDurationHours) && parsedDefaultDurationHours > 0
                ? parsedDefaultDurationHours
                : 1,
            muteNotificationsDuringMeetings: !!muteNotificationsDuringMeetings
        };

        safeWriteFileSync(tasksPath, JSON.stringify(dataToSave, null, 4));

        return { success: true };
    } catch (error: any) {
        console.error('[Server] Failed to save tasks:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
