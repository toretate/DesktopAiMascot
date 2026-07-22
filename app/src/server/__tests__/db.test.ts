import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// paths モジュールの保存先をテスト用の一時フォルダにモック化
vi.mock('../utils/paths', async (importOriginal) => {
    const actual = await importOriginal() as any;
    const path = await import('path');
    const mockRoot = path.resolve(__dirname, './tmp-db-test');
    return {
        ...actual,
        PROJECT_ROOT: mockRoot,
        STORAGE_DIR: path.join(mockRoot, 'storage'),
        USERS_DIR: path.join(mockRoot, 'storage/users')
    };
});

import { getDB } from '../utils/db';

describe('SQLite アプリ共通設定データベース (db.ts) のテスト', () => {
    const testProjectRoot = path.resolve(__dirname, './tmp-db-test');
    const dbDir = path.join(testProjectRoot, 'storage');
    const dbPath = path.join(dbDir, 'config.db');

    beforeEach(() => {
        if (!fs.existsSync(testProjectRoot)) {
            fs.mkdirSync(testProjectRoot, { recursive: true });
        }
        // テストごとにテーブルデータをクリア
        try {
            const db = getDB();
            db.exec('DELETE FROM global_configs');
        } catch (e) {
            // 未接続時は無視
        }
    });

    afterAll(() => {
        // 全テスト終了後に DB 接続を閉じる
        try {
            const db = getDB();
            db.close();
        } catch (e) {
            // 無視
        }

        // 一時ファイルの削除
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
        if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
        if (fs.existsSync(dbDir)) fs.rmdirSync(dbDir);
        if (fs.existsSync(testProjectRoot)) fs.rmdirSync(testProjectRoot);
    });

    it('getDB により config.db ファイルが作成され、global_configs テーブルが正しく作成されること', () => {
        const db = getDB();
        expect(fs.existsSync(dbPath)).toBe(true);

        // テーブルが存在することを確認
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
        const tableNames = tables.map(t => t.name);
        expect(tableNames).toContain('global_configs');
    });

    it('global_configs テーブルに対してデータの読み書きができること', () => {
        const db = getDB();
        
        // データの書き込み
        const insert = db.prepare('INSERT INTO global_configs (key, value) VALUES (?, ?)');
        insert.run('test_key', 'test_value');

        // データの読み込み
        const row = db.prepare('SELECT * FROM global_configs WHERE key = ?').get('test_key') as any;
        expect(row).toBeDefined();
        expect(row.key).toBe('test_key');
        expect(row.value).toBe('test_value');
    });
});
