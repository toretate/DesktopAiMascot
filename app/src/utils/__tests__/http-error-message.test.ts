import { describe, expect, it } from 'vitest';
import { getHttpErrorMessage } from '../http-error-message';

describe('getHttpErrorMessage', () => {
    it('getHttpErrorMessage_401の場合は未認証と認証バイパス設定を案内すること', () => {
        expect(getHttpErrorMessage(401)).toBe(
            '未認証です。ログインするか、家庭内テストではサーバーに ALLOW_AUTH_BYPASS=true を設定して再起動してください。'
        );
    });

    it('getHttpErrorMessage_403の場合は権限不足を案内すること', () => {
        expect(getHttpErrorMessage(403)).toBe('この操作を実行する権限がありません。');
    });

    it('getHttpErrorMessage_その他のステータスはHTTPステータスを返すこと', () => {
        expect(getHttpErrorMessage(500)).toBe('HTTP 500');
    });
});
