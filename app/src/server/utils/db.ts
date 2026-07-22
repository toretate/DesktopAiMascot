import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { STORAGE_DIR } from './paths';

const DB_DIR = STORAGE_DIR;
const DB_PATH = path.join(DB_DIR, 'config.db');

let _db: Database.Database | null = null;

/**
 * アプリケーション共通データ用の config.db 接続を取得する
 */
export function getDB(): Database.Database {
    if (_db) return _db;

    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }

    console.log(`[DB] Connecting to SQLite config database at: ${DB_PATH}`);
    const db = new Database(DB_PATH);
    
    // パフォーマンス向上のための WAL モード有効化
    db.pragma('journal_mode = WAL');

    // アプリケーション全体設定用テーブルの初期化
    db.exec(`
        CREATE TABLE IF NOT EXISTS global_configs (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    _db = db;
    return db;
}
