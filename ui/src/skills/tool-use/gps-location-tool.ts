import { tool } from '@lmstudio/sdk';

export const gpsLocationTool = tool({
    name: 'getGPSLocation',
    description: 'IPアドレスに基づき、ユーザーの現在の大まかな位置情報（都市名、緯度・経度）を取得します。',
    parameters: {},
    implementation: async () => {
        try {
            const res = await fetch('http://ip-api.com/json/?lang=ja');
            if (!res.ok) {
                return '位置情報の取得に失敗しました。';
            }
            const data = (await res.json()) as any;
            return JSON.stringify({
                city: data.city || '東京',
                latitude: data.lat || 35.6895,
                longitude: data.lon || 139.6917,
                country: data.country || '日本'
            });
        } catch (e: any) {
            console.error('GPS位置情報取得エラー:', e);
            return JSON.stringify({
                city: '東京',
                latitude: 35.6895,
                longitude: 139.6917,
                country: '日本',
                note: 'フォールバック値'
            });
        }
    }
});
