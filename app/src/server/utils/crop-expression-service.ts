/**
 * Python スクリプト (crop_expression.py) を呼び出して表情スプライトをクロップするサービス。
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { PYTHON_DIR, resolveMascotPath } from './paths';

const execFileAsync = promisify(execFile);

const PYTHON_BIN = process.env.REMBG_PYTHON
    ?? path.join(PYTHON_DIR, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const SCRIPT_PATH = path.join(PYTHON_DIR, 'crop_expression.py');

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
 * @param imagePath `/mascots/...` 形式 of 静的パス、または絶対ファイルパス
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
        return resolveMascotPath(imagePath);
    }
    return imagePath;
}
