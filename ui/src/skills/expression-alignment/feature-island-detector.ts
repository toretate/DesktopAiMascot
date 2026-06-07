import { loadImage } from './content-bounds-detector';

export interface BoundingBox {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

export interface FeatureIsland {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    area: number;
    box: BoundingBox;
}

export interface DetectedFaceFeatures {
    leftEye: FeatureIsland | null;
    rightEye: FeatureIsland | null;
    mouth: FeatureIsland | null;
    allIslands: FeatureIsland[];
}

/**
 * 透過処理された表情スプライト画像から、目・口などの「特徴の島（連結不透明領域）」を検出する
 *
 * @param imageSource 背景除去済みの Base64 Data URL または画像パス
 * @param alphaThreshold 透明判定の閾値（デフォルト: 10）
 */
export async function detectFaceFeatures(
    imageSource: string,
    alphaThreshold: number = 10
): Promise<DetectedFaceFeatures> {
    const img = await loadImage(imageSource);
    const { width, height } = img;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('[FeatureIslandDetector] Canvas 2D コンテキストの取得に失敗しました');
    }

    ctx.drawImage(img, 0, 0);
    let imgData: ImageData;
    try {
        imgData = ctx.getImageData(0, 0, width, height);
    } catch (e) {
        throw new Error('[FeatureIslandDetector] getImageData に失敗しました');
    }

    const data = imgData.data;

    // 1. 有効な（非透明かつ顔の白肌・背景ではない）ピクセルのマーク
    const visited = new Uint8Array(width * height);
    const isValid = (x: number, y: number): boolean => {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        
        // 透過ピクセルを除外
        if (a < alphaThreshold) return false;

        // 輝度 (Luminance) を計算して、明るい肌色・背景を除外する
        // 0.299*R + 0.587*G + 0.114*B で輝度を求め、160より大きい（明るい）ピクセルを除外
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luminance > 110) {
            return false;
        }

        return true;
    };

    const islands: FeatureIsland[] = [];

    // 2. 連結成分の探索 (BFS)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (visited[idx] === 0 && isValid(x, y)) {
                // 新しい島が見つかった
                let sumX = 0;
                let sumY = 0;
                let area = 0;
                let minX = x;
                let maxX = x;
                let minY = y;
                let maxY = y;

                const queue: number[] = [idx];
                visited[idx] = 1;

                let head = 0;
                while (head < queue.length) {
                    const currIdx = queue[head++];
                    const cx = currIdx % width;
                    const cy = Math.floor(currIdx / width);

                    sumX += cx;
                    sumY += cy;
                    area++;

                    if (cx < minX) minX = cx;
                    if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;

                    // 4方向連結
                    const neighbors = [
                        { x: cx - 1, y: cy },
                        { x: cx + 1, y: cy },
                        { x: cx, y: cy - 1 },
                        { x: cx, y: cy + 1 }
                    ];

                    for (const n of neighbors) {
                        if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                            const nIdx = n.y * width + n.x;
                            if (visited[nIdx] === 0 && isValid(n.x, n.y)) {
                                visited[nIdx] = 1;
                                queue.push(nIdx);
                            }
                        }
                    }
                }

                // ノイズフィルタリング（面積が5ピクセル以上）
                if (area >= 5) {
                    islands.push({
                        centerX: sumX / area,
                        centerY: sumY / area,
                        width: maxX - minX + 1,
                        height: maxY - minY + 1,
                        area,
                        box: { top: minY, bottom: maxY, left: minX, right: maxX }
                    });
                }
            }
        }
    }

    console.log(`[FeatureIslandDetector] Found ${islands.length} raw islands for this expression:`);
    islands.forEach((isl, i) => {
        console.log(`  Raw Island #${i}: cx=${isl.centerX.toFixed(1)}, cy=${isl.centerY.toFixed(1)}, area=${isl.area}, size=${isl.width}x${isl.height}`);
    });

    // 3. パーツの同定 (左目、右目、口)
    let leftEye: FeatureIsland | null = null;
    let rightEye: FeatureIsland | null = null;
    let mouth: FeatureIsland | null = null;

    if (islands.length > 0) {
        // 目のペア選定ロジック
        // 髪の毛などの巨大な島（連結ノイズ）を排除するため、
        // 目の島候補の面積は 15ピクセル〜1000ピクセルの範囲に制限する
        const eyeCandidates = islands.filter(isl => 
            isl.area >= 15 && 
            isl.area <= 1200 &&
            isl.centerY > height * 0.15 && 
            isl.centerY < height * 0.75
        );

        let bestPair: { left: FeatureIsland, right: FeatureIsland, score: number } | null = null;

        for (let i = 0; i < eyeCandidates.length; i++) {
            for (let j = 0; j < eyeCandidates.length; j++) {
                if (i === j) continue;
                const left = eyeCandidates[i];
                const right = eyeCandidates[j];

                // 左右の関係チェック
                if (left.centerX >= right.centerX) continue;

                // X方向の間隔チェック
                const dist = right.centerX - left.centerX;
                if (dist < width * 0.25 || dist > width * 0.75) continue;

                // Y方向の高さの差チェック（左右の目がほぼ同じ水平高さにあるか）
                const yDiff = Math.abs(left.centerY - right.centerY);
                if (yDiff > height * 0.15) continue;

                // 面積比率（左右の目の大きさが釣り合っているか）
                const areaRatio = Math.min(left.area, right.area) / Math.max(left.area, right.area);
                if (areaRatio < 0.15) continue;

                // スコア計算: 面積の大きさと左右水平度
                const score = (left.area + right.area) * (1.0 - yDiff / (height * 0.15));

                if (!bestPair || score > bestPair.score) {
                    bestPair = { left, right, score };
                }
            }
        }

        if (bestPair) {
            leftEye = bestPair.left;
            rightEye = bestPair.right;
        }

        // 口の同定: 目のペア決定後、それより下にある島から選択
        if (leftEye && rightEye) {
            const eyeCenterY = (leftEye.centerY + rightEye.centerY) / 2;
            const eyeCenterX = (leftEye.centerX + rightEye.centerX) / 2;
            
            const mouthCandidates = islands.filter(isl => 
                isl !== leftEye && 
                isl !== rightEye && 
                isl.centerY > eyeCenterY
            );

            if (mouthCandidates.length > 0) {
                // X座標が目の中心に最も近い主要な島を選択
                mouthCandidates.sort((a, b) => {
                    const distA = Math.abs(a.centerX - eyeCenterX);
                    const distB = Math.abs(b.centerX - eyeCenterX);
                    return distA - distB;
                });
                mouth = mouthCandidates[0];
            }
        } else {
            // 目が検出できなかった場合のフォールバック: 画像下部にある最大面積の島
            const sortedIslands = [...islands].sort((a, b) => b.area - a.area);
            const mouthCandidates = sortedIslands.filter(isl => isl.centerY > height * 0.55);
            if (mouthCandidates.length > 0) {
                mouth = mouthCandidates[0];
            }
        }
    }

    return {
        leftEye,
        rightEye,
        mouth,
        allIslands: islands
    };
}
