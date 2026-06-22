import { tool } from '@lmstudio/sdk';
import { z } from 'zod';

export const weatherTool = tool({
    name: 'getWeather',
    description: '指定された緯度・経度、または都市の現在の天気予報を取得します。',
    parameters: {
        latitude: z.number().describe('緯度（例: 35.6895）'),
        longitude: z.number().describe('経度（例: 139.6917）'),
        city: z.string().optional().describe('都市名（表示用）')
    },
    implementation: async ({ latitude, longitude, city }) => {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FTokyo`;
            const res = await fetch(url);
            if (!res.ok) {
                return '天気情報の取得に失敗しました。';
            }
            const data = (await res.json()) as any;
            const current = data.current;
            
            const weatherMap: Record<number, string> = {
                0: '晴れ', 1: '主に晴れ', 2: '一部曇り', 3: '曇り',
                45: '霧', 48: '霧氷',
                51: '軽度の小雨', 53: '小雨', 55: '重度の小雨',
                61: '小雨', 63: '雨', 65: '大雨',
                71: '小雪', 73: '雪', 75: '大雪',
                77: '細氷',
                80: 'にわか雨', 81: '激しいにわか雨', 82: '猛烈なにわか雨',
                85: '軽い雪', 86: '大雪',
                95: '雷雨', 96: '激しい雷雨'
            };
            const weatherDesc = weatherMap[current.weather_code] || '不明';

            return JSON.stringify({
                city: city || '指定地点',
                temperature: `${current.temperature_2m}°C`,
                humidity: `${current.relative_humidity_2m}%`,
                weather: weatherDesc,
                windSpeed: `${current.wind_speed_10m} km/h`
            });
        } catch (e: any) {
            console.error('天気予報取得エラー:', e);
            return '天気予報の取得処理でエラーが発生しました。';
        }
    }
});
