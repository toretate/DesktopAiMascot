/**
 * 表情スプライトの自動位置合わせメインオーケストレーター
 * 各モジュール（顔検出、有効領域検出、パラメータ算出、背景マスキング）を統合して
 * ワンコールで自動位置合わせ処理を実行するファサード
 */

import { detectContentBounds, type ContentBounds } from './content-bounds-detector';
import { detectFaceRegion, detectFaceRegionWithAI, type FaceDetectionResult } from './face-region-detector';
import { calculateAlignment, type AlignmentParams } from './alignment-calculator';
import { loadImage } from './content-bounds-detector';
import { detectFaceFeatures } from './feature-island-detector';

/** 自動位置合わせのオプション */
export interface AutoAlignOptions {
    /** AI検出を使用するか（デフォルト: false。Phase 2 用） */
    useAIDetection?: boolean;
    /** Gemini API キー（AI検出時に必要。Phase 2 用） */
    apiKey?: string;
    /** スケールの上書き値（手動スケールを引き継ぐ場合） */
    overrideScale?: number;
}


/** 自動位置合わせの結果 */
export interface AutoAlignResult {
    /** 算出された位置パラメータ */
    params: AlignmentParams;
    /** クロップ済み画像の Base64 */
    maskedImage?: string;
    /** 顔検出の信頼度 */
    confidence: number;
    /** 使用された検出手法 */
    method: 'heuristic' | 'ai';
}

/**
 * ベース画像が自動位置合わせに使用可能かを判定する
 * 絵文字のみ、空文字列、未設定の場合は使用不可
 */
function isValidImageSource(imageSource: string | undefined | null): boolean {
    if (!imageSource) return false;
    if (imageSource.startsWith('data:image/')) return true;
    if (imageSource.startsWith('/mascots/')) return true;
    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) return true;
    if (/\.(png|jpg|jpeg|webp|gif)$/i.test(imageSource)) return true;
    return false;
}

/**
 * 画像のネイティブサイズを取得する
 */
async function getImageSize(imageSource: string): Promise<{ width: number; height: number }> {
    const img = await loadImage(imageSource);
    return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
}

/**
 * 画像を指定されたバウンディングボックスでクロップ（トリミング）して新しい Base64 画像を返す
 */
async function cropImage(
    imageSource: string,
    box: { top: number; bottom: number; left: number; right: number }
): Promise<string> {
    const img = await loadImage(imageSource);
    const canvas = document.createElement('canvas');
    const cropWidth = box.right - box.left;
    const cropHeight = box.bottom - box.top;

    if (cropWidth <= 0 || cropHeight <= 0) {
        return imageSource;
    }

    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('[ExpressionAutoAligner] クロップ用 Canvas 2D コンテキストの取得に失敗しました');
    }

    // 指定された領域を切り抜いて描画
    ctx.drawImage(
        img,
        box.left,
        box.top,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
    );

    return canvas.toDataURL('image/png');
}


/**
 * 単一の表情画像を自動位置合わせする
 *
 * @param baseImage ベース画像（衣装/ポーズ全身像）のパスまたは Data URL
 * @param expressionImage 表情スプライト画像のパスまたは Data URL
 * @param options 自動位置合わせオプション
 * @returns 自動位置合わせ結果
 */
