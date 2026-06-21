/**
 * vision.cpp の vision-cli を呼び出して BiRefNet 系 GGUF モデルで背景除去するサービス。
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { VISION_DIR } from './paths';

const execFileAsync = promisify(execFile);

const MODELS_DIR = process.env.VISION_MODELS_DIR ?? path.join(VISION_DIR, 'models');
const BACKEND = process.env.VISION_BACKEND ?? 'cpu';

export type BiRefNetVariant = 'toonout' | 'birefnet-general' | 'birefnet-lite';

/** バリアント → GGUF ファイル名 */
const MODEL_FILES: Record<BiRefNetVariant, string> = {
    'toonout': 'BiRefNet-ToonOut-F16.gguf',
    'birefnet-general': 'BiRefNet-F16.gguf',
    'birefnet-lite': 'BiRefNet-lite-F16.gguf',
};

export function isBiRefNetVariant(v: string): v is BiRefNetVariant {
    return v in MODEL_FILES;
}

function modelPath(variant: BiRefNetVariant): string {
    return path.join(MODELS_DIR, MODEL_FILES[variant]);
}

function setupHint(): string {
    return process.platform === 'win32'
        ? 'cd python-services\\vision && powershell -ExecutionPolicy Bypass -File .\\setup.ps1'
        : 'cd python-services/vision && ./setup.sh';
}

/** OS によって配置・拡張子が異なる vision-cli を解決する。 */
function resolveVisionCli(): string {
    if (process.env.VISION_CLI) return process.env.VISION_CLI;
    const exe = process.platform === 'win32' ? '.exe' : '';
    const candidates = [
        path.join(VISION_DIR, `bin/vision-cli${exe}`),                  // Win/Linux: プレビルト (setup.ps1 / setup.sh)
        path.join(VISION_DIR, `vision.cpp/build/bin/vision-cli${exe}`), // macOS 等: ソースビルド (setup.sh)
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    throw new Error(`vision-cli not found. Run: ${setupHint()}`);
}

/**
 * 指定バリアントが実行可能か（vision-cli とモデルが揃っているか）を返す。
 */
export function checkBiRefNetAvailable(variant: BiRefNetVariant = 'toonout'): { available: boolean; reason?: string } {
    try {
        resolveVisionCli();
    } catch (e: any) {
        return { available: false, reason: e.message };
    }
    const m = modelPath(variant);
    if (!fs.existsSync(m)) {
        return { available: false, reason: `model not found: ${m}` };
    }
    return { available: true };
}

/**
 * 画像 Buffer の背景を BiRefNet 系モデルで除去し、透過 PNG の Buffer を返す。
 */
export async function removeBackgroundBiRefNet(
    imageBuffer: Buffer,
    variant: BiRefNetVariant = 'toonout',
): Promise<Buffer> {
    const bin = resolveVisionCli();
    const model = modelPath(variant);

    if (!fs.existsSync(model)) {
        throw new Error(`BiRefNet model not found: ${model}. Run: ${setupHint()}`);
    }

    // vision-cli はファイル入出力なので一時ディレクトリを使う
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birefnet-'));
    const inPath = path.join(tmpDir, 'in.png');
    const maskPath = path.join(tmpDir, 'mask.png');
    const cutoutPath = path.join(tmpDir, 'cutout.png');

    try {
        fs.writeFileSync(inPath, imageBuffer);

        const { stderr } = await execFileAsync(
            bin,
            [
                'birefnet',
                '-b', BACKEND,
                '-m', model,
                '-i', inPath,
                '-o', maskPath,
                '--composite', cutoutPath,
            ],
            { timeout: 120_000, maxBuffer: 1024 * 1024 }
        );

        if (stderr) {
            console.debug(`[BiRefNetService:${variant}]`, stderr.trim().split('\n').at(-1));
        }

        if (!fs.existsSync(cutoutPath)) {
            throw new Error('vision-cli produced no composite output');
        }
        return fs.readFileSync(cutoutPath);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}
