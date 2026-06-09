/**
 * 画像デコードの抽象化インターフェース。
 *
 * コア（solveTransform）は RasterImage（RGBA 配列）だけを受け取る純粋関数とし、
 * 実際の画像読み込み（Canvas / Node canvas / WebView 等）はこのインターフェースを
 * 実装したアダプタに委譲する。これにより DOM / 実行環境への依存をコアから切り離す。
 *
 * 既存実装にあった `eval("require('...node_modules/canvas')")` のような
 * 環境ハードコードを排除するのが目的。
 */

import type { RasterImage } from './types';

export interface ImageLoader {
    /**
     * 画像ソース（ファイルパス / data URL / URL など、アダプタが対応する形式）を
     * デコードして RasterImage を返す。
     */
    load(source: string): Promise<RasterImage>;
}