export async function alignSingle(
    baseImage: string,
    expressionImage: string,
    options?: AutoAlignOptions
): Promise<AutoAlignResult> {
    const opts: Required<AutoAlignOptions> = {
        useAIDetection: options?.useAIDetection ?? false,
        apiKey: options?.apiKey ?? '',
        overrideScale: options?.overrideScale ?? undefined as any
    };

    // ベース画像のバリデーション
    if (!isValidImageSource(baseImage)) {
        console.warn('[ExpressionAutoAligner] ベース画像が未設定または絵文字のみのため、自動位置合わせをスキップします。');
        return {
            params: { offsetX: 0, offsetY: 0, scale: 1.0 },
            confidence: 0,
            method: 'heuristic',
        };
    }

    // 表情画像のバリデーション
    if (!isValidImageSource(expressionImage)) {
        console.warn('[ExpressionAutoAligner] 表情画像が未設定のため、自動位置合わせをスキップします。');
        return {
            params: { offsetX: 0, offsetY: 0, scale: 1.0 },
            confidence: 0,
            method: 'heuristic',
        };
    }

    try {
        // Step 1: 顔領域検出（AI検出 or ヒューリスティック）
        let faceDetection: FaceDetectionResult;
        if (opts.useAIDetection && opts.apiKey) {
            console.log('[ExpressionAutoAligner] AI 顔検出モードで実行します');
            faceDetection = await detectFaceRegionWithAI(baseImage, opts.apiKey);
        } else {
            faceDetection = await detectFaceRegion(baseImage);
        }

        // Step 2: 表情画像の処理（有効領域検出）
        let processedExpression = expressionImage;
        let maskedImage: string | undefined = processedExpression;

        // Step 3: 表情画像の有効領域検出
        const contentBounds = await detectContentBounds(processedExpression);

        // Step 3.5: 有効領域でクロップ（不要な余白や表情ラベルを物理的にカット）
        let croppedExpression = processedExpression;
        let finalContentBounds = contentBounds;
        try {
            croppedExpression = await cropImage(processedExpression, contentBounds.box);
            maskedImage = croppedExpression; // クロップ済みの画像データを返却用とする

            // クロップ後の画像（余白が取り除かれた状態）の有効領域データを算出
            const cropWidth = contentBounds.box.right - contentBounds.box.left;
            const cropHeight = contentBounds.box.bottom - contentBounds.box.top;
            finalContentBounds = {
                box: { top: 0, bottom: cropHeight, left: 0, right: cropWidth },
                imageWidth: cropWidth,
                imageHeight: cropHeight,
                centerX: cropWidth / 2,
                centerY: cropHeight / 2,
                contentWidth: cropWidth,
                contentHeight: cropHeight,
                detectedBackgroundColor: contentBounds.detectedBackgroundColor
            };
        } catch (e) {
            console.warn('[ExpressionAutoAligner] 表情画像のクロップに失敗しました。元の有効領域情報で続行します。', e);
        }

        // Step 4: ベース画像のサイズ取得
        const baseImageSize = await getImageSize(baseImage);

        // Step 4.5: 表情画像から目や口の幾何学的重心を検出
        let faceFeatures = undefined;
        try {
            faceFeatures = await detectFaceFeatures(croppedExpression);
        } catch (e) {
            console.warn('[ExpressionAutoAligner] 表情特徴の重心検出に失敗しました。フォールバックロジックで続行します。', e);
        }

        // Step 5: パラメータ算出
        const params = calculateAlignment(
            faceDetection, 
            finalContentBounds, 
            baseImageSize, 
            undefined, 
            undefined, 
            faceFeatures,
            opts.overrideScale
        );

        return {
            params,
            maskedImage,
            confidence: faceDetection.confidence,
            method: faceDetection.method,
        };
    } catch (e) {
        console.error('[ExpressionAutoAligner] 自動位置合わせ処理中にエラーが発生しました:', e);
        return {
            params: { offsetX: 0, offsetY: 0, scale: 1.0 },
            confidence: 0,
            method: 'heuristic',
        };
    }
}

/**
 * 複数の表情画像を一括で自動位置合わせする
 * ベース画像の顔検出は1回だけ実行し、結果を全表情画像で共有する
 *
 * @param baseImage ベース画像（衣装/ポーズ全身像）のパスまたは Data URL
 * @param expressionImages 表情画像の配列 [{ id, image }]
 * @param options 自動位置合わせオプション
 * @returns 各表情IDに対応する自動位置合わせ結果の Map
 */
