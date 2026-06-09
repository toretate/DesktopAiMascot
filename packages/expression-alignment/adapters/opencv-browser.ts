/**
 * ブラウザ / WebView 用 OpenCV ローダー（本番: Electron renderer / Web / WebView 共用）。
 * `@techstark/opencv-js` の Module を onRuntimeInitialized で待つ。
 * ブラウザ環境では Node のようなハング問題は発生しない。
 */

import cvModule from '@techstark/opencv-js';
import type { OpenCvLike } from '../src/registration-opencv';

let _ready: Promise<OpenCvLike> | null = null;

/** OpenCV.js（@techstark）の初期化完了を待って cv を返す */
export function loadOpenCvBrowser(): Promise<OpenCvLike> {
    if (_ready) return _ready;
    _ready = new Promise<OpenCvLike>((resolve) => {
        const cv: any = cvModule;
        if (typeof cv.Mat === 'function') {
            resolve(cv as OpenCvLike);
            return;
        }
        cv.onRuntimeInitialized = () => resolve(cv as OpenCvLike);
    });
    return _ready;
}
