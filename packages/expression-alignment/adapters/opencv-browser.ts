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
    if (_ready) {
        console.log('[loadOpenCvBrowser] Returning cached _ready Promise');
        return _ready;
    }
    console.log('[loadOpenCvBrowser] cvModule raw:', cvModule);
    
    _ready = new Promise<OpenCvLike>((resolve, reject) => {
        try {
            const cv: any = cvModule;
            if (!cv) {
                _ready = null;
                reject(new Error('[loadOpenCvBrowser] cvModule is null or undefined!'));
                return;
            }

            // cvModule が thenable (Promise または Emscripten モジュール) の場合
            if (typeof cv.then === 'function') {
                console.log('[loadOpenCvBrowser] cvModule is thenable. Awaiting it...');
                cv.then((resolvedCv: any) => {
                    console.log('[loadOpenCvBrowser] cvModule resolved');
                    
                    // Emscripten の then メソッドは Promise 解決時に無限ハングを引き起こすため削除する
                    if (resolvedCv && typeof resolvedCv.then === 'function') {
                        try {
                            delete resolvedCv.then;
                            console.log('[loadOpenCvBrowser] deleted resolvedCv.then to prevent hang');
                        } catch (e) {
                            console.warn('[loadOpenCvBrowser] Failed to delete resolvedCv.then:', e);
                        }
                    }

                    if (typeof resolvedCv.Mat === 'function') {
                        console.log('[loadOpenCvBrowser] resolvedCv is already initialized (cv.Mat exists)');
                        resolve(resolvedCv as OpenCvLike);
                    } else {
                        console.log('[loadOpenCvBrowser] resolvedCv is not initialized yet. Waiting for onRuntimeInitialized...');
                        resolvedCv.onRuntimeInitialized = () => {
                            console.log('[loadOpenCvBrowser] resolvedCv onRuntimeInitialized fired!');
                            resolve(resolvedCv as OpenCvLike);
                        };
                    }
                }).catch((err: any) => {
                    _ready = null;
                    console.error('[loadOpenCvBrowser] cvModule Promise rejected:', err);
                    reject(err);
                });
            } else {
                // then を持たない通常のオブジェクトの場合
                if (typeof cv.Mat === 'function') {
                    console.log('[loadOpenCvBrowser] cvModule is already initialized (cv.Mat exists)');
                    resolve(cv as OpenCvLike);
                } else {
                    console.log('[loadOpenCvBrowser] cvModule is not initialized yet. Waiting for onRuntimeInitialized...');
                    cv.onRuntimeInitialized = () => {
                        console.log('[loadOpenCvBrowser] onRuntimeInitialized fired!');
                        resolve(cv as OpenCvLike);
                    };
                }
            }
        } catch (err) {
            _ready = null;
            console.error('[loadOpenCvBrowser] Error during loadOpenCvBrowser:', err);
            reject(err);
        }
    });

    return _ready;
}
