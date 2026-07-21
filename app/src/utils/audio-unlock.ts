/**
 * 1px / 1サンプルの無音WAV（Base64 Data URL）
 */
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAA==';

let isUnlocked = false;

/**
 * 現在の環境がWebクライアント（非Electron環境）かどうかを判定します。
 */
export function isWebClient(): boolean {
    return typeof window !== 'undefined' && typeof window.electronAPI === 'undefined';
}

/**
 * 初回のユーザー操作時に呼び出し、ブラウザの音声自動再生（Autoplay）制限を解放します。
 * 冪等であり、複数回呼び出しても解放処理は1度のみ実行されます。
 * 非対応環境や拒否時も例外を投げず非致命的に処理します。
 */
export async function unlockAudio(): Promise<boolean> {
    if (isUnlocked) {
        return true;
    }
    isUnlocked = true;

    if (typeof window === 'undefined') {
        return false;
    }

    try {
        // HTMLAudioElement の解放
        if (typeof HTMLAudioElement !== 'undefined') {
            const silentAudio = new Audio(SILENT_WAV);
            await silentAudio.play().catch(() => {
                // 自動再生拒否などのエラーは非致命的として無視
            });
        }

        // Web Audio API (AudioContext) の解放
        const AudioContextClass = window.AudioContext
            || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

        if (AudioContextClass) {
            const ctx = new AudioContextClass();
            if (ctx.state === 'suspended') {
                await ctx.resume().catch(() => {});
            }
            if (typeof ctx.close === 'function') {
                await ctx.close().catch(() => {});
            }
        }
    } catch {
        // 解放処理中の予期せぬ例外も非致命的として吸収
    }

    return true;
}

/**
 * Web環境において、初回の明示操作（pointerdown等）で音声解放を行うリスナーを設定します。
 * Electron環境では何もしません。
 * @returns リスナー解除用のクリーンアップ関数
 */
export function setupAudioUnlock(): () => void {
    if (!isWebClient() || typeof window === 'undefined') {
        return () => {};
    }

    const handleInteraction = () => {
        cleanup();
        void unlockAudio();
    };

    const options: AddEventListenerOptions = { once: true, passive: true };
    const events = ['pointerdown', 'touchstart', 'keydown'];

    for (const event of events) {
        window.addEventListener(event, handleInteraction, options);
    }

    const cleanup = () => {
        for (const event of events) {
            window.removeEventListener(event, handleInteraction, options);
        }
    };

    return cleanup;
}

/**
 * ユニットテスト用に解放状態をリセットします。
 */
export function resetAudioUnlockStateForTest(): void {
    isUnlocked = false;
}
