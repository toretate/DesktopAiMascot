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

/** Gemini Vision API で使用するモデル名 */
const GEMINI_VISION_MODEL = 'gemini-2.5-flash';

/**
 * 画像ソースから Gemini API 送信用の Base64 データと MimeType を抽出する
 *
 * @param imageSource Data URL 形式の画像（例: "data:image/png;base64,..."）
 *                    またはファイルパス（Node.js テスト環境用）
 * @returns { rawBase64, mimeType } の組
 */
function extractBase64AndMimeType(imageSource: string): { rawBase64: string; mimeType: string } {
    // Data URL 形式の場合
    const dataUrlMatch = imageSource.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
        return {
            mimeType: dataUrlMatch[1],
            rawBase64: dataUrlMatch[2],
        };
    }

    // Node.js テスト環境：ファイルパスから直接読み込む
    if (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST)) {
        try {
            const fs = eval("require('fs')");
            const buffer = fs.readFileSync(imageSource);
            const base64 = buffer.toString('base64');
            // 拡張子から MimeType を推定
            const ext = imageSource.toLowerCase().split('.').pop() || 'png';
            const mimeMap: Record<string, string> = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'webp': 'image/webp',
                'gif': 'image/gif',
            };
            return {
                mimeType: mimeMap[ext] || 'image/png',
                rawBase64: base64,
            };
        } catch {
            // ファイル読み込み失敗時はフォールバック
        }
    }

    throw new Error(`[FaceRegionDetector] 画像ソースから Base64 データを抽出できません: ${imageSource.substring(0, 60)}...`);
}

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
 * Gemini Vision API を使った高精度な顔領域検出
 *
 * Gemini の構造化出力（response_schema）を使用し、ベース画像中のキャラクターの
 * 頭部/顔領域の境界ボックスを正規化座標（0-1000）で取得する。
 * 取得した座標に画像のピクセルサイズを乗算してピクセル座標に変換する。
 *
 * @param imageSource 画像パスまたは Base64 Data URL
 * @param apiKey Gemini API キー
 * @returns 顔のバウンディングボックスを含む検出結果
 */
export async function detectFaceRegionWithAI(
    imageSource: string,
    apiKey: string
): Promise<FaceDetectionResult> {
    if (!apiKey) {
        throw new Error('[FaceRegionDetector] AI 検出には API キーが必要です');
    }

    // キャラクター全体のバウンディングボックスを Canvas で検出（ヒューリスティックと共通）
    const { characterBox, width, height } = await extractCharacterBox(imageSource);

    // 画像データを Base64 形式に変換
    const { rawBase64, mimeType } = extractBase64AndMimeType(imageSource);

    // Gemini Vision API に送信するプロンプト
    const prompt = 'この画像にはアニメ/イラスト風のキャラクターが描かれています。' +
        'キャラクターの「顔」（頭部）の領域を特定し、その境界ボックスを返してください。' +
        '顔には髪の毛、額、目、鼻、口、顎を含みます。' +
        '座標は画像全体に対する 0 から 1000 の正規化値で返してください。';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${apiKey}`;

    console.log(`[FaceRegionDetector] Gemini Vision API を呼び出します (model=${GEMINI_VISION_MODEL}, 画像サイズ=${width}x${height})`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: rawBase64 } }
                    ]
                }],
                generationConfig: {
                    response_mime_type: 'application/json',
                    response_schema: {
                        type: 'OBJECT',
                        properties: {
                            box_2d: {
                                type: 'ARRAY',
                                description: '[ymin, xmin, ymax, xmax] 座標（0-1000 の正規化値）',
                                items: { type: 'INTEGER' }
                            }
                        },
                        required: ['box_2d']
                    }
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini Vision API エラー: HTTP ${response.status} - ${errText.substring(0, 200)}`);
        }

        const data: any = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            throw new Error('Gemini Vision API からの応答にテキストが含まれていません');
        }

        const parsed = JSON.parse(resultText);
        const box2d = parsed.box_2d;

        if (!Array.isArray(box2d) || box2d.length < 4) {
            throw new Error(`box_2d の形式が不正です: ${JSON.stringify(box2d)}`);
        }

        // 正規化座標 (0-1000) からピクセル座標に変換
        const [ymin, xmin, ymax, xmax] = box2d;
        const faceBox: BoundingBox = {
            top: Math.round((ymin / 1000) * height),
            left: Math.round((xmin / 1000) * width),
            bottom: Math.round((ymax / 1000) * height),
            right: Math.round((xmax / 1000) * width),
        };

        console.log(`[FaceRegionDetector] AI 検出成功: box_2d=[${box2d}] → faceBox=`, faceBox);

        return {
            faceBox,
            confidence: 0.9,
            method: 'ai',
            characterBox,
        };
    } catch (error: any) {
        // 外部通信エラーハンドリング
        if (error instanceof TypeError && error.message.includes('fetch')) {
            console.warn('[FaceRegionDetector] Gemini Vision API との接続エラーが発生しました。ヒューリスティックにフォールバックします。');
        } else {
            console.warn(`[FaceRegionDetector] AI 検出に失敗しました: ${error.message}。ヒューリスティックにフォールバックします。`);
        }

        // AI 検出失敗時はヒューリスティック方式にフォールバック
        const faceBox = estimateFaceBox(characterBox);
        return {
            faceBox,
            confidence: 0.6,
            method: 'heuristic',
            characterBox,
        };
    }
}
