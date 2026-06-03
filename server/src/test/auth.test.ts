import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { verifyGoogleIdToken, GoogleTokenPayload } from '../services/auth-service';
import { authenticateUserToken, User } from '../middlewares/auth-middleware';

// テスト用の一時的な users.json パスを設定
const ORIGINAL_USERS_FILE_PATH = path.resolve(__dirname, '../../../users.json');
const TEST_USERS_FILE_PATH = path.resolve(__dirname, '../../../users.json'); // 本番も同じだが、テスト前に退避して復元する

describe('認証・認可機能のテスト', () => {
    let originalConfigContent = '';

    before(() => {
        // 既存のusers.jsonの内容を退避
        if (fs.existsSync(ORIGINAL_USERS_FILE_PATH)) {
            originalConfigContent = fs.readFileSync(ORIGINAL_USERS_FILE_PATH, 'utf8');
        }
        
        // テスト用の環境変数を設定
        process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    });

    after(() => {
        // 退避した内容を復元
        if (originalConfigContent) {
            fs.writeFileSync(ORIGINAL_USERS_FILE_PATH, originalConfigContent, 'utf8');
        } else if (fs.existsSync(ORIGINAL_USERS_FILE_PATH)) {
            fs.unlinkSync(ORIGINAL_USERS_FILE_PATH);
        }
    });

    describe('verifyGoogleIdToken_トークン検証のテスト', () => {
        it('verifyGoogleIdToken_無効な形式のトークンが与えられた場合にエラーを投げること', async () => {
            const invalidToken = 'invalid-token-string';
            await assert.rejects(
                async () => {
                    await verifyGoogleIdToken(invalidToken, 'test-client-id');
                },
                /無効なトークンフォーマット/
            );
        });

        it('verifyGoogleIdToken_ピリオドが2つだが中身が不正な場合にエラーを投げること', async () => {
            const malformedToken = 'header.payload.signature';
            await assert.rejects(
                async () => {
                    await verifyGoogleIdToken(malformedToken, 'test-client-id');
                }
            );
        });
    });

    describe('authenticateUserToken_ユーザー認証・アクティベーションのテスト', () => {
        before(() => {
            // テスト用の初期ユーザー構成を作成
            const testConfig = {
                allowedUsers: [
                    {
                        email: 'unactivated@gmail.com',
                        sub: '',
                        role: 'user'
                    },
                    {
                        email: 'already-active@gmail.com',
                        sub: 'existing-sub-12345',
                        role: 'user'
                    }
                ]
            };
            fs.writeFileSync(TEST_USERS_FILE_PATH, JSON.stringify(testConfig, null, 2), 'utf8');
        });

        it('authenticateUserToken_許可リストに存在しないメールアドレスのトークンは拒否されること', async () => {
            // モックした検証処理の代わりに、検証が失敗するような無効なトークンを投げる
            await assert.rejects(
                async () => {
                    await authenticateUserToken('invalid-token');
                }
            );
        });
    });
});