export async function alignBatch(
    baseImage: string,
    expressionImages: Array<{ id: string; image: string }>,
    options?: AutoAlignOptions
): Promise<Map<string, AutoAlignResult>> {
    const results = new Map<string, AutoAlignResult>();
    const opts: Required<AutoAlignOptions> = {
        useAIDetection: options?.useAIDetection ?? false,
        apiKey: options?.apiKey ?? '',
        overrideScale: options?.overrideScale ?? undefined as any
    };

    // ベース画像のバリデーション
    if (!isValidImageSource(baseImage)) {
        console.warn('[ExpressionAutoAligner] ベース画像が未設定のため、全表情の自動位置合わせをスキップします。');
        const defaultResult: AutoAlignResult = {
            params: { offsetX: 0, offsetY: 0, scale: 1.0 },
            confidence: 0,
            method: 'heuristic',
        };
        for (const expr of expressionImages) {
            results.set(expr.id, defaultResult);
        }
        return results;
    }

    try {
        // 顔検出を1回だけ実行（AI検出 or ヒューリスティック）
        let faceDetection: FaceDetectionResult;
        if (opts.useAIDetection && opts.apiKey) {
            console.log('[ExpressionAutoAligner] AI 顔検出モード（バッチ）で実行します');
            faceDetection = await detectFaceRegionWithAI(baseImage, opts.apiKey);
        } else {
            faceDetection = await detectFaceRegion(baseImage);
        }
        const baseImageSize = await getImageSize(baseImage);

        // 各表情画像を並列処理
        const promises = expressionImages.map(async (expr) => {
            if (!isValidImageSource(expr.image)) {
                return {
                    id: expr.id,
                    result: {
                        params: { offsetX: 0, offsetY: 0, scale: 1.0 },
                        confidence: 0,
                        method: 'heuristic' as const,
                    },
                };
            }

            try {
                let processedImage = expr.image;
                let maskedImage: string | undefined = processedImage;

                const contentBounds = await detectContentBounds(processedImage);

                let croppedImage = processedImage;
                let finalContentBounds = contentBounds;
                try {
                    croppedImage = await cropImage(processedImage, contentBounds.box);
                    maskedImage = croppedImage;

                    const cropWidth = contentBounds.box.right - contentBounds.box.left;
                    const cropHeight = contentBounds.box.bottom - contentBounds.box.top;
                    finalContentBounds = {
                        box: { top: 0, bottom: cropHeight, left: 0, right: cropWidth },
                        imageWidth: cropWidth,
                        imageHeight: cropHeight,
                        centerX: cropWidth / 2,
                        centerY: cropHeight / 2,
                        contentWidth: cropWidth,
                        contentHeight: cropHeight,
                        detectedBackgroundColor: contentBounds.detectedBackgroundColor
                    };
                } catch (e) {
                    console.warn(`[ExpressionAutoAligner] ID=${expr.id} のクロップに失敗しました。元の有効領域情報で続行します。`, e);
                }

                let faceFeatures = undefined;
                try {
                    faceFeatures = await detectFaceFeatures(croppedImage);
                } catch (e) {
                    console.warn(`[ExpressionAutoAligner] ID=${expr.id} の表情特徴重心検出に失敗しました。`, e);
                }

                const params = calculateAlignment(
                    faceDetection, 
                    finalContentBounds, 
                    baseImageSize, 
                    undefined, 
                    undefined, 
                    faceFeatures
                );

                return {
                    id: expr.id,
                    result: {
                        params,
                        maskedImage,
                        confidence: faceDetection.confidence,
                        method: faceDetection.method,
                    } as AutoAlignResult,
                };
            } catch (e) {
                console.warn(`[ExpressionAutoAligner] ID=${expr.id} の処理中にエラー:`, e);
                return {
                    id: expr.id,
                    result: {
                        params: { offsetX: 0, offsetY: 0, scale: 1.0 },
                        confidence: 0,
                        method: 'heuristic' as const,
                    },
                };
            }
        });

        const batchResults = await Promise.all(promises);
        for (const { id, result } of batchResults) {
            results.set(id, result);
        }
    } catch (e) {
        console.error('[ExpressionAutoAligner] バッチ処理中にエラーが発生しました:', e);
        const defaultResult: AutoAlignResult = {
            params: { offsetX: 0, offsetY: 0, scale: 1.0 },
            confidence: 0,
            method: 'heuristic',
        };
        for (const expr of expressionImages) {
            results.set(expr.id, defaultResult);
        }
    }

    return results;
}

