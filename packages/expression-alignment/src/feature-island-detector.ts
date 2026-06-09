/**
 * step5: 特徴島検出（目中心クロスチェック専用）。
 *
 * 既存 ui/src/skills/expression-alignment/feature-island-detector.ts から移植し、
 * 以下の改良を加えた：
 *   - DOM 非依存: RasterImage を直接入力（document.createElement 不使用）
 *   - 口検出を廃止し目中心のみに縮退（クロスチェック専用化）
 *   - 輝度しきい値コメントの誤記を解消: 「160」→ 実値 110 を正式採用
 *   - 面積上限コメントの誤記を解消: 「1000」→ 実値 1200 を正式採用
 *   - ラベル領域を自動検出して除外（下端の 70%+ near-white 行）
 */

import type { RasterImage, Point, BoundingBox } from './types';

/**
 * 暗い連結ピクセル群（目・眉・まつげ等の「特徴の島」）。
 */
export interface FeatureIsland {
    centerX: number;
    centerY: number;
    area: number;
    box: BoundingBox;
}

/**
 * 検出した目中心座標ペア。
 * left/right は画像座標系（left.x < right.x）。
 */
export interface EyeCenters {
    /** 画像左 = キャラクター視点では右目 */
    left: Point;
    /** 画像右 = キャラクター視点では左目 */
    right: Point;
    /** 眼間中点 */
    midpoint: Point;
    /** 眼間距離（pixel） */
    interocularDist: number;
    /** 検出信頼度 0..1 */
    confidence: number;
}

/**
 * expr_*.png スプライトから目中心座標ペアを検出する（クロスチェック専用）。
 *
 * 輝度しきい値: 110（旧コメントの「160」は誤記 → 実値 110 を正式採用）
 * 面積フィルタ上限: 1200（旧コメントの「1000」は誤記 → 実値 1200 を正式採用）
 *
 * @returns 目ペアが見つかれば EyeCenters、見つからなければ null
 */
