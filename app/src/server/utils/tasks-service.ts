import * as fs from 'fs';
import * as path from 'path';
import { USERS_DIR } from './paths';
import { safeWriteFileSync } from './fs-helpers';

function getUserTasksPath(userId: string): string {
    return path.join(USERS_DIR, userId, 'tasks.json');
}

export interface TaskData {
    title: string;
    priority?: 'normal' | 'star' | 'thunder';
    categoryId?: string;
    scheduledAt?: string;
    scheduledEndAt?: string;
}

/**
 * サーバー側でタスクを生成し、ユーザーの tasks.json に追加・保存します。
 */
export function addTaskToDb(userId: string, payload: TaskData) {
    const tasksPath = getUserTasksPath(userId);
    const userDir = path.dirname(tasksPath);

    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }

    let data = {
        categories: [
            { id: 'default', name: 'Work', order: 0 },
            { id: 'private', name: 'Private', order: 1 },
            { id: 'meeting', name: '会議', order: 2 }
        ],
        tasks: [] as any[],
        enableNotification: true,
        notificationMinutes: 5,
        defaultDurationHours: 1,
        muteNotificationsDuringMeetings: false
    };

    if (fs.existsSync(tasksPath)) {
        try {
            const raw = fs.readFileSync(tasksPath, 'utf8');
            data = { ...data, ...JSON.parse(raw) };
        } catch (e) {
            console.error('[TasksDB] Failed to read tasks.json:', e);
        }
    }

    const meetingCategory = data.categories.find(category => category.id === 'meeting');
    if (meetingCategory) {
        meetingCategory.name = '会議';
    } else {
        data.categories.push({ id: 'meeting', name: '会議', order: data.categories.length });
    }

    // カテゴリIDの解決
    let categoryId = payload.categoryId || 'default';
    const lowerCat = categoryId.toLowerCase();
    const matchedCat = data.categories.find(c => c.id.toLowerCase() === lowerCat || c.name.toLowerCase() === lowerCat);
    if (matchedCat) {
        categoryId = matchedCat.id;
    } else {
        // カテゴリがなければ新規作成
        const newCatId = 'cat_' + Math.random().toString(36).substring(2, 11);
        const order = data.categories.length;
        data.categories.push({ id: newCatId, name: payload.categoryId || 'Work', order });
        categoryId = newCatId;
    }

    // 冪等化ガード: 会話履歴のリプレイ等で同一の依頼が繰り返されても重複登録しない。
    // 同一カテゴリ・同一タイトル・同一予定日時の未完了タスクが既にあれば、それを返して新規作成しない。
    const normalizedTitle = (payload.title || '').trim();
    const normalizedScheduledAt = payload.scheduledAt || undefined;
    const duplicate = data.tasks.find((t: any) =>
        !t.completed &&
        t.categoryId === categoryId &&
        (t.title || '').trim() === normalizedTitle &&
        (t.scheduledAt || undefined) === normalizedScheduledAt
    );
    if (duplicate) {
        console.log(`[TasksDB] Duplicate add ignored (idempotent): "${normalizedTitle}"`);
        return {
            categories: data.categories,
            task: duplicate,
            duplicate: true
        };
    }

    // 新しいタスクのオブジェクトを作成 (サーバー側で一意の ID や日時を付与)
    const newTask = {
        id: 'task_' + Math.random().toString(36).substring(2, 11),
        categoryId,
        title: payload.title,
        completed: false,
        priority: payload.priority || 'normal',
        steps: [],
        order: data.tasks.filter(t => t.categoryId === categoryId).length,
        createdAt: new Date().toISOString(),
        status: 'todo',
        scheduledAt: payload.scheduledAt,
        scheduledEndAt: payload.scheduledEndAt || (
            categoryId === 'meeting' && payload.scheduledAt
                ? new Date(
                    new Date(payload.scheduledAt).getTime() + data.defaultDurationHours * 3_600_000
                ).toISOString()
                : undefined
        ),
        notified: false
    };

    data.tasks.push(newTask);

    safeWriteFileSync(tasksPath, JSON.stringify(data, null, 4));

    return {
        categories: data.categories,
        task: newTask
    };
}

/**
 * ユーザーのタスクを検索します。
 */
