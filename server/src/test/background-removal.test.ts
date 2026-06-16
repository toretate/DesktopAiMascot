/**
 * 背景除去エンジン比較テスト。
 *
 * 4エンジンをサンプル画像に適用し、結果を server/vision/test_results/ に保存して
 * 目視比較できるようにする。各エンジンは未セットアップなら自動スキップ。
 *   - toonout / birefnet-general / birefnet-lite : vision.cpp (GGUF)
 *   - isnet-anime                                : rembg (Python/ONNX)
 *
 * 実行: cd server && npx tsx --test src/test/background-removal.test.ts
 */

import { describe, it, before } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { removeBackground } from '../services/remove-bg-service';
import { checkBiRefNetAvailable, type BiRefNetVariant } from '../services/birefnet-service';
import { checkRembgAvailable } from '../services/rembg-service';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SAMPLE_DIR = path.join(REPO_ROOT, 'mascots/default_mascot_sample');
const RESULTS_DIR = path.join(__dirname, '../../vision/test_results');

const TEST_IMAGES = ['guide_01.png', 'guide_02.png'];

const ENGINES: { engine: string; available: () => { available: boolean; reason?: string } }[] = [
    { engine: 'toonout', available: () => checkBiRefNetAvailable('toonout') },
    { engine: 'birefnet-general', available: () => checkBiRefNetAvailable('birefnet-general') },
    { engine: 'birefnet-lite', available: () => checkBiRefNetAvailable('birefnet-lite') },
    { engine: 'isnet-anime', available: () => checkRembgAvailable() },
];

/** PNG の IHDR から幅・高さ・カラータイプを読む（依存なしで検証）。 */
function readPngHeader(buf: Buffer): { width: number; height: number; colorType: number } {
    const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.ok(buf.subarray(0, 8).equals(SIG), 'PNG シグネチャが不正');
    assert.strictEqual(buf.subarray(12, 16).toString('ascii'), 'IHDR', 'IHDR チャンクが先頭にない');
    return {
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
        colorType: buf.readUInt8(25),
    };
}

describe('背景除去エンジン比較', () => {
    before(() => {
        fs.mkdirSync(RESULTS_DIR, { recursive: true });
    });

    for (const { engine, available } of ENGINES) {
        const avail = available();
        for (const name of TEST_IMAGES) {
            it(
                `[${engine}] ${name} を透過 PNG に変換し test_results/ に保存`,
                { skip: avail.available ? false : `未セットアップ: ${avail.reason}`, timeout: 180_000 },
                async () => {
                    const inputPath = path.join(SAMPLE_DIR, name);
                    assert.ok(fs.existsSync(inputPath), `テスト画像が見つからない: ${inputPath}`);

                    const input = fs.readFileSync(inputPath);
                    const t = Date.now();
                    const output = await removeBackground(input, 'image/png', engine);
                    const sec = ((Date.now() - t) / 1000).toFixed(1);

                    const outPath = path.join(RESULTS_DIR, name.replace('.png', `_${engine}.png`));
                    fs.writeFileSync(outPath, output);

                    assert.ok(output.length > 0, '出力が空');
                    const h = readPngHeader(output);
                    assert.strictEqual(h.colorType, 6, `出力が RGBA でない (colorType=${h.colorType})`);

                    console.log(`[${engine}] ${name}: ${h.width}x${h.height} RGBA, ${sec}s -> ${path.basename(outPath)} (${output.length} bytes)`);
                }
            );
        }
    }
});
