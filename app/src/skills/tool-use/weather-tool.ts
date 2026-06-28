import { tool } from '@lmstudio/sdk';
import { z } from 'zod';

// 主要都市の代表的な緯度・経度マッピング
const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
    '東京': { latitude: 35.6895, longitude: 139.6917 },
    '大阪': { latitude: 34.6937, longitude: 135.5023 },
    '京都': { latitude: 35.0116, longitude: 135.7681 },
    '名古屋': { latitude: 35.1815, longitude: 136.9066 },
    '福岡': { latitude: 33.5904, longitude: 130.4017 },
    '札幌': { latitude: 43.0621, longitude: 141.3544 },
    '仙台': { latitude: 38.2682, longitude: 140.8694 },
    '広島': { latitude: 34.3853, longitude: 132.4553 },
    '那覇': { latitude: 26.2124, longitude: 127.6809 },
    '沖縄': { latitude: 26.2124, longitude: 127.6809 },
};

export const weatherTool = tool({
    name: 'getWeather',
    description: '指定された緯度・経度、または都市の現在の天気予報を取得します。緯度経度がわからない場合は都市名(city)のみを指定してください。',
    parameters: {
        latitude: z.number().optional().describe('緯度（例: 35.6895）'),
        longitude: z.number().optional().describe('経度（例: 139.6917）'),
        city: z.string().optional().describe('都市名（例: 大阪、東京）')
    },
    implementation: async ({ latitude, longitude, city }) => {
        try {
            let lat = latitude;
            let lon = longitude;

            // 都市名が指定されていて緯度経度がない場合、マッピングから解決を試みる
            if (city && (lat === undefined || lon === undefined)) {
                const cleanCity = city.replace(/(市|都|府|県)$/, '').trim();
                const coord = CITY_COORDINATES[cleanCity] || CITY_COORDINATES[city];
                if (coord) {
                    lat = coord.latitude;
                    lon = coord.longitude;
                } else {
                    // マッピングにない場合はデフォルトとして東京
                    lat = 35.6895;
                    lon = 139.6917;
                }
            }

            // 万が一どちらも取得できない場合は東京をデフォルトにする
            if (lat === undefined || lon === undefined) {
                lat = 35.6895;
                lon = 139.6917;
            }

            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FTokyo`;
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
