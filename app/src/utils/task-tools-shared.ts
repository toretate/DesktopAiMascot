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
