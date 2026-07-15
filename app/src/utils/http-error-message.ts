/**
 * APIのHTTPステータスを、画面に表示できる利用者向けメッセージへ変換します。
 */
export function getHttpErrorMessage(status: number): string {
    if (status === 401) {
        return '未認証です。ログインするか、家庭内テストではサーバーに ALLOW_AUTH_BYPASS=true を設定して再起動してください。';
    }
    if (status === 403) {
        return 'この操作を実行する権限がありません。';
    }
    return `HTTP ${status}`;
}