/**
 * 画像の有効領域を検出し、自動的にクロップした画像を返す
 */
export async function autoCropImage(expressionImage: string): Promise<string> {
    if (!isValidImageSource(expressionImage)) return expressionImage;
    const contentBounds = await detectContentBounds(expressionImage);
    return await cropImage(expressionImage, contentBounds.box);
}

/**
 * 画像から顔領域を自動的に判定してクロップした画像を返す
 */
export async function autoCropFaceRegion(expressionImage: string): Promise<string> {
    if (!isValidImageSource(expressionImage)) return expressionImage;

    try {
        // 目・口などの特徴島を検出
        const features = await detectFaceFeatures(expressionImage);
        
        const img = await loadImage(expressionImage);
        const imgWidth = img.naturalWidth || img.width;
        const imgHeight = img.naturalHeight || img.height;

        // 左右の目のペアが検出できた場合、そこから目の距離を基準に黄金比で顔領域を算出する
        // 口の検出状態に依存しないため、表情によって枠の高さが潰れたりズレたりするのを完全に防ぎます
        if (features.leftEye && features.rightEye) {
            const leftEyeX = features.leftEye.centerX;
            const rightEyeX = features.rightEye.centerX;
            const eyeY = (features.leftEye.centerY + features.rightEye.centerY) / 2;
            
            // 左右の目の距離
            const eyeDist = rightEyeX - leftEyeX;

            // 目の距離を基準とした眉・目・口に絞った最適な矩形の算出比率
            const left = leftEyeX - eyeDist * 0.65;
            const right = rightEyeX + eyeDist * 0.65;
            const top = eyeY - eyeDist * 0.55;      // 目の上方向（眉毛をしっかりカバーする範囲）
            const bottom = eyeY + eyeDist * 0.85;   // 目の下方向（鼻、口、顎をカバーする範囲）

            const box = {
                left: Math.max(0, Math.round(left)),
                right: Math.min(imgWidth, Math.round(right)),
                top: Math.max(0, Math.round(top)),
                bottom: Math.min(imgHeight, Math.round(bottom))
            };

            console.log('[ExpressionAutoAligner] 目の間隔基準による高精度顔領域クロップ:', box);
            return await cropImage(expressionImage, box);
        }
    } catch (e) {
        console.warn('[ExpressionAutoAligner] 特徴に基づく顔検出に失敗しました。フォールバックします。', e);
    }

    // フォールバック: 不透明領域の上部を切り取る（バストアップや立ち絵を想定。比率を眉・目・口周辺に狭める）
    try {
        const contentBounds = await detectContentBounds(expressionImage);
        const contentWidth = contentBounds.box.right - contentBounds.box.left;
        const contentHeight = contentBounds.box.bottom - contentBounds.box.top;

        // 全身やバストアップから、より眉・目・口の顔パーツにフォーカスした比率で切り取る
        const box = {
            left: Math.max(0, Math.round(contentBounds.box.left + contentWidth * 0.2)),
            right: Math.min(contentBounds.imageWidth, Math.round(contentBounds.box.right - contentWidth * 0.2)),
            top: Math.max(0, Math.round(contentBounds.box.top + contentHeight * 0.15)),
            bottom: Math.min(contentBounds.imageHeight, Math.round(contentBounds.box.top + contentHeight * 0.48))
        };
        console.log('[ExpressionAutoAligner] フォールバックによる顔領域クロップ(狭め):', box);
        return await cropImage(expressionImage, box);
    } catch (e) {
        console.error('[ExpressionAutoAligner] 顔の自動切り抜きに失敗しました:', e);
        // どうしても失敗した場合は元の余白除去クロップを返す
        const contentBounds = await detectContentBounds(expressionImage);
        return await cropImage(expressionImage, contentBounds.box);
    }
}

// 公開エクスポート
export { isValidImageSource };

