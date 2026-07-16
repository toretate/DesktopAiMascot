import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// paths モジュールをテスト用の一時フォルダにモック化
vi.mock('../utils/paths', async (importOriginal) => {
    const actual = await importOriginal() as any;
    const p = await import('path');
    const mockRoot = p.resolve(__dirname, './tmp-tasks-service-test');
    return {
        ...actual,
        PROJECT_ROOT: mockRoot,
        STORAGE_DIR: p.join(mockRoot, 'storage'),
        USERS_DIR: p.join(mockRoot, 'storage/users'),
        USERS_FILE_PATH: p.join(mockRoot, 'storage/users.json')
    };
});

import { addTaskToDb } from '../utils/tasks-service';

const testRoot = path.resolve(__dirname, './tmp-tasks-service-test');
const userId = 'testuser';
const tasksPath = path.join(testRoot, 'storage/users', userId, 'tasks.json');

function readTasks(): any[] {
    if (!fs.existsSync(tasksPath)) return [];
    return JSON.parse(fs.readFileSync(tasksPath, 'utf8')).tasks || [];
}

describe('tasks-service addTaskToDb - 冪等化ガード（履歴リプレイ対策）', () => {
    beforeEach(() => {
        // 各テスト前にユーザーの tasks.json を削除してクリーンにする
        if (fs.existsSync(tasksPath)) fs.unlinkSync(tasksPath);
    });

    afterAll(() => {
        if (fs.existsSync(testRoot)) fs.rmSync(testRoot, { recursive: true, force: true });
    });

    it('同一タイトル・同一予定日時・同一カテゴリの未完了タスクは重複追加されない', () => {
        const first = addTaskToDb(userId, { title: '牛乳を買う', scheduledAt: '2026-07-10T10:00:00+09:00' });
        const second = addTaskToDb(userId, { title: '牛乳を買う', scheduledAt: '2026-07-10T10:00:00+09:00' });

        expect((second as any).duplicate).toBe(true);
        expect(second.task.id).toBe(first.task.id);
        expect(readTasks().length).toBe(1);
    });

    it('タイトルが同じでも予定日時が異なれば別タスクとして追加される', () => {
        addTaskToDb(userId, { title: '会議', scheduledAt: '2026-07-10T10:00:00+09:00' });
        const second = addTaskToDb(userId, { title: '会議', scheduledAt: '2026-07-11T10:00:00+09:00' });

        expect((second as any).duplicate).toBeUndefined();
        expect(readTasks().length).toBe(2);
    });

    it('期限なしタスクも同一タイトルなら重複追加されない', () => {
        addTaskToDb(userId, { title: 'レポートを書く' });
        const second = addTaskToDb(userId, { title: 'レポートを書く' });

        expect((second as any).duplicate).toBe(true);
        expect(readTasks().length).toBe(1);
    });

    it('addTaskToDb - 標準の会議カテゴリが追加されること', () => {
        const result = addTaskToDb(userId, {
            title: '定例会議',
            categoryId: 'meeting',
            scheduledAt: '2026-07-16T10:00:00+09:00'
        });

        expect(result.task.categoryId).toBe('meeting');
        expect(result.task.scheduledEndAt).toBe('2026-07-16T02:00:00.000Z');
        expect(result.categories).toContainEqual({ id: 'meeting', name: '会議', order: 2 });
    });
});
