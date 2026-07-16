import { describe, expect, it } from 'vitest';
import type { Task } from '../../../store/task';
import {
    formatScheduledDate,
    formatTaskTime,
    getScheduledDisplay,
    isTaskOverdue
} from '../taskDisplayUtils';

const makeTask = (updates: Partial<Task> = {}): Task => ({
    id: 'task-1',
    categoryId: 'work',
    title: 'テスト',
    completed: false,
    priority: 'normal',
    steps: [],
    order: 0,
    createdAt: '2026-07-17T00:00:00.000Z',
    status: 'todo',
    ...updates
});

describe('taskDisplayUtils', () => {
    it('isTaskOverdue_未完了で予定時刻を過ぎたタスクだけを期限超過にすること', () => {
        const now = new Date('2026-07-17T10:00:00+09:00').getTime();

        expect(isTaskOverdue(makeTask({ scheduledAt: '2026-07-17T09:00:00+09:00' }), now)).toBe(true);
        expect(isTaskOverdue(makeTask({ scheduledAt: '2026-07-17T11:00:00+09:00' }), now)).toBe(false);
        expect(isTaskOverdue(makeTask({ scheduledAt: '2026-07-17T09:00:00+09:00', completed: true }), now)).toBe(false);
    });

    it('formatTaskTime_タスク表示用の日時へ変換すること', () => {
        expect(formatTaskTime('2026-07-17T09:15:00+09:00')).toBe('7/17 09:15');
        expect(formatScheduledDate('2026-07-17T09:15:00+09:00')).toBe('2026/7/17 09:15');
    });

    it('getScheduledDisplay_予定までの相対時間を返すこと', () => {
        const now = new Date('2026-07-17T09:00:00+09:00');

        expect(getScheduledDisplay('2026-07-17T09:30:00+09:00', now)).toBe('後30分[30分]');
        expect(getScheduledDisplay('2026-07-17T08:30:00+09:00', now)).toBe('30分超過');
    });
});
