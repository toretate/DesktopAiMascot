import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { verifyGoogleIdToken } from '../services/auth-service';

// ExpressのRequestインターフェースにuserプロパティを追加
declare global {
    namespace Express {
        interface Request {
            user?: {
                email: string;
                sub: string;
                role: string;
            };
        }
    }
}

export interface User {
    email: string;
    sub: string;
    role: string;
}

interface UsersConfig {
    allowedUsers: User[];
}

const USERS_FILE_PATH = path.resolve(__dirname, '../../../users.json');

// users.jsonを読み込む関数
function readUsersConfig(): UsersConfig {
    try {
        if (!fs.existsSync(USERS_FILE_PATH)) {
            return { allowedUsers: [] };
        }
        const data = fs.readFileSync(USERS_FILE_PATH, 'utf8');
        return JSON.parse(data) as UsersConfig;
    } catch (error) {
        console.error('users.jsonの読み込みに失敗しました:', error);
        return { allowedUsers: [] };
    }
}

// users.jsonを書き込む関数
function writeUsersConfig(config: UsersConfig): void {
    try {
        fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('users.jsonの書き込みに失敗しました:', error);
    }
}

/**
 * トークンの検証を行い、対応するユーザー情報を取得・または初回紐付けする共通関数
 */
export async function authenticateUserToken(token: string): Promise<User> {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
        throw new Error('GOOGLE_CLIENT_ID が環境変数に設定されていません。');
    }

    // 1. Google IDトークンの検証
    const payload = await verifyGoogleIdToken(token, clientId);

    // 2. email_verified が true であることを確認（セキュリティ要件）
    if (!payload.email_verified) {
        throw new Error('メールアドレスが確認されていないGoogleアカウントです。');
    }

    const email = payload.email.toLowerCase();
    const sub = payload.sub;

    // 3. ユーザー設定の読み込みと認証・アクティベーション処理
    const config = readUsersConfig();
    let matchedUser = config.allowedUsers.find(u => u.sub === sub);

    if (matchedUser) {
        return matchedUser;
    }

    // subが一致しない場合、emailが一致し且つsubが未紐付け(空)のユーザーを探す
    const emailMatchedUserIndex = config.allowedUsers.findIndex(
        u => u.email.toLowerCase() === email && (!u.sub || u.sub.trim() === '')
    );

    if (emailMatchedUserIndex !== -1) {
        // 初回ログイン時のアクティベーション（subの自動紐付け）
        config.allowedUsers[emailMatchedUserIndex].sub = sub;
        writeUsersConfig(config);
        
        console.log(`ユーザーの初回紐付けが完了しました: ${email} -> sub: ${sub}`);
        return config.allowedUsers[emailMatchedUserIndex];
    }

    throw new Error('このアカウントでのアクセスは許可されていません。');
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '認証トークンが必要です。' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const user = await authenticateUserToken(token);
        req.user = user;
        return next();
    } catch (error: any) {
        console.error('認証ミドルウェアエラー:', error.message);
        if (error.message.includes('GOOGLE_CLIENT_ID')) {
            return res.status(500).json({ error: 'サーバーの認証設定が未完了です。' });
        }
        if (error.message.includes('許可されていません') || error.message.includes('確認されていない')) {
            return res.status(403).json({ error: error.message });
        }
        return res.status(401).json({ error: `認証に失敗しました: ${error.message}` });
    }
}