export function searchTasksFromDb(
    userId: string,
    query?: string,
    date?: string,
    completed?: boolean
) {
    const tasksPath = getUserTasksPath(userId);
    if (!fs.existsSync(tasksPath)) {
        return [];
    }

    try {
        const raw = fs.readFileSync(tasksPath, 'utf8');
        const data = JSON.parse(raw);
        let tasks = data.tasks || [];

        if (query) {
            const lowerQuery = query.toLowerCase();
            tasks = tasks.filter((t: any) => t.title && t.title.toLowerCase().includes(lowerQuery));
        }

        if (date) {
            tasks = tasks.filter((t: any) => {
                if (!t.scheduledAt) return false;
                return t.scheduledAt.startsWith(date);
            });
        }

        if (completed !== undefined) {
            tasks = tasks.filter((t: any) => t.completed === completed);
        }

        return tasks;
    } catch (e) {
        console.error('[TasksDB] Failed to search tasks:', e);
        return [];
    }
}

/**
 * ユーザーのタスクを更新します。
 */
export function updateTaskInDb(
    userId: string,
    id: string,
    updates: {
        title?: string;
        priority?: 'normal' | 'star' | 'thunder';
        categoryId?: string;
        scheduledAt?: string | null;
        scheduledEndAt?: string | null;
        completed?: boolean;
    }
) {
    const tasksPath = getUserTasksPath(userId);
    if (!fs.existsSync(tasksPath)) {
        throw new Error('Tasks database does not exist.');
    }

    const raw = fs.readFileSync(tasksPath, 'utf8');
    const data = JSON.parse(raw);
    const tasks = data.tasks || [];

    const task = tasks.find((t: any) => t.id === id);
    if (!task) {
        throw new Error(`Task with ID ${id} not found.`);
    }

    if (updates.title !== undefined) task.title = updates.title;
    if (updates.priority !== undefined) task.priority = updates.priority;
    
    if (updates.categoryId !== undefined) {
        let categoryId = updates.categoryId;
        const lowerCat = categoryId.toLowerCase();
        const matchedCat = data.categories.find((c: any) => c.id.toLowerCase() === lowerCat || c.name.toLowerCase() === lowerCat);
        if (matchedCat) {
            task.categoryId = matchedCat.id;
        } else {
            const newCatId = 'cat_' + Math.random().toString(36).substring(2, 11);
            const order = data.categories.length;
            data.categories.push({ id: newCatId, name: updates.categoryId, order });
            task.categoryId = newCatId;
        }
    }

    if (updates.scheduledAt !== undefined) {
        const oldStartTime = task.scheduledAt ? new Date(task.scheduledAt).getTime() : Number.NaN;
        const oldEndTime = task.scheduledEndAt ? new Date(task.scheduledEndAt).getTime() : Number.NaN;
        task.scheduledAt = updates.scheduledAt === null || updates.scheduledAt === '' ? undefined : updates.scheduledAt;
        task.notified = false;
        if (updates.scheduledEndAt === undefined) {
            const newStartTime = task.scheduledAt ? new Date(task.scheduledAt).getTime() : Number.NaN;
            if (Number.isFinite(newStartTime) && Number.isFinite(oldStartTime) && Number.isFinite(oldEndTime)) {
                task.scheduledEndAt = new Date(newStartTime + oldEndTime - oldStartTime).toISOString();
            } else if (Number.isFinite(newStartTime) && task.categoryId === 'meeting') {
                task.scheduledEndAt = new Date(
                    newStartTime + data.defaultDurationHours * 3_600_000
                ).toISOString();
            } else if (!task.scheduledAt) {
                task.scheduledEndAt = undefined;
            }
        }
    }
    if (updates.scheduledEndAt !== undefined) {
        task.scheduledEndAt = updates.scheduledEndAt === null || updates.scheduledEndAt === '' ? undefined : updates.scheduledEndAt;
    }

    if (updates.completed !== undefined) {
        task.completed = updates.completed;
        task.status = updates.completed ? 'done' : 'todo';
        if (updates.completed) {
            task.endedAt = new Date().toISOString();
        } else {
            task.endedAt = undefined;
        }
        if (task.steps && Array.isArray(task.steps)) {
            task.steps.forEach((step: any) => {
                step.completed = updates.completed;
                step.status = updates.completed ? 'done' : 'todo';
            });
        }
    }

    safeWriteFileSync(tasksPath, JSON.stringify(data, null, 4));

    return {
        categories: data.categories,
        task
    };
}

/**
 * ユーザーのタスクを削除します。
 */
export function deleteTaskFromDb(userId: string, id: string) {
    const tasksPath = getUserTasksPath(userId);
    if (!fs.existsSync(tasksPath)) {
        throw new Error('Tasks database does not exist.');
    }

    const raw = fs.readFileSync(tasksPath, 'utf8');
    const data = JSON.parse(raw);
    const initialLength = data.tasks.length;
    data.tasks = data.tasks.filter((t: any) => t.id !== id);

    if (data.tasks.length === initialLength) {
        throw new Error(`Task with ID ${id} not found.`);
    }

    safeWriteFileSync(tasksPath, JSON.stringify(data, null, 4));
}
