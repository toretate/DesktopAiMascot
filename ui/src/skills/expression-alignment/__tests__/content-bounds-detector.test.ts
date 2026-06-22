import { describe, test, expect } from 'vitest';
import { colorDistance, detectBackgroundColor } from '../content-bounds-detector';

describe('ContentBoundsDetector', () => {
    describe('colorDistance', () => {
        test('colorDistance_同一色の距離は0になる', () => {
            expect(colorDistance(255, 255, 255, 255, 255, 255)).toBe(0);
            expect(colorDistance(0, 0, 0, 0, 0, 0)).toBe(0);
            expect(colorDistance(128, 64, 32, 128, 64, 32)).toBe(0);
        });

        test('colorDistance_白と黒の距離は最大値になる', () => {
            const dist = colorDistance(0, 0, 0, 255, 255, 255);
            expect(dist).toBeCloseTo(Math.sqrt(255 ** 2 * 3), 5);
        });

        test('colorDistance_赤のみ異なる場合は正しく計算される', () => {
            const dist = colorDistance(100, 0, 0, 200, 0, 0);
            expect(dist).toBe(100);
        });

        test('colorDistance_対称性が保たれる', () => {
            const dist1 = colorDistance(100, 50, 200, 150, 80, 170);
            const dist2 = colorDistance(150, 80, 170, 100, 50, 200);
            expect(dist1).toBeCloseTo(dist2, 10);
        });
    });

    describe('detectBackgroundColor', () => {
        /**
         * テスト用のヘルパー: 指定色で塗りつぶされた ImageData 風のデータを作成する
         */
        function createSolidColorData(
            width: number,
            height: number,
            r: number,
            g: number,
            b: number,
            a: number = 255
        ): Uint8ClampedArray {
            const data = new Uint8ClampedArray(width * height * 4);
            for (let i = 0; i < data.length; i += 4) {
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = a;
            }
            return data;
        }

        test('detectBackgroundColor_白一色の画像から白を検出する', () => {
            const data = createSolidColorData(100, 100, 255, 255, 255);
            const bg = detectBackgroundColor(data, 100, 100);

            expect(bg).not.toBeNull();
            expect(bg![0]).toBe(255);
            expect(bg![1]).toBe(255);
            expect(bg![2]).toBe(255);
        });

        test('detectBackgroundColor_グレーの画像からグレーを検出する', () => {
            const data = createSolidColorData(100, 100, 128, 128, 128);
            const bg = detectBackgroundColor(data, 100, 100);

            expect(bg).not.toBeNull();
            expect(bg![0]).toBe(128);
            expect(bg![1]).toBe(128);
            expect(bg![2]).toBe(128);
        });

        test('detectBackgroundColor_完全に透明な画像からはnullを返す', () => {
            const data = createSolidColorData(100, 100, 0, 0, 0, 0);
            const bg = detectBackgroundColor(data, 100, 100);

            expect(bg).toBeNull();
        });

        test('detectBackgroundColor_画像が小さすぎる場合はnullを返す', () => {
            const data = createSolidColorData(5, 5, 255, 255, 255);
            const bg = detectBackgroundColor(data, 5, 5);

            // 5x5 はサンプルサイズの2倍（10）未満なので null
            expect(bg).toBeNull();
        });

        test('detectBackgroundColor_四隅の色がバラバラの場合はnullを返す', () => {
            const width = 100;
            const height = 100;
            const data = new Uint8ClampedArray(width * height * 4);

            // 各ピクセルに異なる色を設定
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    if (x < 50 && y < 50) {
                        // 左上: 赤
                        data[idx] = 255; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 255;
                    } else if (x >= 50 && y < 50) {
                        // 右上: 緑
                        data[idx] = 0; data[idx + 1] = 255; data[idx + 2] = 0; data[idx + 3] = 255;
                    } else if (x < 50 && y >= 50) {
                        // 左下: 青
                        data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 255; data[idx + 3] = 255;
                    } else {
                        // 右下: 黄
                        data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 0; data[idx + 3] = 255;
                    }
                }
            }

            const bg = detectBackgroundColor(data, width, height);
            expect(bg).toBeNull();
        });
    });
});
