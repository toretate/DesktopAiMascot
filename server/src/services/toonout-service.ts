/**
 * vision.cpp の vision-cli を呼び出して BiRefNet-ToonOut で背景除去するサービス。
 *
 * ToonOut は BiRefNet をアニメ画像向けにファインチューニングしたモデル
 * (https://huggingface.co/Acly/BiRefNet-toonout-GGUF)。
 * GGUF + vision.cpp で torch 非依存・ローカル実行できる。
 *
 * 事前準備:
 *   macOS/Linux: cd server/vision && ./setup.sh
 *   Windows    : cd server\vision && powershell -ExecutionPolicy Bypass -File .\setup.ps1
 *   （いずれも vision-cli の取得/ビルド + ToonOut モデルDL を行う）
 *
 * バックエンド:
 *   既定は CPU。Apple Silicon の Metal は ggml の既知バグ
 *   (GGML_ASSERT src[1]->type == F32) でクラッシュするため使用しない。
 *   Linux + Vulkan を使う場合は VISION_BACKEND=gpu を指定。
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const execFileAsync = promisify(execFile);

const VISION_DIR = path.join(__dirname, '../../vision');

const MODEL_PATH =
    process.env.TOONOUT_MODEL ??
    path.join(VISION_DIR, 'models/BiRefNet-ToonOut-F16.gguf');

const BACKEND = process.env.VISION_BACKEND ?? 'cpu';

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
    const setup = process.platform === 'win32'
        ? 'cd server\\vision && powershell -ExecutionPolicy Bypass -File .\\setup.ps1'
        : 'cd server/vision && ./setup.sh';
    throw new Error(`vision-cli not found. Run: ${setup}`);
}

/**
 * ToonOut が実行可能か（vision-cli とモデルが揃っているか）を返す。
 * セットアップ未済の環境でテストをスキップする等の判定に使う。
 */
export function checkToonOutAvailable(): { available: boolean; reason?: string } {
    let binary: string;
    try {
        binary = resolveVisionCli();
    } catch (e: any) {
        return { available: false, reason: e.message };
    }
    if (!fs.existsSync(MODEL_PATH)) {
        return { available: false, reason: `model not found: ${MODEL_PATH}` };
    }
    return { available: true };
}

/**
 * 画像 Buffer の背景を ToonOut で除去し、透過 PNG の Buffer を返す。
 */
export async function removeBackgroundToonOut(imageBuffer: Buffer): Promise<Buffer> {
    const bin = resolveVisionCli();

    if (!fs.existsSync(MODEL_PATH)) {
        const setup = process.platform === 'win32'
            ? 'cd server\\vision && powershell -ExecutionPolicy Bypass -File .\\setup.ps1'
            : 'cd server/vision && ./setup.sh';
        throw new Error(`ToonOut model not found: ${MODEL_PATH}. Run: ${setup}`);
    }

    // vision-cli はファイル入出力なので一時ディレクトリを使う
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toonout-'));
    const inPath = path.join(tmpDir, 'in.png');
    const maskPath = path.join(tmpDir, 'mask.png');
    const cutoutPath = path.join(tmpDir, 'cutout.png'); // --composite 出力（透過切り抜き）

    try {
        fs.writeFileSync(inPath, imageBuffer);

        const { stderr } = await execFileAsync(
            bin,
            [
                'birefnet',
                '-b', BACKEND,
                '-m', MODEL_PATH,
                '-i', inPath,
                '-o', maskPath,
                '--composite', cutoutPath,
            ],
            { timeout: 120_000, maxBuffer: 1024 * 1024 }
        );

        if (stderr) {
            console.debug('[ToonOutService]', stderr.trim().split('\n').at(-1));
        }

        if (!fs.existsSync(cutoutPath)) {
            throw new Error('vision-cli produced no composite output');
        }
        return fs.readFileSync(cutoutPath);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}
