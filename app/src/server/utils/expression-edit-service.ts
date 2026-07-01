import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { PYTHON_DIR, resolveMascotPath } from './paths';

const execFileAsync = promisify(execFile);

const PYTHON_BIN = process.env.REMBG_PYTHON
    ?? path.join(PYTHON_DIR, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');

const NOFACE_SCRIPT = path.join(PYTHON_DIR, 'generate_noface.py');
const RETOUCH_SCRIPT = path.join(PYTHON_DIR, 'retouch.py');

function resolveImagePath(imagePath: string): string {
    if (imagePath.startsWith('/mascots/')) {
        return resolveMascotPath(imagePath);
    }
    return imagePath;
}

/**
 * のっぺらぼう画像を自動生成する。
 */
export async function generateNofaceImage(inputPath: string, outputPath: string): Promise<string> {
    const absInput = resolveImagePath(inputPath);
    const absOutput = resolveImagePath(outputPath);

    // 出力先ディレクトリの確保
    fs.mkdirSync(path.dirname(absOutput), { recursive: true });

    if (!fs.existsSync(absInput)) {
        throw new Error(`Input image not found: ${absInput}`);
    }

    const { stdout } = await execFileAsync(
        PYTHON_BIN,
        [NOFACE_SCRIPT, absInput, absOutput],
        { timeout: 30_000 }
    );

    const result = JSON.parse(stdout.trim()) as { success: boolean; outputPath?: string; error?: string };
    if (!result.success || result.error) {
        throw new Error(`generate_noface failed: ${result.error}`);
    }

    return outputPath;
}

/**
 * 手動レタッチを適用する。
 */
export async function applyRetouch(
    inputPath: string,
    outputPath: string,
    tool: 'brush' | 'eraser',
    x: number,
    y: number,
    radius: number
): Promise<string> {
    const absInput = resolveImagePath(inputPath);
    const absOutput = resolveImagePath(outputPath);

    fs.mkdirSync(path.dirname(absOutput), { recursive: true });

    if (!fs.existsSync(absInput)) {
        throw new Error(`Input image not found: ${absInput}`);
    }

    const { stdout } = await execFileAsync(
        PYTHON_BIN,
        [RETOUCH_SCRIPT, absInput, absOutput, tool, String(x), String(y), String(radius)],
        { timeout: 10_000 }
    );

    const result = JSON.parse(stdout.trim()) as { success: boolean; outputPath?: string; error?: string };
    if (!result.success || result.error) {
        throw new Error(`retouch failed: ${result.error}`);
    }

    return outputPath;
}
