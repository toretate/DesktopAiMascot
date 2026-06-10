/**
 * OpenCV.js による画像レジストレーション（RegistrationProvider 実装・step4）。
 *
 * スプライトとベース画像の対応点を ORB 特徴で抽出し、estimateAffine2D の RANSAC で
 * ロバストにインライアだけを残して返す。相似変換（scale/rotation/translation）の
 * 当てはめは solveTransform 側（src/similarity.ts）が担う＝責務分離。
 *
 * cv（OpenCV 名前空間）は環境ごとに注入する（D14）:
 *   - Node/テスト: adapters/opencv-node（opencv-wasm・同期ロード）
 *   - ブラウザ/WebView: adapters/opencv-browser（@techstark/opencv-js）
 *
 * ※ opencv-wasm(4.3.0) に estimateAffinePartial2D が無いため、両環境共通で
 *   estimateAffine2D（インライア検出のみ目的）を用いる。最終的な 4 自由度の相似変換は
 *   インライア対応点を similarity.ts に渡して解く。
 */

import type {
    BoundingBox,
    PointPair,
    RasterImage,
    RegistrationProvider,
    RegistrationResult,
} from './types';

/** 本 provider が使う OpenCV API の最小サブセット（opencv-wasm / @techstark 共通） */
export interface OpenCvLike {
    Mat: any;
    matFromImageData(img: { data: Uint8ClampedArray | Uint8Array; width: number; height: number }): any;
    matFromArray(rows: number, cols: number, type: number, array: number[]): any;
    cvtColor(src: any, dst: any, code: number): void;
    ORB: any;
    BFMatcher: any;
    KeyPointVector: any;
    DMatchVectorVector: any;
    estimateAffine2D(
        from: any,
        to: any,
        inliers: any,
        method: number,
        ransacReprojThreshold: number,
        maxIters: number,
        confidence: number,
        refineIters: number
    ): any;
    COLOR_RGBA2GRAY: number;
    NORM_HAMMING: number;
    RANSAC: number;
    CV_32FC2: number;
    // 顔領域マスク用（任意・あれば使用）
    Rect?: any;
    Scalar?: any;
    CV_8UC1?: number;
}

export interface OpenCvRegistrationOptions {
    /** ORB 検出最大特徴点数 */
    maxFeatures?: number;
    /** Lowe 比率テストのしきい値 */
    ratio?: number;
    /** RANSAC 再投影しきい値 (px) */
    ransacThreshold?: number;
    /** 有効とみなす最小マッチ数 */
    minMatches?: number;
}

const DEFAULTS: Required<OpenCvRegistrationOptions> = {
    maxFeatures: 1500,
    ratio: 0.75,
    ransacThreshold: 3,
    minMatches: 8,
};

/** RGBA RasterImage → グレースケール cv.Mat（呼び出し側で delete すること） */
function toGray(cv: OpenCvLike, img: RasterImage): any {
    const rgba = cv.matFromImageData({ data: img.data, width: img.width, height: img.height });
    const gray = new cv.Mat();
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    rgba.delete();
    return gray;
}

/** faceRegion から base 用の 8UC1 マスクを作る（cv が対応していれば）。非対応なら null */
function buildFaceMask(cv: OpenCvLike, img: RasterImage, region?: BoundingBox): any {
    if (!region || !cv.Rect || !cv.Scalar || cv.CV_8UC1 === undefined || typeof cv.Mat.zeros !== 'function') {
        return null;
    }
    const left = Math.max(0, Math.floor(region.left));
    const top = Math.max(0, Math.floor(region.top));
    const right = Math.min(img.width, Math.ceil(region.right));
    const bottom = Math.min(img.height, Math.ceil(region.bottom));
    const w = right - left;
    const h = bottom - top;
    if (w <= 0 || h <= 0) return null;
    const mask = cv.Mat.zeros(img.height, img.width, cv.CV_8UC1);
    const roi = mask.roi(new cv.Rect(left, top, w, h));
    roi.setTo(new cv.Scalar(255));
    roi.delete();
    return mask;
}

/**
 * OpenCV.js を用いた RegistrationProvider を生成する。
 * @param cv 初期化済み OpenCV 名前空間（環境別アダプタから注入）
 */
