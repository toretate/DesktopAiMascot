/**
 * rembg (ONNX) を Python サイドカー経由で呼び出す背景除去サービス。
 *
 * isnet-anime（アニメ特化）など rembg のモデルを使う。vision.cpp の BiRefNet 系とは
 * 別ランタイム（onnxruntime）。crop-expression-service.ts と同じ execFile パターン。
 *
 * 事前準備:
 *   cd server/python && uv sync   （rembg/onnxruntime を含む）
 *   ※ モデルは初回実行時に rembg が ~/.u2net/ へ自動DLする。
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const execFileAsync = promisify(execFile);

const PYTHON_DIR = path.join(__dirname, '../../python');
const PYTHON_BIN = process.env.REMBG_PYTHON
    ?? path.join(PYTHON_DIR, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const SCRIPT_PATH = path.join(PYTHON_DIR, 'remove_bg.py');

/** rembg (Python venv + スクリプト) が利用可能か。 */
export function checkRembgAvailable(): { available: boolean; reason?: string } {
    if (!fs.existsSync(PYTHON_BIN)) {
        return { available: false, reason: `python venv not found: ${PYTHON_BIN}. Run: cd server/python && uv sync` };
    }
    if (!fs.existsSync(SCRIPT_PATH)) {
        return { available: false, reason: `script not found: ${SCRIPT_PATH}` };
    }
    return { available: true };
}

/**
 * 画像 Buffer の背景を rembg モデルで除去し、透過 PNG の Buffer を返す。
 * @param model rembg モデル名（既定 isnet-anime）
 */
export async function removeBackgroundRembg(
    imageBuffer: Buffer,
    model: string = 'isnet-anime',
): Promise<Buffer> {
    if (!fs.existsSync(PYTHON_BIN)) {
        throw new Error(`python venv not found: ${PYTHON_BIN}. Run: cd server/python && uv sync`);
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rembg-'));
    const inPath = path.join(tmpDir, 'in.png');
    const outPath = path.join(tmpDir, 'out.png');

    try {
        fs.writeFileSync(inPath, imageBuffer);

        const { stdout, stderr } = await execFileAsync(
            PYTHON_BIN,
            [SCRIPT_PATH, inPath, '--model', model, '--out', outPath],
            { timeout: 120_000, maxBuffer: 1024 * 1024 }
        );

        if (stderr) {
            console.debug(`[RembgService:${model}]`, stderr.trim().split('\n').at(-1));
        }

        const result = JSON.parse(stdout.trim()) as { success: boolean; error?: string };
        if (!result.success) {
            throw new Error(`rembg failed: ${result.error ?? 'unknown error'}`);
        }
        if (!fs.existsSync(outPath)) {
            throw new Error('rembg produced no output');
        }
        return fs.readFileSync(outPath);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}
