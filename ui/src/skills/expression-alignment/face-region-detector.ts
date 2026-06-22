/**
 * ベース画像（衣装全身像）の顔領域を検出するモジュール
 * ヒューリスティックベースのアプローチおよび Gemini Vision API による
 * AI ベースのアプローチの 2 方式で顔領域の位置・サイズを推定する
 */

import { BoundingBox, detectContentBounds, loadImage, colorDistance, detectBackgroundColor } from './content-bounds-detector';

/** 顔領域検出結果 */
export interface FaceDetectionResult {
    /** 検出された顔のバウンディングボックス (px) */
    faceBox: BoundingBox;
    /** 信頼度 (0.0 - 1.0) */
    confidence: number;
    /** 使用された検出手法 */
    method: 'heuristic' | 'ai';
    /** ベース画像の非透明領域全体のバウンディングボックス */
    characterBox: BoundingBox;
}

/**
 * ヒューリスティック定数
 * キャラクターイラストの一般的な比率に基づく推定パラメータ
 */
export const FACE_HEURISTIC = {
    /** 非透明領域の上端からの顔開始位置（比率） */
    FACE_TOP_RATIO: 0.09,
    /** 非透明領域の上端からの顔終了位置（比率） */
    FACE_BOTTOM_RATIO: 0.35,
    /** 非透明領域の幅に対する顔幅の比率 */
    FACE_WIDTH_RATIO: 0.50,
} as const;

/** ローカル顔検出 API エンドポイント（サーバーサイドで MediaPipe/OpenCV を使用） */
const LOCAL_FACE_MASK_API = '/api/detect-face-mask';

/**
 * キャラクター全体の非透明領域バウンディングボックスを Canvas から検出する
 * detectFaceRegion と detectFaceRegionWithAI で共通利用する
 *
 * @param imageSource 画像パスまたは Data URL
 * @returns { characterBox, width, height }
 */
