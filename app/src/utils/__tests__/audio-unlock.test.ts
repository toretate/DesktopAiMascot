// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    isWebClient,
    resetAudioUnlockStateForTest,
    setupAudioUnlock,
    unlockAudio,
} from '../audio-unlock';

describe('audio-unlock', () => {
    const originalElectronAPI = window.electronAPI;
    const originalAudio = globalThis.Audio;
    const originalAudioContext = window.AudioContext;

    beforeEach(() => {
        resetAudioUnlockStateForTest();
        delete (window as Partial<Window>).electronAPI;
    });

    afterEach(() => {
        if (originalElectronAPI !== undefined) {
            window.electronAPI = originalElectronAPI;
        } else {
            delete (window as Partial<Window>).electronAPI;
        }
        globalThis.Audio = originalAudio;
        window.AudioContext = originalAudioContext;
        vi.restoreAllMocks();
    });

    describe('isWebClient', () => {
        it('isWebClient - window.electronAPIが存在しない場合はtrueを返すこと', () => {
            expect(isWebClient()).toBe(true);
        });

        it('isWebClient - window.electronAPIが存在する場合はfalseを返すこと', () => {
            window.electronAPI = {} as any;
            expect(isWebClient()).toBe(false);
        });
    });

    describe('unlockAudio', () => {
        it('unlockAudio - 初回実行時に無音Audio再生とAudioContext解除を行うこと', async () => {
            const playMock = vi.fn().mockResolvedValue(undefined);
            const audioConstructor = vi.fn(function (this: HTMLAudioElement) {
                this.play = playMock;
            });
            globalThis.Audio = audioConstructor as unknown as typeof Audio;

            const resumeMock = vi.fn().mockResolvedValue(undefined);
            const closeMock = vi.fn().mockResolvedValue(undefined);
            const audioContextConstructor = vi.fn(function (this: any) {
                this.state = 'suspended';
                this.resume = resumeMock;
                this.close = closeMock;
            });
            window.AudioContext = audioContextConstructor as unknown as typeof AudioContext;

            const result = await unlockAudio();

            expect(result).toBe(true);
            expect(audioConstructor).toHaveBeenCalled();
            expect(playMock).toHaveBeenCalled();
            expect(audioContextConstructor).toHaveBeenCalled();
            expect(resumeMock).toHaveBeenCalled();
            expect(closeMock).toHaveBeenCalled();
        });

        it('unlockAudio - 既に解放済みの場合は重複実行されないこと（冪等性）', async () => {
            const playMock = vi.fn().mockResolvedValue(undefined);
            globalThis.Audio = vi.fn(function (this: HTMLAudioElement) {
                this.play = playMock;
            }) as unknown as typeof Audio;

            await unlockAudio();
            expect(playMock).toHaveBeenCalledTimes(1);

            // 2回目の実行
            await unlockAudio();
            expect(playMock).toHaveBeenCalledTimes(1);
        });

        it('unlockAudio - 音声再生拒否時にも例外を投げず非致命的に処理されること', async () => {
            const playMock = vi.fn().mockRejectedValue(new Error('Autoplay error'));
            globalThis.Audio = vi.fn(function (this: HTMLAudioElement) {
                this.play = playMock;
            }) as unknown as typeof Audio;

            await expect(unlockAudio()).resolves.toBe(true);
        });
    });

    describe('setupAudioUnlock', () => {
        it('setupAudioUnlock - Web環境でpointerdownイベント時に音声解放が行われること', async () => {
            const playMock = vi.fn().mockResolvedValue(undefined);
            globalThis.Audio = vi.fn(function (this: HTMLAudioElement) {
                this.play = playMock;
            }) as unknown as typeof Audio;

            const cleanup = setupAudioUnlock();

            const event = new Event('pointerdown');
            window.dispatchEvent(event);

            // マイクロタスクの実行を待つ
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(playMock).toHaveBeenCalled();

            cleanup();
        });

        it('setupAudioUnlock - Electron環境ではイベントリスナーが登録されないこと', () => {
            window.electronAPI = {} as any;
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            const cleanup = setupAudioUnlock();

            expect(addEventListenerSpy).not.toHaveBeenCalled();
            cleanup();
        });
    });
});