export function detectEyeCenters(sprite: RasterImage): EyeCenters | null {
    const { width: W, height: H, data } = sprite;

    // 1. ラベル開始行を検出（下端から 70%+ near-white が続く行）
    let labelStartY = H;
    for (let y = H - 1; y >= 0; y--) {
        let nWhite = 0;
        for (let x = 0; x < W; x++) {
            const i4 = (y * W + x) * 4;
            if (data[i4] > 235 && data[i4 + 1] > 235 && data[i4 + 2] > 235) nWhite++;
        }
        if (nWhite / W >= 0.7) {
            labelStartY = y;
        } else {
            break;
        }
    }

    const BORDER = 2;

    // ピクセルが「暗い特徴ピクセル（目・眉・まつげ等）」かどうかを判定する
    // 輝度しきい値 110 を使用（旧コメント「160」は過去の誤記）
    const isDarkFeature = (x: number, y: number): boolean => {
        if (x < BORDER || x >= W - BORDER || y < BORDER || y >= labelStartY - BORDER) return false;
        const i4 = (y * W + x) * 4;
        const r = data[i4];
        const g = data[i4 + 1];
        const b = data[i4 + 2];
        // 外枠 near-black ボーダー（BORDER px 内の黒線）は除外
        if (r < 30 && g < 30 && b < 30) return false;
        // 輝度 ≤ 110 のみを特徴ピクセルとして扱う
        return 0.299 * r + 0.587 * g + 0.114 * b <= 110;
    };

    // 2. BFS による連結成分（特徴の島）探索
    const visited = new Uint8Array(W * H);
    const islands: FeatureIsland[] = [];

    for (let y = BORDER; y < labelStartY - BORDER; y++) {
        for (let x = BORDER; x < W - BORDER; x++) {
            const baseIdx = y * W + x;
            if (visited[baseIdx] || !isDarkFeature(x, y)) continue;

            let sumX = 0;
            let sumY = 0;
            let area = 0;
            let minX = x;
            let maxX = x;
            let minY = y;
            let maxY = y;

            const queue: number[] = [baseIdx];
            visited[baseIdx] = 1;
            let head = 0;

            while (head < queue.length) {
                const ci = queue[head++];
                const cx = ci % W;
                const cy = (ci / W) | 0;

                sumX += cx;
                sumY += cy;
                area++;
                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                if (cy > maxY) maxY = cy;

                // 4 方向連結
                const nx0 = cx - 1; if (nx0 >= 0) { const ni = cy * W + nx0; if (!visited[ni] && isDarkFeature(nx0, cy)) { visited[ni] = 1; queue.push(ni); } }
                const nx1 = cx + 1; if (nx1 < W)  { const ni = cy * W + nx1; if (!visited[ni] && isDarkFeature(nx1, cy)) { visited[ni] = 1; queue.push(ni); } }
                const ny0 = cy - 1; if (ny0 >= 0) { const ni = ny0 * W + cx; if (!visited[ni] && isDarkFeature(cx, ny0)) { visited[ni] = 1; queue.push(ni); } }
                const ny1 = cy + 1; if (ny1 < H)  { const ni = ny1 * W + cx; if (!visited[ni] && isDarkFeature(cx, ny1)) { visited[ni] = 1; queue.push(ni); } }
            }

            if (area >= 5) {
                islands.push({
                    centerX: sumX / area,
                    centerY: sumY / area,
                    area,
                    box: { top: minY, bottom: maxY, left: minX, right: maxX },
                });
            }
        }
    }

    // 3. 目候補フィルタリング
    // - 面積 15〜1200（旧コメント「1000」は誤記 → 実値 1200 を採用）
    // - Y 座標がコンテンツ領域の 15%〜75% の範囲
    const eyeCandidates = islands.filter(
        (isl) =>
            isl.area >= 15 &&
            isl.area <= 1200 &&
            isl.centerY > labelStartY * 0.15 &&
            isl.centerY < labelStartY * 0.75
    );

    // 4. 最良ペア探索（スコア最大化）
    let bestLeft: FeatureIsland | null = null;
    let bestRight: FeatureIsland | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < eyeCandidates.length; i++) {
        for (let j = i + 1; j < eyeCandidates.length; j++) {
            const a = eyeCandidates[i];
            const b = eyeCandidates[j];
            const left = a.centerX <= b.centerX ? a : b;
            const right = a.centerX <= b.centerX ? b : a;

            // X 間隔: スプライト幅の 25〜75%
            const horizDist = right.centerX - left.centerX;
            if (horizDist < W * 0.25 || horizDist > W * 0.75) continue;

            // Y のズレ: コンテンツ高の 15% 以内
            const vertDiff = Math.abs(left.centerY - right.centerY);
            if (vertDiff > labelStartY * 0.15) continue;

            // 面積比: 小さい方が大きい方の 15% 以上
            const areaRatio = Math.min(left.area, right.area) / Math.max(left.area, right.area);
            if (areaRatio < 0.15) continue;

            const score = (left.area + right.area) * (1.0 - vertDiff / (labelStartY * 0.15 + 1));
            if (score > bestScore) {
                bestScore = score;
                bestLeft = left;
                bestRight = right;
            }
        }
    }

    if (!bestLeft || !bestRight) return null;

    const midX = (bestLeft.centerX + bestRight.centerX) / 2;
    const midY = (bestLeft.centerY + bestRight.centerY) / 2;
    const interocularDist = bestRight.centerX - bestLeft.centerX;
    const vertDiff = Math.abs(bestLeft.centerY - bestRight.centerY);
    const areaRatio =
        Math.min(bestLeft.area, bestRight.area) / Math.max(bestLeft.area, bestRight.area);

    // 信頼度: 眼間距離の適切さ × 0.4 + 水平度 × 0.3 + 面積バランス × 0.3
    const distScore = Math.max(
        0,
        1.0 - Math.abs(interocularDist - W * 0.4) / (W * 0.4)
    );
    const yScore = Math.max(0, 1.0 - vertDiff / (labelStartY * 0.10 + 1));
    const confidence = Math.min(1, distScore * 0.4 + yScore * 0.3 + areaRatio * 0.3);

    return {
        left: { x: bestLeft.centerX, y: bestLeft.centerY },
        right: { x: bestRight.centerX, y: bestRight.centerY },
        midpoint: { x: midX, y: midY },
        interocularDist,
        confidence,
    };
}

/**
 * registration が推定した眼間中点と feature-island 検出した眼間中点を照合し、
 * 信頼度係数（0〜1）を返す。
 *
 * drift = 0          → 1.0（完全一致）
 * drift ≥ tolerancePx → 0.0（許容範囲外）
 * 線形補間。
 *
 * @param eyeCenters detectEyeCenters の結果
 * @param expectedMidpoint registration 変換で予測した眼間中点（pixel 座標）
 * @param tolerancePx 許容誤差（px）。スプライト幅の 15〜20% 程度を推奨
 */
export function crossCheckEyeMidpoint(
    eyeCenters: EyeCenters,
    expectedMidpoint: Point,
    tolerancePx: number
): number {
    const dx = eyeCenters.midpoint.x - expectedMidpoint.x;
    const dy = eyeCenters.midpoint.y - expectedMidpoint.y;
    const drift = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1.0 - drift / tolerancePx);
}
