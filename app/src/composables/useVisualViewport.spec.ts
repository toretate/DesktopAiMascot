// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { calculateVisualViewportMetrics } from './useVisualViewport';

describe('calculateVisualViewportMetrics', () => {
    it('calculateVisualViewportMetricsでVisualViewportがない場合はウィンドウ高を使用すること', () => {
        expect(calculateVisualViewportMetrics(800, null)).toEqual({
            height: 800,
            offsetTop: 0,
            keyboardInset: 0,
        });
    });

    it('calculateVisualViewportMetricsでキーボード表示分の下端余白を算出すること', () => {
        expect(calculateVisualViewportMetrics(800, { height: 480, offsetTop: 20 })).toEqual({
            height: 480,
            offsetTop: 20,
            keyboardInset: 300,
        });
    });

    it('calculateVisualViewportMetricsで拡大時の負数をゼロへ丸めること', () => {
        expect(calculateVisualViewportMetrics(600, { height: 620, offsetTop: 10 }).keyboardInset).toBe(0);
    });
});
