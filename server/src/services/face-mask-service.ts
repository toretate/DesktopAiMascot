/**
 * Python スクリプト (detect_face_mask.py) を呼び出して顔マスクを検出するサービス。
 *
 * 検出戦略（Python 側）:
 *   1. MediaPipe FaceLandmarker（虹彩中心ランドマーク）
 *   2. OpenCV Haarcascade eye
 *   3. TypeScript BFS 移植（最終フォールバック）
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

const PYTHON_DIR = path.join(__dirname, '../../python');
const PYTHON_BIN = path.join(PYTHON_DIR, '.venv/bin/python');
const SCRIPT_PATH = path.join(PYTHON_DIR, 'detect_face_mask.py');
const MASCOTS_DIR = path.join(__dirname, '../../../mascots');

export interface FaceMask {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    feather: number;
}

export interface FaceMaskResult extends FaceMask {
    method: 'mediapipe' | 'haarcascade' | 'bfs-fallback';
}

/**
 * 画像ファイルから顔マスクパラメータを検出する。
 *
 * @param imagePath `/mascots/...` 形式の静的パス、または絶対ファイルパス
 */
export async function detectFaceMask(imagePath: string): Promise<FaceMaskResult> {
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
        // MediaPipe の初期化ログは stderr に出るが正常動作
        console.debug('[FaceMaskService]', stderr.trim().split('\n').at(-1));
    }

    const result = JSON.parse(stdout.trim()) as FaceMaskResult & { error?: string };

    if (result.error) {
        throw new Error(`Face detection failed: ${result.error}`);
    }

    return result;
}

function resolveImagePath(imagePath: string): string {
    if (imagePath.startsWith('/mascots/')) {
        return path.join(MASCOTS_DIR, imagePath.slice('/mascots/'.length));
    }
    return imagePath;
}
