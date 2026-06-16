/**
 * BiRefNet-ToonOut 背景除去 (toonout-service) の結合テスト。
 *
 * vision-cli + GGUF モデルが必要なため、セットアップ未済の環境では自動スキップする
 * （CI 等で `npm test` が落ちないように）。
 *   セットアップ: cd server/vision && ./setup.sh   (Windows: setup.ps1)
 *
 * 実行結果（透過切り抜き PNG）は server/vision/test_results/ に保存する
 *   ─ python の test_results/ と同じ慣習。
 *
 * 実行: cd server && npm test    （個別: npx tsx --test src/test/toonout.test.ts）
 */

import { describe, it, before } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
    removeBackgroundToonOut,
    checkToonOutAvailable,
} from '../services/toonout-service';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SAMPLE_DIR = path.join(REPO_ROOT, 'mascots/default_mascot_sample');
const RESULTS_DIR = path.join(__dirname, '../../vision/test_results');

const TEST_IMAGES = ['guide_01.png', 'guide_02.png'];

/** PNG の IHDR から幅・高さ・カラータイプを読む（依存なしで検証するため）。 */
function readPngHeader(buf: Buffer): { width: number; height: number; colorType: number } {
    // PNG シグネチャ
    const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.ok(buf.subarray(0, 8).equals(SIG), 'PNG シグネチャが不正');
    // IHDR は先頭チャンク: length(4) + 'IHDR'(4) + width(4) + height(4) + bitDepth(1) + colorType(1)
    assert.strictEqual(buf.subarray(12, 16).toString('ascii'), 'IHDR', 'IHDR チャンクが先頭にない');
    return {
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
        colorType: buf.readUInt8(25),
    };
}

describe('ToonOut 背景除去サービス', () => {
    const availability = checkToonOutAvailable();

    before(() => {
        if (availability.available) {
            fs.mkdirSync(RESULTS_DIR, { recursive: true });
        }
    });

    for (const name of TEST_IMAGES) {
        it(
            `${name} を透過 PNG (RGBA) に変換し test_results/ に保存できること`,
            { skip: availability.available ? false : `ToonOut 未セットアップ: ${availability.reason}`, timeout: 180_000 },
            async () => {
                const inputPath = path.join(SAMPLE_DIR, name);
                assert.ok(fs.existsSync(inputPath), `テスト画像が見つからない: ${inputPath}`);

                const input = fs.readFileSync(inputPath);
                const inHeader = readPngHeader(input);

                const output = await removeBackgroundToonOut(input);

                // 実行結果を保存（目視確認用）
                const outPath = path.join(RESULTS_DIR, name.replace('.png', '_toonout.png'));
                fs.writeFileSync(outPath, output);

                // 検証: 非空の PNG であること
                assert.ok(output.length > 0, '出力が空');
                const outHeader = readPngHeader(output);

                // 検証: 透過チャンネルを持つ RGBA PNG (colorType 6) であること
                assert.strictEqual(outHeader.colorType, 6, `出力が RGBA でない (colorType=${outHeader.colorType})`);

                // 検証: 入力と同じ寸法であること
                assert.strictEqual(outHeader.width, inHeader.width, '出力幅が入力と異なる');
                assert.strictEqual(outHeader.height, inHeader.height, '出力高さが入力と異なる');

                console.log(`[toonout] ${name}: ${outHeader.width}x${outHeader.height} RGBA -> ${outPath} (${output.length} bytes)`);
            }
        );
    }
});
