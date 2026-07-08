import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { USERS_DIR } from './paths';

const dbCache = new Map<string, Database.Database>();

/**
 * ユーザーごとの対話履歴データベースの物理パスを取得する
 */
export function getHistoryDBPath(userId: string): string {
    return path.join(USERS_DIR, userId, 'chat_histories.db');
}

/**
 * ユーザーごとの SQLite chat_histories.db への接続を取得する
 */
export function getHistoryDB(userId: string): Database.Database {
    if (dbCache.has(userId)) {
        return dbCache.get(userId)!;
    }

    const dbPath = getHistoryDBPath(userId);
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    console.log(`[HistoryDB] Connecting to SQLite history database for user ${userId} at: ${dbPath}`);
    const db = new Database(dbPath);

    // パフォーマンスと整合性のための設定
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // スキーマ初期化
    db.exec(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
            session_id TEXT PRIMARY KEY,
            title TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS session_participants (
            session_id TEXT,
            participant_id TEXT,
            participant_type TEXT NOT NULL,
            PRIMARY KEY (session_id, participant_id),
            FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS messages (
            message_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            sender_type TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS message_attachments (
            attachment_id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE
        );
    `);

    // 以前に設定されていた自動更新トリガーを削除 (フロントエンドから渡される timestamp を維持するため)
    db.exec(`DROP TRIGGER IF EXISTS update_chat_sessions_time;`);

    dbCache.set(userId, db);
    return db;
}

/**
 * すべてのオープンされた履歴データベース接続を閉じる（テスト用・シャットダウン用）
 */
export function closeAllHistoryDBs(): void {
    for (const [userId, db] of dbCache.entries()) {
        try {
            db.close();
            console.log(`[HistoryDB] Closed database connection for user: ${userId}`);
        } catch (e: any) {
            console.error(`[HistoryDB] Failed to close database for user ${userId}:`, e.message);
        }
    }
    dbCache.clear();
}

/**
 * ミリ秒タイムスタンプを SQLite に適した DATETIME 文字列 (YYYY-MM-DD HH:MM:SS) にフォーマットする
 */
function formatDatetime(timestamp: number): string {
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/**
 * SQLite の DATETIME 文字列 (YYYY-MM-DD HH:MM:SS) をエポックミリ秒に安全に変換する
 */
function parseDatetime(datetimeStr: string): number {
    if (!datetimeStr) return Date.now();
    const isoStr = datetimeStr.replace(' ', 'T');
    const parsed = new Date(isoStr).getTime();
    return isNaN(parsed) ? Date.now() : parsed;
}

/**
 * 既存の chat_history.json が存在する場合、SQLite データベースにインポートする
 */
export function migrateHistoryJsonToDB(userId: string): void {
    const jsonPath = path.join(USERS_DIR, userId, 'chat_history.json');
    if (!fs.existsSync(jsonPath)) {
        return;
    }

    console.log(`[HistoryDB] Migrating chat_history.json to chat_histories.db for user: ${userId}`);
    let data: any = {};
    try {
        const fileContent = fs.readFileSync(jsonPath, 'utf8');
        data = JSON.parse(fileContent);
    } catch (e: any) {
        console.error(`[HistoryDB] Failed to parse chat_history.json for user ${userId}:`, e.message);
        return;
    }

    const db = getHistoryDB(userId);

    const insertSession = db.prepare(`
        INSERT OR IGNORE INTO chat_sessions (session_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
    `);

    const insertParticipant = db.prepare(`
        INSERT OR IGNORE INTO session_participants (session_id, participant_id, participant_type)
        VALUES (?, ?, ?)
    `);

    const insertMessage = db.prepare(`
        INSERT OR IGNORE INTO messages (message_id, session_id, sender_id, sender_type, content, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const runMigration = db.transaction(() => {
        for (const mascotId of Object.keys(data)) {
            const mascotData = data[mascotId];
            if (!mascotData || !Array.isArray(mascotData.sessions)) continue;

            for (const session of mascotData.sessions) {
                const sessionId = session.id;
                const title = session.title || '新しい会話';
                const sessionTime = session.timestamp ? formatDatetime(session.timestamp) : formatDatetime(Date.now());

                // セッション登録
                insertSession.run(sessionId, title, sessionTime, sessionTime);

                // 参加者登録
                insertParticipant.run(sessionId, userId, 'user');
                insertParticipant.run(sessionId, mascotId, 'mascot');

                // メッセージ登録
                if (Array.isArray(session.messages)) {
                    session.messages.forEach((msg: any, index: number) => {
                        const messageId = `${sessionId}_${msg.id || index}`;
                        const senderId = msg.sender === 'user' ? userId : mascotId;
                        const senderType = msg.sender === 'user' ? 'user' : 'mascot';
                        const content = msg.text || '';
                        
                        let msgTime = sessionTime;
                        if (msg.id && typeof msg.id === 'number' && msg.id > 1000000000000) {
                            msgTime = formatDatetime(msg.id);
                        } else {
                            if (session.timestamp) {
                                msgTime = formatDatetime(session.timestamp + index * 1000);
                            }
                        }

                        insertMessage.run(messageId, sessionId, senderId, senderType, content, msgTime);
                    });
                }
            }
        }
    });

    try {
        runMigration();
        console.log(`[HistoryDB] Successfully migrated chat_history.json for user: ${userId}`);

        // インポート完了後、元ファイルをリネーム
        const importedPath = jsonPath + '.imported';
        fs.renameSync(jsonPath, importedPath);
        console.log(`[HistoryDB] Renamed chat_history.json to: ${importedPath}`);
    } catch (err: any) {
        console.error(`[HistoryDB] Migration transaction failed for user ${userId}:`, err.message);
    }
}

/**
 * データベースから従来互換形式 of 対話履歴JSONオブジェクトをロードする
 */
export function loadHistoryFromDB(userId: string): any {
    // 初回読み込み時にマイグレーションを行う
    migrateHistoryJsonToDB(userId);

    const db = getHistoryDB(userId);
    const history: any = {};

    try {
        // すべてのセッションを取得（最終更新日時の降順）
        const sessions = db.prepare(`
            SELECT session_id, title, created_at, updated_at
            FROM chat_sessions
            ORDER BY updated_at DESC
        `).all() as any[];

        for (const session of sessions) {
            const sessionId = session.session_id;

            // セッションに参加しているマスコットのIDを取得
            const participants = db.prepare(`
                SELECT participant_id
                FROM session_participants
                WHERE session_id = ? AND participant_type = 'mascot'
            `).all(sessionId) as any[];

            // メッセージを送信日時の昇順で取得
            const messagesData = db.prepare(`
                SELECT message_id, sender_id, sender_type, content, timestamp
                FROM messages
                WHERE session_id = ?
                ORDER BY timestamp ASC
            `).all(sessionId) as any[];

            const messages = messagesData.map((msg: any) => {
                let originalId: any = msg.message_id;
                const prefix = `${sessionId}_`;
                if (msg.message_id.startsWith(prefix)) {
                    const suffix = msg.message_id.substring(prefix.length);
                    const num = Number(suffix);
                    if (!isNaN(num)) {
                        originalId = num;
                    } else {
                        originalId = suffix;
                    }
                }

                // 添付ファイルを取得
                const attachmentsData = db.prepare(`
                    SELECT attachment_id, file_path, file_type, file_size
                    FROM message_attachments
                    WHERE message_id = ?
                `).all(msg.message_id) as any[];

                const attachments = attachmentsData.map((att: any) => ({
                    id: att.attachment_id,
                    path: att.file_path,
                    type: att.file_type,
                    size: att.file_size
                }));

                const resultMsg: any = {
                    id: originalId,
                    sender: msg.sender_type,
                    text: msg.content
                };

                if (attachments.length > 0) {
                    resultMsg.attachments = attachments;
                }

                return resultMsg;
            });

            // SQLite の DATETIME 文字列をエポックミリ秒に戻す
            const sessionTimestamp = parseDatetime(session.updated_at);

            // セッションの参加メンバー全員を取得（マスコットだけでなくユーザーも含む）
            const allParticipantsData = db.prepare(`
                SELECT participant_id, participant_type
                FROM session_participants
                WHERE session_id = ?
            `).all(sessionId) as any[];

            const allParticipants = allParticipantsData.map((p: any) => ({
                id: p.participant_id,
                type: p.participant_type
            }));

            const sessionObj = {
                id: sessionId,
                title: session.title,
                timestamp: sessionTimestamp,
                participants: allParticipants,
                messages: messages
            };

            for (const p of participants) {
                const mascotId = p.participant_id;
                if (!history[mascotId]) {
                    history[mascotId] = {
                        activeSessionId: sessionId,
                        sessions: []
                    };
                }
                history[mascotId].sessions.push(sessionObj);
            }
        }

        // 各マスコットの sessions リストをタイムスタンプ降順でソートし、activeSessionId を確定
        for (const mascotId of Object.keys(history)) {
            history[mascotId].sessions.sort((a: any, b: any) => b.timestamp - a.timestamp);
            if (history[mascotId].sessions.length > 0) {
                history[mascotId].activeSessionId = history[mascotId].sessions[0].id;
            }
        }

    } catch (e: any) {
        console.error(`[HistoryDB] Failed to load history from database for user ${userId}:`, e.message);
    }

    return history;
}

/**
 * 従来互換形式の対話履歴JSONオブジェクトをデータベースに保存・同期する
 */
export function saveHistoryToDB(userId: string, historyData: any): void {
    const db = getHistoryDB(userId);

    const insertSession = db.prepare(`
        INSERT INTO chat_sessions (session_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
            title = excluded.title,
            updated_at = excluded.updated_at
    `);

    const insertParticipant = db.prepare(`
        INSERT OR IGNORE INTO session_participants (session_id, participant_id, participant_type)
        VALUES (?, ?, ?)
    `);

    const deleteParticipants = db.prepare(`
        DELETE FROM session_participants WHERE session_id = ?
    `);

    const deleteMessages = db.prepare(`
        DELETE FROM messages WHERE session_id = ?
    `);

    const insertMessage = db.prepare(`
        INSERT INTO messages (message_id, session_id, sender_id, sender_type, content, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(message_id) DO UPDATE SET
            content = excluded.content,
            timestamp = excluded.timestamp
    `);

    const deleteAttachments = db.prepare(`
        DELETE FROM message_attachments WHERE message_id = ?
    `);

    const insertAttachment = db.prepare(`
        INSERT INTO message_attachments (attachment_id, message_id, file_path, file_type, file_size)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(attachment_id) DO UPDATE SET
            file_path = excluded.file_path,
            file_type = excluded.file_type,
            file_size = excluded.file_size
    `);

    const allSessionIds: string[] = [];

    const runSave = db.transaction(() => {
        for (const mascotId of Object.keys(historyData)) {
            const mascotData = historyData[mascotId];
            if (!mascotData || !Array.isArray(mascotData.sessions)) continue;

            for (const session of mascotData.sessions) {
                const sessionId = session.id;
                allSessionIds.push(sessionId);
                const title = session.title || '新しい会話';
                const sessionTime = session.timestamp ? formatDatetime(session.timestamp) : formatDatetime(Date.now());

                // セッション情報更新
                insertSession.run(sessionId, title, sessionTime, sessionTime);

                // 参加者のクリアと再設定
                deleteParticipants.run(sessionId);

                // セッションに明示的な participants があればそれを使い、無ければデフォルトで user + mascot を登録
                if (Array.isArray(session.participants) && session.participants.length > 0) {
                    session.participants.forEach((p: any) => {
                        insertParticipant.run(sessionId, p.id, p.type);
                    });
                } else {
                    insertParticipant.run(sessionId, userId, 'user');
                    insertParticipant.run(sessionId, mascotId, 'mascot');
                }

                // メッセージのクリアと再設定
                deleteMessages.run(sessionId);
                if (Array.isArray(session.messages)) {
                    session.messages.forEach((msg: any, index: number) => {
                        const messageId = `${sessionId}_${msg.id || index}`;
                        const senderId = msg.sender === 'user' ? userId : mascotId;
                        const senderType = msg.sender === 'user' ? 'user' : 'mascot';
                        const content = msg.text || '';
                        
                        let msgTime = sessionTime;
                        if (msg.id && typeof msg.id === 'number' && msg.id > 1000000000000) {
                            msgTime = formatDatetime(msg.id);
                        } else {
                            if (session.timestamp) {
                                msgTime = formatDatetime(session.timestamp + index * 1000);
                            }
                        }

                        insertMessage.run(messageId, sessionId, senderId, senderType, content, msgTime);

                        // メッセージの添付ファイルの処理 (あれば登録)
                        deleteAttachments.run(messageId);
                        if (Array.isArray(msg.attachments)) {
                            msg.attachments.forEach((att: any, attIdx: number) => {
                                const attId = att.id || `${messageId}_att_${attIdx}`;
                                insertAttachment.run(
                                    attId,
                                    messageId,
                                    att.path || att.file_path || '',
                                    att.type || att.file_type || 'image/png',
                                    att.size || att.file_size || null
                                );
                            });
                        }
                    });
                }
            }
        }

        // DB内のセッションのうち、送信されたデータに含まれないものを削除
        if (allSessionIds.length > 0) {
            const placeholders = allSessionIds.map(() => '?').join(',');
            db.pragma('foreign_keys = ON');
            db.prepare(`
                DELETE FROM chat_sessions
                WHERE session_id NOT IN (${placeholders})
            `).run(...allSessionIds);
        } else {
            // 空データの場合は全セッション削除
            db.exec('DELETE FROM chat_sessions');
        }
    });

    try {
        runSave();
        console.log(`[HistoryDB] Successfully saved history to database for user: ${userId}`);
    } catch (e: any) {
        console.error(`[HistoryDB] Failed to save history to database for user ${userId}:`, e.message);
        throw e;
    }
}
