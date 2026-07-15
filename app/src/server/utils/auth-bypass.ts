/**
 * 明示的な環境変数が有効な場合に限り、開発・家庭内テスト用の認証バイパスを許可します。
 */
export function isAuthBypassAllowed(): boolean {
    return process.env.ALLOW_AUTH_BYPASS?.trim().toLowerCase() === 'true';
}
