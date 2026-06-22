import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { verifyGoogleIdToken } from '../services/auth-service';

// ExpressのRequestインターフェースにuserプロパティを追加
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string; // 内部ユーザーID
                email: string; // 表示用・互換性用のメールアドレス
                role: string;
            };
        }
    }
}

export interface Identity {
    provider: string;
    providerUserId: string;
    email: string;
}

export interface User {
    id: string; // 内部ユーザーID
    role: string;
    createdAt?: string;
    identities: Identity[];
}

interface UsersConfig {
    users: User[];
}

const USERS_FILE_PATH = path.resolve(__dirname, '../../../users.json');

// users.jsonを読み込む関数
export function readUsersConfig(): UsersConfig {
    try {
        if (!fs.existsSync(USERS_FILE_PATH)) {
            return { users: [] };
        }
        const data = fs.readFileSync(USERS_FILE_PATH, 'utf8');
        const parsed = JSON.parse(data);

        // 旧形式 allowedUsers が存在する場合のマイグレーション処理
        if (parsed.allowedUsers && !parsed.users) {
            const migratedUsers: User[] = parsed.allowedUsers.map((oldUser: any) => {
                const internalId = oldUser.sub === 'local-dev-bypass'
                    ? 'usr_local_dev_bypass'
                    : `usr_${crypto.randomBytes(8).toString('hex')}`;

                const identities: Identity[] = [];
                if (oldUser.email) {
                    identities.push({
                        provider: 'google',
                        providerUserId: oldUser.sub || '',
                        email: oldUser.email
                    });
                }

                return {
                    id: internalId,
                    role: oldUser.role || 'user',
                    createdAt: new Date().toISOString(),
                    identities
                };
            });
            const newConfig = { users: migratedUsers };
            writeUsersConfig(newConfig);
            console.log('[Auth] users.json を新形式（内部ユーザーID仲介モデル）にマイグレーションしました。');
            return newConfig;
        }

        return parsed as UsersConfig;
    } catch (error) {
        console.error('users.jsonの読み込みに失敗しました:', error);
        return { users: [] };
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
    
    // providerUserId が Google sub と一致するユーザーを検索
    let matchedUser = config.users.find(u =>
        u.identities.some(ident => ident.provider === 'google' && ident.providerUserId === sub)
    );

    if (matchedUser) {
        return matchedUser;
    }

    // subが一致しない場合、emailが一致し且つsubが未紐付け(空)のユーザーを探す
    const emailMatchedUser = config.users.find(u =>
        u.identities.some(ident => 
            ident.provider === 'google' &&
            ident.email.toLowerCase() === email &&
            (!ident.providerUserId || ident.providerUserId.trim() === '')
        )
    );

    if (emailMatchedUser) {
        // 初回ログイン時のアクティベーション（subの自動紐付け）
        const googleIdent = emailMatchedUser.identities.find(ident => 
            ident.provider === 'google' && ident.email.toLowerCase() === email
        );
        if (googleIdent) {
            googleIdent.providerUserId = sub;
            writeUsersConfig(config);
            console.log(`ユーザーの初回紐付けが完了しました: ${email} -> sub: ${sub}`);
            return emailMatchedUser;
        }
    }

    throw new Error('このアカウントでのアクセスは許可されていません。');
}

// Cookieを手動でパースするヘルパー関数
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    const list: Record<string, string> = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        const key = parts.shift()?.trim();
        if (key) {
            list[key] = decodeURIComponent(parts.join('='));
        }
    });
    return list;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    // ローカル（127.0.0.1 / ::1 / localhost）からのアクセスは認証を自動バイパスし、マスターデータを共有する
    const ip = req.ip || req.socket.remoteAddress;
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || req.hostname === 'localhost';

    if (isLocal) {
        req.user = {
            id: 'usr_local_dev_bypass',
            email: 'test-user@gmail.com',
            role: 'user'
        };
        return next();
    }

    let token = '';

    // 1. Authorization ヘッダーをチェック
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // 2. Cookie をチェック (session_token)
    if (!token) {
        const cookies = parseCookies(req.headers.cookie);
        token = cookies['session_token'];
    }

    if (!token) {
        return res.status(401).json({ error: '認証トークンが必要です。' });
    }

    try {
        const user = await authenticateUserToken(token);
        
        // ユーザーIDに紐づく主要なメールアドレス（Googleなど）を取得
        const primaryEmail = user.identities.find(ident => ident.email)?.email || '';

        req.user = {
            id: user.id,
            email: primaryEmail,
            role: user.role
        };
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