async function extractCharacterBox(imageSource: string): Promise<{
    characterBox: BoundingBox;
    width: number;
    height: number;
}> {
    const img = await loadImage(imageSource);
    const { width, height } = img;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('[FaceRegionDetector] Canvas 2D コンテキストの取得に失敗しました');
    }

    ctx.drawImage(img, 0, 0);

    let imgData: ImageData;
    try {
        imgData = ctx.getImageData(0, 0, width, height);
    } catch (e) {
        throw new Error('[FaceRegionDetector] getImageData に失敗しました');
    }

    const data = imgData.data;
    const alphaThreshold = 10;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    const bgColor = detectBackgroundColor(data, width, height);

    const isValidPixel = (x: number, y: number): boolean => {
        const idx = (y * width + x) * 4;
        const a = data[idx + 3];
        if (a < alphaThreshold) return false;
        if (bgColor) {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const dist = colorDistance(r, g, b, bgColor[0], bgColor[1], bgColor[2]);
            if (dist < 10) return false;
        }
        return true;
    };

    let found = false;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (isValidPixel(x, y)) {
                minY = y;
                found = true;
                break;
            }
        }
        if (found) break;
    }

    if (found) {
        found = false;
        for (let y = height - 1; y >= 0; y--) {
            for (let x = 0; x < width; x++) {
                if (isValidPixel(x, y)) {
                    maxY = y;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        found = false;
        for (let x = 0; x < width; x++) {
            for (let y = minY; y <= maxY; y++) {
                if (isValidPixel(x, y)) {
                    minX = x;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        found = false;
        for (let x = width - 1; x >= 0; x--) {
            for (let y = minY; y <= maxY; y++) {
                if (isValidPixel(x, y)) {
                    maxX = x;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
    }

    if (maxX < minX || maxY < minY) {
        return {
            characterBox: { top: 0, bottom: height, left: 0, right: width },
            width,
            height,
        };
    }

    return {
        characterBox: { top: minY, bottom: maxY, left: minX, right: maxX },
        width,
        height,
    };
}

/**
 * ベース画像から顔領域をヒューリスティックで検出する
 *
 * アルゴリズム:
 * 1. ベース画像の非透明領域（キャラクター全体）のバウンディングボックスを検出
 * 2. キャラクターの上部 10%〜35% の範囲を「顔」として推定
 * 3. 横方向は中央から幅の 50% を顔幅とする
 *
 * @param imageSource ベース画像のパスまたは Base64 Data URL
 * @returns 顔領域の検出結果
 */
export async function detectFaceRegion(imageSource: string): Promise<FaceDetectionResult> {
    const { characterBox, width, height } = await extractCharacterBox(imageSource);

    // 非透明ピクセルが見つからない場合（extractCharacterBox が画像全体を返した場合）のフォールバック
    if (characterBox.top === 0 && characterBox.bottom === height && characterBox.left === 0 && characterBox.right === width) {
        // 実際に非透明ピクセルがゼロかどうかを念のため確認
        const img = await loadImage(imageSource);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, width, height).data;
            let hasContent = false;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] >= 10) { hasContent = true; break; }
            }
            if (!hasContent) {
                const fallbackBox: BoundingBox = {
                    top: 0,
                    bottom: Math.round(height * 0.35),
                    left: Math.round(width * 0.25),
                    right: Math.round(width * 0.75),
                };
                return {
                    faceBox: fallbackBox,
                    confidence: 0.1,
                    method: 'heuristic',
                    characterBox,
                };
            }
        }
    }

    // ヒューリスティックによる顔領域の推定
    const faceBox = estimateFaceBox(characterBox);

    return {
        faceBox,
        confidence: 0.6,
        method: 'heuristic',
        characterBox,
    };
}

/**
 * キャラクターのバウンディングボックスから顔領域を推定する（純粋関数）
 *
 * @param characterBox キャラクター全体の非透明領域
 * @returns 推定された顔のバウンディングボックス
 */
export function estimateFaceBox(characterBox: BoundingBox): BoundingBox {
    const charWidth = characterBox.right - characterBox.left;
    const charHeight = characterBox.bottom - characterBox.top;
    const charCenterX = characterBox.left + charWidth / 2;

    // 顔の縦方向位置: キャラクター領域の上端から FACE_TOP_RATIO 〜 FACE_BOTTOM_RATIO
    const faceTop = characterBox.top + charHeight * FACE_HEURISTIC.FACE_TOP_RATIO;
    const faceBottom = characterBox.top + charHeight * FACE_HEURISTIC.FACE_BOTTOM_RATIO;

    // 顔の横方向: キャラクター中心から FACE_WIDTH_RATIO の幅を左右に取る
    const faceWidth = charWidth * FACE_HEURISTIC.FACE_WIDTH_RATIO;
    const faceLeft = charCenterX - faceWidth / 2;
    const faceRight = charCenterX + faceWidth / 2;

    return {
        top: Math.round(faceTop),
        bottom: Math.round(faceBottom),
        left: Math.round(faceLeft),
        right: Math.round(faceRight),
    };
}

/**
 * ローカル API（/api/detect-face-mask）を使った高精度な顔領域検出。
 * MediaPipe FaceLandmarker → OpenCV Haarcascade → BFS の順にフォールバック。
 * 失敗時はヒューリスティックにフォールバックする。
 *
 * @param imageSource 画像の URL（/mascots/... 形式）または http(s):// URL
 * @param _apiKey 互換性のため残存（未使用）
 * @returns 顔のバウンディングボックスを含む検出結果
 */
export async function detectFaceRegionWithAI(
    imageSource: string,
    _apiKey?: string
): Promise<FaceDetectionResult> {
    // キャラクター全体の BB は Canvas で取得（ヒューリスティックと共通処理）
    const { characterBox } = await extractCharacterBox(imageSource);

    try {
        // URL から /mascots/... パスを抽出
        let imagePath: string;
        if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
            imagePath = new URL(imageSource).pathname;
        } else {
            imagePath = imageSource;
        }

        if (!imagePath.startsWith('/mascots/')) {
            throw new Error(`ローカル API は /mascots/ パスのみサポートしています: ${imagePath}`);
        }

        // サーバーの origin を URL から取得（フォールバック: window.location.origin）
        let apiBase = '';
        if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
            const u = new URL(imageSource);
            apiBase = u.origin;
        }

        console.log(`[FaceRegionDetector] ローカル API を呼び出します: imagePath=${imagePath}`);

        const response = await fetch(`${apiBase}${LOCAL_FACE_MASK_API}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagePath }),
        });

        if (!response.ok) {
            throw new Error(`ローカル API エラー: HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data.success || !data.mask) {
            throw new Error(`ローカル API 応答が不正: ${JSON.stringify(data)}`);
        }

        const { centerX, centerY, radiusX, radiusY } = data.mask;
        const faceBox: BoundingBox = {
            top: Math.round(centerY - radiusY),
            bottom: Math.round(centerY + radiusY),
            left: Math.round(centerX - radiusX),
            right: Math.round(centerX + radiusX),
        };

        console.log(`[FaceRegionDetector] ローカル API 検出成功 (method=${data.method}): faceBox=`, faceBox);

        return {
            faceBox,
            confidence: 0.9,
            method: 'ai',
            characterBox,
        };
    } catch (error: any) {
        console.warn(`[FaceRegionDetector] ローカル API 検出に失敗しました: ${error.message}。ヒューリスティックにフォールバックします。`);

        const faceBox = estimateFaceBox(characterBox);
        return {
            faceBox,
            confidence: 0.6,
            method: 'heuristic',
            characterBox,
        };
    }
}
