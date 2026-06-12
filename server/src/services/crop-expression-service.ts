/**
 * Python スクリプト (crop_expression.py) を呼び出して表情スプライトをクロップするサービス。
 *
 * 検出戦略（Python 側）:
 *   1. MediaPipe FaceLandmarker（虹彩中心ランドマーク 468/473）
 *   2. OpenCV Haarcascade eye
 *   3. BFS 暗島ペア法（TypeScript detectFaceFeatures 相当）
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

const PYTHON_DIR = path.join(__dirname, '../../python');
const PYTHON_BIN = path.join(PYTHON_DIR, '.venv/bin/python');
const SCRIPT_PATH = path.join(PYTHON_DIR, 'crop_expression.py');
const MASCOTS_DIR = path.join(__dirname, '../../../mascots');

export interface CropBox {
    top: number;
    left: number;
    bottom: number;
    right: number;
}

export interface CropExpressionResult {
    /** Base64 エンコードされたクロップ済み PNG（data: プレフィックスなし） */
    croppedBase64: string;
    /** クロップ領域（元画像ピクセル座標） */
    box: CropBox;
    /** 使用された検出手法 */
    method: 'mediapipe' | 'haarcascade' | 'bfs';
}

/**
 * 表情スプライト画像から顔領域をクロップして Base64 PNG を返す。
 *
 * @param imagePath `/mascots/...` 形式の静的パス、または絶対ファイルパス
 */
export async function cropExpression(imagePath: string): Promise<CropExpressionResult> {
    const absPath = resolveImagePath(imagePath);

    if (!fs.existsSync(absPath)) {
        throw new Error(`Image not found: ${absPath}`);
    }
    if (!fs.existsSync(PYTHON_BIN)) {
        throw new Error(`Python venv not found: ${PYTHON_BIN}. Run: cd server/python && uv sync`);
    }

    const { stdout, stderr } = await execFileAsync(
        PYTHON_BIN,
        [SCRIPT_PATH, absPath],
        { timeout: 60_000 }
    );

    if (stderr) {
        console.debug('[CropExpressionService]', stderr.trim().split('\n').at(-1));
    }

    const result = JSON.parse(stdout.trim()) as CropExpressionResult & { success: boolean; error?: string };

    if (!result.success || result.error) {
        throw new Error(`Crop failed: ${result.error ?? 'unknown error'}`);
    }

    return {
        croppedBase64: result.croppedBase64,
        box: result.box,
        method: result.method,
    };
}

function resolveImagePath(imagePath: string): string {
    if (imagePath.startsWith('/mascots/')) {
        return path.join(MASCOTS_DIR, imagePath.slice('/mascots/'.length));
    }
    return imagePath;
}
