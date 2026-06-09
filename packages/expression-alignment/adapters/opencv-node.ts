/**
 * Node 用 OpenCV ローダー（テスト・可視化用）。
 *
 * `@techstark/opencv-js`（および素の opencv.js）は Emscripten の非同期初期化を使い、
 * Node/Vitest で await すると高確率でハングする既知問題がある（vitest #3754 / techstark #29）。
 * そこで Node では **同期ロードでき即利用可能な `opencv-wasm`** を使う。
 *
 * 参考: https://www.npmjs.com/package/opencv-wasm （Node/deno 向けプリコンパイル・同期ロード）
 */

import { createRequire } from 'node:module';
import type { OpenCvLike } from '../src/registration-opencv';

const require = createRequire(import.meta.url);

let _cv: OpenCvLike | null = null;

/** opencv-wasm の cv（同期ロード・初期化待ち不要）を返す */
export function loadOpenCvNode(): OpenCvLike {
    if (!_cv) {
        // opencv-wasm は { cv, cvTranslateError } を同期で返す
        _cv = require('opencv-wasm').cv as OpenCvLike;
    }
    return _cv;
}