export function createOpenCvRegistration(
    cv: OpenCvLike,
    options: OpenCvRegistrationOptions = {}
): RegistrationProvider {
    const opt = { ...DEFAULTS, ...options };

    return {
        async register(
            baseImage: RasterImage,
            sprite: RasterImage,
            faceRegion?: BoundingBox
        ): Promise<RegistrationResult> {
            console.log('[OpenCvRegistration] register started');
            const grayBase = toGray(cv, baseImage);
            console.log('[OpenCvRegistration] Base image converted to gray');
            const graySprite = toGray(cv, sprite);
            console.log('[OpenCvRegistration] Sprite image converted to gray');
            
            const baseMask = buildFaceMask(cv, baseImage, faceRegion);
            console.log('[OpenCvRegistration] Face mask built (if region provided)');
            const emptyMask = new cv.Mat();

            console.log('[OpenCvRegistration] Instantiating ORB...');
            const orb = new cv.ORB(opt.maxFeatures);
            console.log('[OpenCvRegistration] ORB instantiated. Creating keypoint vectors and mats...');
            const kpBase = new cv.KeyPointVector();
            const kpSprite = new cv.KeyPointVector();
            const desBase = new cv.Mat();
            const desSprite = new cv.Mat();

            console.log('[OpenCvRegistration] Instantiating BFMatcher...');
            const bf = new cv.BFMatcher(cv.NORM_HAMMING, false);
            const knn = new cv.DMatchVectorVector();

            // 後でまとめて解放する一時 Mat
            const cleanup: any[] = [
                grayBase,
                graySprite,
                emptyMask,
                kpBase,
                kpSprite,
                desBase,
                desSprite,
                knn,
            ];
            if (baseMask) cleanup.push(baseMask);

            try {
                console.log('[OpenCvRegistration] Running detectAndCompute on base...');
                orb.detectAndCompute(grayBase, baseMask || emptyMask, kpBase, desBase);
                console.log('[OpenCvRegistration] Base features computed. Row count:', desBase.rows);
                
                console.log('[OpenCvRegistration] Running detectAndCompute on sprite...');
                orb.detectAndCompute(graySprite, emptyMask, kpSprite, desSprite);
                console.log('[OpenCvRegistration] Sprite features computed. Row count:', desSprite.rows);

                if (desSprite.rows === 0 || desBase.rows === 0) {
                    console.log('[OpenCvRegistration] No features detected on sprite or base.');
                    return { pairs: [], inlierRatio: 0 };
                }

                // query = sprite, train = base
                console.log('[OpenCvRegistration] Running knnMatch...');
                bf.knnMatch(desSprite, desBase, knn, 2);
                console.log('[OpenCvRegistration] knnMatch completed. Match size:', knn.size());

                // Lowe 比率テスト
                console.log('[OpenCvRegistration] Running Lowe ratio test...');
                const goodSrc: number[] = [];
                const goodDst: number[] = [];
                const goodPairs: PointPair[] = [];
                for (let i = 0; i < knn.size(); i++) {
                    const m = knn.get(i);
                    if (m.size() < 2) continue;
                    const a = m.get(0);
                    const b = m.get(1);
                    if (a.distance < opt.ratio * b.distance) {
                        const ps = kpSprite.get(a.queryIdx).pt;
                        const pb = kpBase.get(a.trainIdx).pt;
                        goodSrc.push(ps.x, ps.y);
                        goodDst.push(pb.x, pb.y);
                        goodPairs.push({ src: { x: ps.x, y: ps.y }, dst: { x: pb.x, y: pb.y } });
                    }
                }

                const good = goodPairs.length;
                console.log('[OpenCvRegistration] Lowe ratio test completed. Good matches:', good);
                if (good < opt.minMatches) {
                    console.log('[OpenCvRegistration] Too few good matches for RANSAC. Skipping RANSAC.');
                    // RANSAC には不十分。得られた good マッチをそのまま返す（confidence は低くなる）
                    return { pairs: goodPairs, inlierRatio: good === 0 ? 0 : good / Math.max(1, knn.size()) };
                }

                // estimateAffine2D の RANSAC でインライアを判定（変換自体は使わない）
                console.log('[OpenCvRegistration] Setting up mats for estimateAffine2D...');
                const from = cv.matFromArray(good, 1, cv.CV_32FC2, goodSrc);
                const to = cv.matFromArray(good, 1, cv.CV_32FC2, goodDst);
                const inliers = new cv.Mat();
                cleanup.push(from, to, inliers);

                console.log('[OpenCvRegistration] Running estimateAffine2D (RANSAC)...');
                const affine = cv.estimateAffine2D(from, to, inliers, cv.RANSAC, opt.ransacThreshold, 2000, 0.99, 10);
                console.log('[OpenCvRegistration] estimateAffine2D completed.');
                if (affine && typeof affine.delete === 'function') cleanup.push(affine);

                const inlierPairs: PointPair[] = [];
                const maskData: Uint8Array = inliers.data;
                for (let i = 0; i < good; i++) {
                    if (maskData && maskData[i]) inlierPairs.push(goodPairs[i]);
                }
                console.log('[OpenCvRegistration] Inliers count:', inlierPairs.length);

                // インライアが取れなければ good をフォールバック
                const pairs = inlierPairs.length >= 2 ? inlierPairs : goodPairs;
                const inlierRatio = good > 0 ? inlierPairs.length / good : 0;

                console.log('[OpenCvRegistration] Register completed successfully. Inlier Ratio:', inlierRatio);
                return { pairs, inlierRatio };
            } finally {
                console.log('[OpenCvRegistration] Cleaning up OpenCv objects...');
                orb.delete();
                bf.delete();
                for (const m of cleanup) {
                    try {
                        if (m && typeof m.delete === 'function') m.delete();
                    } catch {
                        /* noop */
                    }
                }
                console.log('[OpenCvRegistration] Cleanup completed.');
            }
        },
    };
}
