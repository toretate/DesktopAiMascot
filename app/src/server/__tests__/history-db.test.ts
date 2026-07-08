import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// paths モジュールの PROJECT_ROOT をテスト用の一時フォルダにモック化
vi.mock('../utils/paths', async (importOriginal) => {
    const actual = await importOriginal() as any;
    const path = await import('path');
    const mockRoot = path.resolve(__dirname, './tmp-history-db-test');
    return {
        ...actual,
        PROJECT_ROOT: mockRoot,
        USERS_DIR: path.join(mockRoot, 'storage/users'),
        HISTORY_TEMPLATE_PATH: path.join(mockRoot, 'chat_history.json')
    };
});

import { getHistoryDB, loadHistoryFromDB, saveHistoryToDB, migrateHistoryJsonToDB, closeAllHistoryDBs } from '../utils/history-db';

describe('履歴 SQLite データベース (history-db.ts) のテスト', () => {
    const testProjectRoot = path.resolve(__dirname, './tmp-history-db-test');
    const userId = 'test_user_999';
    const userDir = path.join(testProjectRoot, 'storage/users', userId);
    const dbPath = path.join(userDir, 'chat_histories.db');

    beforeEach(() => {
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        // テストごとにデータベーステーブルをクリーンアップ
        try {
            const db = getHistoryDB(userId);
            db.exec('DELETE FROM chat_sessions');
            db.exec('DELETE FROM session_participants');
            db.exec('DELETE FROM messages');
            db.exec('DELETE FROM message_attachments');
        } catch (e) {
            // 無視
        }
    });

    afterAll(() => {
        // すべての接続をクローズ
        closeAllHistoryDBs();

        // テスト一時フォルダの再帰的削除
        if (fs.existsSync(testProjectRoot)) {
            fs.rmSync(testProjectRoot, { recursive: true, force: true });
        }
    });

    it('getHistoryDB により chat_histories.db ファイルが作成され、スキーマが初期化されること', () => {
        const db = getHistoryDB(userId);
        expect(fs.existsSync(dbPath)).toBe(true);

        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
        const tableNames = tables.map(t => t.name);
        expect(tableNames).toContain('chat_sessions');
        expect(tableNames).toContain('session_participants');
        expect(tableNames).toContain('messages');
        expect(tableNames).toContain('message_attachments');
    });

    it('saveHistoryToDB と loadHistoryFromDB により、対話履歴の保存とロードができること', () => {
        const sampleHistory = {
            mascot_1: {
                activeSessionId: 'session_1',
                sessions: [
                    {
                        id: 'session_1',
                        title: 'こんにちはの会話',
                        timestamp: 1780000000000,
                        messages: [
                            { id: 1, sender: 'mascot', text: 'こんにちは！' },
                            { id: 1780000001000, sender: 'user', text: 'お元気ですか？' },
                            { id: 1780000002000, sender: 'mascot', text: '元気です！' }
                        ]
                    }
                ]
            }
        };

        // 保存
        saveHistoryToDB(userId, sampleHistory);

        // 取得して検証
        const loaded = loadHistoryFromDB(userId);
        expect(loaded).toBeDefined();
        expect(loaded.mascot_1).toBeDefined();
        expect(loaded.mascot_1.activeSessionId).toBe('session_1');
        expect(loaded.mascot_1.sessions.length).toBe(1);
        expect(loaded.mascot_1.sessions[0].id).toBe('session_1');
        expect(loaded.mascot_1.sessions[0].title).toBe('こんにちはの会話');
        expect(loaded.mascot_1.sessions[0].messages.length).toBe(3);
        expect(loaded.mascot_1.sessions[0].messages[0].text).toBe('こんにちは！');
        expect(loaded.mascot_1.sessions[0].messages[1].sender).toBe('user');
    });

    it('添付ファイル付きのメッセージを保存・ロードできること', () => {
        const sampleHistory = {
            mascot_1: {
                activeSessionId: 'session_att_test',
                sessions: [
                    {
                        id: 'session_att_test',
                        title: '添付ファイルテスト',
                        timestamp: 1780000000000,
                        messages: [
                            {
                                id: 1,
                                sender: 'user',
                                text: 'この画像を見て！',
                                attachments: [
                                    {
                                        id: 'att_1',
                                        path: '/mascots/users/test_user_999/image1.png',
                                        type: 'image/png',
                                        size: 1024
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        };

        saveHistoryToDB(userId, sampleHistory);

        const loaded = loadHistoryFromDB(userId);
        const msg = loaded.mascot_1.sessions[0].messages[0];
        expect(msg.attachments).toBeDefined();
        expect(msg.attachments.length).toBe(1);
        expect(msg.attachments[0].id).toBe('att_1');
        expect(msg.attachments[0].path).toBe('/mascots/users/test_user_999/image1.png');
        expect(msg.attachments[0].type).toBe('image/png');
        expect(msg.attachments[0].size).toBe(1024);
    });

    it('複数の参加者 (participants) を持つグループ会話セッションを正しく保存・ロードできること', () => {
        const sampleHistory = {
            mascot_1: {
                activeSessionId: 'session_group_1',
                sessions: [
                    {
                        id: 'session_group_1',
                        title: 'マスコット座談会',
                        timestamp: 1780000000000,
                        participants: [
                            { id: 'test_user_999', type: 'user' },
                            { id: 'mascot_1', type: 'mascot' },
                            { id: 'mascot_2', type: 'mascot' }
                        ],
                        messages: [
                            { id: 1, sender: 'mascot', text: 'こんにちは！' }
                        ]
                    }
                ]
            }
        };

        saveHistoryToDB(userId, sampleHistory);

        const loaded = loadHistoryFromDB(userId);
        
        // mascot_1 と mascot_2 の両方の履歴にセッションが現れること
        expect(loaded.mascot_1).toBeDefined();
        expect(loaded.mascot_1.sessions[0].participants.length).toBe(3);
        
        // 参加者リストの検証
        const parts = loaded.mascot_1.sessions[0].participants;
        const ids = parts.map((p: any) => p.id);
        expect(ids).toContain('test_user_999');
        expect(ids).toContain('mascot_1');
        expect(ids).toContain('mascot_2');
    });

    it('保存データから削除されたセッションが、DBからもクリーンアップされること', () => {
        const historyWithTwoSessions = {
            mascot_1: {
                activeSessionId: 'session_2',
                sessions: [
                    {
                        id: 'session_1',
                        title: 'セッション1',
                        timestamp: 1780000000000,
                        messages: [{ id: 1, sender: 'mascot', text: 'こんにちは' }]
                    },
                    {
                        id: 'session_2',
                        title: 'セッション2',
                        timestamp: 1780000010000,
                        messages: [{ id: 2, sender: 'mascot', text: 'おやすみ' }]
                    }
                ]
            }
        };

        saveHistoryToDB(userId, historyWithTwoSessions);
        let loaded = loadHistoryFromDB(userId);
        expect(loaded.mascot_1.sessions.length).toBe(2);

        // セッション1 を除外したデータを保存
        const historyWithOneSession = {
            mascot_1: {
                activeSessionId: 'session_2',
                sessions: [
                    {
                        id: 'session_2',
                        title: 'セッション2',
                        timestamp: 1780000010000,
                        messages: [{ id: 2, sender: 'mascot', text: 'おやすみ' }]
                    }
                ]
            }
        };

        saveHistoryToDB(userId, historyWithOneSession);
        loaded = loadHistoryFromDB(userId);
        expect(loaded.mascot_1.sessions.length).toBe(1);
        expect(loaded.mascot_1.sessions[0].id).toBe('session_2');

        // セッション1 が完全に消えていることをDBのローレコードで直接確認
        const db = getHistoryDB(userId);
        const row = db.prepare('SELECT * FROM chat_sessions WHERE session_id = ?').get('session_1');
        expect(row).toBeUndefined();
    });

    it('migrateHistoryJsonToDB により既存の chat_history.json からインポートされ、元ファイルが .imported にリネームされること', () => {
        const jsonHistory = {
            mascot_test: {
                activeSessionId: 'session_json_1',
                sessions: [
                    {
                        id: 'session_json_1',
                        title: 'JSONの対話',
                        timestamp: 1781000000000,
                        messages: [
                            { id: 1, sender: 'mascot', text: 'JSONからのインポートテスト' }
                        ]
                    }
                ]
            }
        };

        const jsonFilePath = path.join(userDir, 'chat_history.json');
        fs.writeFileSync(jsonFilePath, JSON.stringify(jsonHistory, null, 4), 'utf8');

        // マイグレーション実行
        migrateHistoryJsonToDB(userId);

        // 元ファイルがリネームされていること
        expect(fs.existsSync(jsonFilePath)).toBe(false);
        expect(fs.existsSync(jsonFilePath + '.imported')).toBe(true);

        // DBにデータが移行されていること
        const loaded = loadHistoryFromDB(userId);
        expect(loaded.mascot_test).toBeDefined();
        expect(loaded.mascot_test.activeSessionId).toBe('session_json_1');
        expect(loaded.mascot_test.sessions[0].title).toBe('JSONの対話');
        expect(loaded.mascot_test.sessions[0].messages[0].text).toBe('JSONからのインポートテスト');
    });

    it('saveHistoryToDB で更新日時を指定したとき、自動更新トリガー等によって現在時刻に上書きされないこと', () => {
        const mascotId = 'mascot_1';
        const sessionId = 'session_timestamp_test';
        const pastTimestamp = 1767225600000; // 2026/01/01
        
        const historyData = {
            [mascotId]: {
                activeSessionId: sessionId,
                sessions: [
                    {
                        id: sessionId,
                        title: 'タイムスタンプテスト',
                        timestamp: pastTimestamp,
                        messages: [{ id: 1, sender: 'mascot', text: 'テストです' }]
                    }
                ]
            }
        };

        saveHistoryToDB(userId, historyData);

        let loaded = loadHistoryFromDB(userId);
        expect(loaded[mascotId].sessions[0].timestamp).toBe(pastTimestamp);

        // 2回目の保存（タイトル更新）でタイムスタンプが上書きされないか検証
        historyData[mascotId].sessions[0].title = '更新されたタイトル';
        saveHistoryToDB(userId, historyData);

        loaded = loadHistoryFromDB(userId);
        expect(loaded[mascotId].sessions[0].timestamp).toBe(pastTimestamp);
    });
});
