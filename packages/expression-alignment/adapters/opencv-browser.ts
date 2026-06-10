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
    console.log('[loadOpenCvBrowser] cvModule raw:', cvModule);
    _ready = new Promise<OpenCvLike>((resolve) => {
        const cv: any = cvModule;
        if (!cv) {
            console.error('[loadOpenCvBrowser] cvModule is null or undefined!');
            return;
        }
        
        // Promiseまたはthenableであるかのチェック
        if (typeof cv.then === 'function') {
            console.log('[loadOpenCvBrowser] cvModule is a Promise or thenable. Awaiting it...');
            cv.then((resolvedCv: any) => {
                console.log('[loadOpenCvBrowser] cvModule resolved:', resolvedCv);
                resolve(resolvedCv as OpenCvLike);
            }).catch((err: any) => {
                console.error('[loadOpenCvBrowser] cvModule Promise rejected:', err);
            });
            return;
        }

        if (typeof cv.Mat === 'function') {
            console.log('[loadOpenCvBrowser] cvModule is already initialized (cv.Mat exists)');
            resolve(cv as OpenCvLike);
            return;
        }

        console.log('[loadOpenCvBrowser] cvModule is not initialized yet. Waiting for onRuntimeInitialized...');
        cv.onRuntimeInitialized = () => {
            console.log('[loadOpenCvBrowser] onRuntimeInitialized fired!');
            resolve(cv as OpenCvLike);
        };
    });
    return _ready;
}
