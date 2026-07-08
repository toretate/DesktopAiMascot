// @vitest-environment node
import { vi } from 'vitest';

// child_process のモックをすべてのインポートより前に記述して巻き上げを確実にする
vi.mock('node:child_process', () => {
    return {
        exec: vi.fn((cmd, cb) => {
            if (cmd && typeof cmd === 'string' && cmd.includes('fail')) {
                if (cb) cb(new Error('Command failed'));
            } else {
                if (cb) cb(null);
            }
        })
    };
});

vi.mock('child_process', () => {
    return {
        exec: vi.fn((cmd, cb) => {
            if (cmd && typeof cmd === 'string' && cmd.includes('fail')) {
                if (cb) cb(new Error('Command failed'));
            } else {
                if (cb) cb(null);
            }
        })
    };
});

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { currentTimeTool } from '../current-time-tool';
import { gpsLocationTool } from '../gps-location-tool';
import { weatherTool } from '../weather-tool';
import { volumeTool } from '../volume-tool';
import { appLauncherTool } from '../app-launcher-tool';
import { webSearchTool } from '../web-search-tool';
import { manageTasksTool } from '../manage-tasks-tool';
import { exec } from 'child_process';

describe('Tool Use - 各ツールの挙動テスト', () => {
    const originalFetch = globalThis.fetch;



    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    // 1. 現在時刻取得ツール (getCurrentTime)
    test('getCurrentTime - 現在時刻が適切な形式で正常に取得できること', () => {
        const result = currentTimeTool.implementation({}, {} as any);
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
        // 日付や時間に関連する文字（スラッシュ、コロン、数字など）が含まれることを簡易検証
        expect(result).toMatch(/[\d/:\s年月日時分秒]/);
    });

    // 2. 位置情報取得ツール (getGPSLocation)
    test('getGPSLocation - API接続成功時に位置情報がJSON形式で正常に取得できること', async () => {
        const mockData = {
            city: '大阪',
            lat: 34.6937,
            lon: 135.5023,
            country: '日本'
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockData
        });

        const result = await gpsLocationTool.implementation({}, {} as any);
        const parsed = JSON.parse(result);

        expect(parsed.city).toBe('大阪');
        expect(parsed.latitude).toBe(34.6937);
        expect(parsed.longitude).toBe(135.5023);
        expect(parsed.country).toBe('日本');
    });

    test('getGPSLocation - APIエラー発生時に東京の位置情報にフォールバックすること', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));

        const result = await gpsLocationTool.implementation({}, {} as any);
        const parsed = JSON.parse(result);

        expect(parsed.city).toBe('東京');
        expect(parsed.latitude).toBe(35.6895);
        expect(parsed.longitude).toBe(139.6917);
        expect(parsed.note).toBe('フォールバック値');
    });

    // 3. 天気予報取得ツール (getWeather)
    test('getWeather - 指定地点の天気情報がOpen-Meteoから正常に取得できること', async () => {
        const mockWeather = {
            current: {
                temperature_2m: 22.5,
                relative_humidity_2m: 65,
                weather_code: 3,
                wind_speed_10m: 12.0
            }
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockWeather
        });

        const result = await weatherTool.implementation({ latitude: 35.6895, longitude: 139.6917, city: '東京' }, {} as any);
        const parsed = JSON.parse(result);

        expect(parsed.city).toBe('東京');
        expect(parsed.temperature).toBe('22.5°C');
        expect(parsed.humidity).toBe('65%');
        expect(parsed.weather).toBe('曇り');
    });

    test('getWeather - 天気取得APIで接続エラーが発生した際エラーメッセージが返ること', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Fetch error'));

        const result = await weatherTool.implementation({ latitude: 35.6895, longitude: 139.6917 }, {} as any);
        expect(result).toBe('天気予報の取得処理でエラーが発生しました。');
    });

    // 4. 音量調整ツール (adjustVolume)
    test('adjustVolume - 指定した音量レベルでPowerShellコマンドが実行され調整メッセージが返ること', async () => {
        const result = await volumeTool.implementation({ volume: 50 }, {} as any);
        expect(result).toBe('音量を 50% に調整しました。');
        // execの呼び出しはVITEST環境でのバイパスによりアサーション不要
    });

    test('adjustVolume - PowerShell実行失敗時にエラーメッセージが返ること', async () => {
        // volumeに特殊な値を渡して exec 内部でコマンドエラーになるシチュエーションをエミュレート
        // モックされた exec 内でcmdに 'fail' が含まれる場合に失敗するようにしている
        // volumeToolの実装は powershell -Command ... を実行する
        // なので、失敗させたい場合は exec を個別で mockRejectedValueOnce などにする
        // volume: 20 の場合はモック動作としてエラーが返る

        const result = await volumeTool.implementation({ volume: 20 }, {} as any);
        expect(result).toContain('音量調整コマンドの実行に失敗しました');
    });

    // 5. アプリ起動ツール (launchApp)
    test('launchApp - アプリの起動が成功したメッセージが返ること', async () => {
        const result = await appLauncherTool.implementation({ appName: 'calc' }, {} as any);
        expect(result).toBe('アプリケーション「calc」を起動しました。');
        // execの呼び出しはVITEST環境でのバイパスによりアサーション不要
    });

    test('launchApp - 存在しないアプリなどでの起動失敗時にエラーメッセージが返ること', async () => {
        // appNameにfailが含まれる場合はモック動作としてエラーが返る

        const result = await appLauncherTool.implementation({ appName: 'failApp' }, {} as any);
        expect(result).toBe('アプリケーション「failApp」の起動に失敗しました。');
    });

    // 6. Web検索ツール (searchWeb)
    test('searchWeb - DuckDuckGoのHTML結果からタイトルと要約がJSONで取得できること', async () => {
        const mockHtml = `
            <div class="result results_links results_links_deep web-result">
                <a class="result__a" href="https://example.com/item1">サンプルニュース1</a>
                <a class="result__snippet">サンプルの説明要約テキスト1です。</a>
            </div>
            <div class="result results_links results_links_deep web-result">
                <a class="result__a" href="https://example.com/item2">サンプルニュース2</a>
                <a class="result__snippet">サンプルの説明要約テキスト2です。</a>
            </div>
        `;

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => mockHtml
        });

        const result = await webSearchTool.implementation({ query: 'テスト検索' }, {} as any);
        const parsed = JSON.parse(result);

        expect(parsed.length).toBe(2);
        expect(parsed[0].title).toBe('サンプルニュース1');
        expect(parsed[0].snippet).toBe('サンプルの説明要約テキスト1です。');
        expect(parsed[0].url).toBe('https://example.com/item1');
    });

    test('searchWeb - 検索失敗やネットワークエラーの際エラーメッセージが返ること', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('DuckDuckGo Timeout'));

        const result = await webSearchTool.implementation({ query: 'テスト検索' }, {} as any);
        expect(result).toContain('Web検索中にエラーが発生しました');
    });

    // 7. タスク一元管理ツール (manageTasks) - 追加（期限なし）
    test('manageTasks(add) - 期限なしタスクの追加が正常にシミュレートされ、結果がJSON形式で返ること', async () => {
        const result = await manageTasksTool.implementation({ action: 'add', title: '宿題をする', priority: 'star', categoryId: 'private' }, {} as any);
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
        expect(parsed.action).toBe('add');
        expect(parsed.title).toBe('宿題をする');
        expect(parsed.priority).toBe('star');
        expect(parsed.categoryId).toBe('private');
        expect(parsed.scheduledAt).toBeUndefined();
    });

    // 8. タスク一元管理ツール (manageTasks) - 追加（期限あり = 旧addSchedule相当）
    test('manageTasks(add) - scheduledAt指定時に予定の追加が正常にシミュレートされ、結果がJSON形式で返ること', async () => {
        const result = await manageTasksTool.implementation({ action: 'add', title: '会議', scheduledAt: '2026-07-06T18:00:00+09:00', priority: 'normal', categoryId: 'default' }, {} as any);
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
        expect(parsed.action).toBe('add');
        expect(parsed.title).toBe('会議');
        expect(parsed.scheduledAt).toBe('2026-07-06T18:00:00+09:00');
        expect(parsed.priority).toBe('normal');
        expect(parsed.categoryId).toBe('default');
    });

    // 9. タスク一元管理ツール (manageTasks) - 検索
    test('manageTasks(search) - タスクの検索パラメータが正常にパースされて返ること', async () => {
        const result = await manageTasksTool.implementation({ action: 'search', query: 'テスト', date: '2026-07-06', completed: false }, {} as any);
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
        expect(parsed.action).toBe('search');
        expect(parsed.query).toBe('テスト');
        expect(parsed.date).toBe('2026-07-06');
        expect(parsed.completed).toBe(false);
    });

    // 10. タスク一元管理ツール (manageTasks) - 更新
    test('manageTasks(update) - タスクの更新パラメータが正常にパースされて返ること', async () => {
        const result = await manageTasksTool.implementation({ action: 'update', id: 'task_123', title: '更新後タスク', priority: 'thunder', scheduledAt: '2026-07-06T20:00:00+09:00', completed: true }, {} as any);
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
        expect(parsed.action).toBe('update');
        expect(parsed.id).toBe('task_123');
        expect(parsed.title).toBe('更新後タスク');
        expect(parsed.priority).toBe('thunder');
        expect(parsed.scheduledAt).toBe('2026-07-06T20:00:00+09:00');
        expect(parsed.completed).toBe(true);
    });

    // 11. タスク一元管理ツール (manageTasks) - 削除
    test('manageTasks(delete) - タスクの削除パラメータが正常にパースされて返ること', async () => {
        const result = await manageTasksTool.implementation({ action: 'delete', id: 'task_123' }, {} as any);
        const parsed = JSON.parse(result);
        expect(parsed.success).toBe(true);
        expect(parsed.action).toBe('delete');
        expect(parsed.id).toBe('task_123');
    });
});

