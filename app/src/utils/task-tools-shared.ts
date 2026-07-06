import { tool } from '@lmstudio/sdk';
import { z } from 'zod';

export const addTaskToolShared = tool({
    name: 'addTask',
    description: '新しいタスク（TODO）を追加します。期限や予定日時がないタスクに対して使用します。',
    parameters: {
        title: z.string().describe('タスクの内容・タイトル'),
        priority: z.enum(['normal', 'star', 'thunder']).optional().default('normal').describe('タスクの優先度。デフォルトは normal。'),
        categoryId: z.string().optional().default('default').describe('追加先のカテゴリID。Work（仕事）の場合は default、Private（プライベート）の場合は private を指定してください。')
    },
    implementation: async ({ title, priority, categoryId }) => {
        return JSON.stringify({
            success: true,
            action: 'addTask',
            task: {
                title,
                priority,
                categoryId
            }
        });
    }
});

export const addScheduleToolShared = tool({
    name: 'addSchedule',
    description: '予定日時や期限付きのスケジュール（タスク）を追加します。カレンダーに登録するような日付や時間指定のあるタスクに使用します。',
    parameters: {
        title: z.string().describe('予定・タスクの内容・タイトル'),
        scheduledAt: z.string().describe('予定日時。ISO 8601形式の文字列 (例: 2026-07-06T18:00:00+09:00)。ユーザーが指示した日付・時間をこの形式に変換して指定してください。'),
        priority: z.enum(['normal', 'star', 'thunder']).optional().default('normal').describe('優先度。デフォルトは normal。'),
        categoryId: z.string().optional().default('default').describe('追加先のカテゴリID。Work（仕事）の場合は default、Private（プライベート）の場合は private を指定してください。')
    },
    implementation: async ({ title, scheduledAt, priority, categoryId }) => {
        return JSON.stringify({
            success: true,
            action: 'addSchedule',
            schedule: {
                title,
                scheduledAt,
                priority,
                categoryId
            }
        });
    }
});

export const searchTasksToolShared = tool({
    name: 'searchTasks',
    description: 'タスク（TODO）やスケジュール（予定）を検索します。キーワード、日付、完了状態で絞り込みが可能です。',
    parameters: {
        query: z.string().optional().describe('タイトルに含まれる検索キーワード（例: "買い物"）'),
        date: z.string().optional().describe('予定日。YYYY-MM-DD形式の文字列（例: "2026-07-06"）'),
        completed: z.boolean().optional().describe('完了状態で絞り込む場合は true、未完了で絞り込む場合は false。指定しない場合は両方を検索します。')
    },
    implementation: async ({ query, date, completed }) => {
        return JSON.stringify({
            success: true,
            action: 'searchTasks',
            query,
            date,
            completed,
            tasks: []
        });
    }
});

export const updateTaskToolShared = tool({
    name: 'updateTask',
    description: '指定されたIDのタスクまたはスケジュールを更新します。',
    parameters: {
        id: z.string().describe('更新対象のタスクID（必須）'),
        title: z.string().optional().describe('新しいタスクのタイトル'),
        priority: z.enum(['normal', 'star', 'thunder']).optional().describe('新しい優先度'),
        scheduledAt: z.string().nullable().optional().describe('新しい予定日時（ISO 8601形式）。日時指定を削除して期限なしタスクにしたい場合は空文字列 "" または null を指定してください。'),
        completed: z.boolean().optional().describe('完了状態。完了にする場合は true、未完了に戻す場合は false。')
    },
    implementation: async ({ id, title, priority, scheduledAt, completed }) => {
        return JSON.stringify({
            success: true,
            action: 'updateTask',
            task: {
                id,
                title,
                priority,
                scheduledAt,
                completed
            }
        });
    }
});

export const deleteTaskToolShared = tool({
    name: 'deleteTask',
    description: '指定されたIDのタスクまたはスケジュールを削除します。',
    parameters: {
        id: z.string().describe('削除対象のタスクID（必須）')
    },
    implementation: async ({ id }) => {
        return JSON.stringify({
            success: true,
            action: 'deleteTask',
            id
        });
    }
});

