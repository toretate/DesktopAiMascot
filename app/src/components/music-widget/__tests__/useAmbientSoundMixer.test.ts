// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { AMBIENT_SOUNDS } from '../ambient-sounds';
import { useAmbientSoundMixer } from '../useAmbientSoundMixer';

describe('useAmbientSoundMixer', () => {
    const originalAudio = globalThis.Audio;

    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
        for (const sound of AMBIENT_SOUNDS) sound.source = null;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        globalThis.Audio = originalAudio;
        for (const sound of AMBIENT_SOUNDS) sound.source = null;
    });

    it('toggleRunning_登録済み音源だけをループ再生して破棄すること', async () => {
        const audio = {
            paused: true,
            loop: false,
            preload: '',
            muted: false,
            volume: 1,
            play: vi.fn(async () => { audio.paused = false; }),
            pause: vi.fn(() => { audio.paused = true; }),
            removeAttribute: vi.fn(),
            load: vi.fn()
        };
        const AudioMock = vi.fn(function AudioConstructor() {
            return audio;
        });
        globalThis.Audio = AudioMock as unknown as typeof Audio;
        AMBIENT_SOUNDS[0].source = '/audio/ambient/rain-light.ogg';

        const mixer = useAmbientSoundMixer();
        mixer.initializeMixer();
        expect(mixer.playableSelectionCount.value).toBe(0);
        mixer.setChannelSelected('rain-light', true);
        expect(mixer.playableSelectionCount.value).toBe(1);
        mixer.setChannelVolume('rain-light', 0.5);
        mixer.masterVolume.value = 0.8;
        await nextTick();

        await mixer.toggleRunning();

        expect(AudioMock).toHaveBeenCalledWith('/audio/ambient/rain-light.ogg');
        expect(audio.loop).toBe(true);
        expect(audio.volume).toBe(0.4);
        expect(mixer.isRunning.value).toBe(true);

        mixer.setChannelSelected('rain-light', false);
        await nextTick();
        await flushPromises();
        expect(mixer.isRunning.value).toBe(false);

        mixer.disposeMixer();
        expect(audio.pause).toHaveBeenCalledTimes(1);
        expect(audio.removeAttribute).toHaveBeenCalledWith('src');
        expect(audio.load).toHaveBeenCalledTimes(1);
        expect(mixer.isRunning.value).toBe(false);
    });

    it('selectedChannels_再生中の音源切替に失敗したら停止状態とエラーを反映すること', async () => {
        const playingAudio = {
            paused: true,
            loop: false,
            preload: '',
            muted: false,
            volume: 1,
            play: vi.fn(async () => { playingAudio.paused = false; }),
            pause: vi.fn(() => { playingAudio.paused = true; }),
            removeAttribute: vi.fn(),
            load: vi.fn()
        };
        const failedAudio = {
            paused: true,
            loop: false,
            preload: '',
            muted: false,
            volume: 1,
            play: vi.fn().mockRejectedValue(new Error('decode failed')),
            pause: vi.fn(),
            removeAttribute: vi.fn(),
            load: vi.fn()
        };
        const AudioMock = vi.fn(function AudioConstructor(source: string) {
            return source.includes('rain-heavy') ? failedAudio : playingAudio;
        });
        globalThis.Audio = AudioMock as unknown as typeof Audio;
        AMBIENT_SOUNDS[0].source = '/audio/ambient/rain-light.ogg';
        AMBIENT_SOUNDS[1].source = '/audio/ambient/rain-heavy.ogg';
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const mixer = useAmbientSoundMixer();
        mixer.initializeMixer();
        mixer.setChannelSelected('rain-light', true);
        await mixer.toggleRunning();
        expect(mixer.isRunning.value).toBe(true);

        mixer.setChannelSelected('rain-heavy', true);
        await nextTick();
        await flushPromises();

        expect(mixer.isRunning.value).toBe(false);
        expect(mixer.playbackError.value).toContain('雨・強を再生できませんでした');
        expect(playingAudio.pause).toHaveBeenCalledTimes(1);
        expect(failedAudio.pause).toHaveBeenCalledTimes(1);

        mixer.setChannelSelected('rain-heavy', false);
        await nextTick();
        expect(mixer.playbackError.value).toBe('');
    });

    it('selectedChannels_再生開始中の意図的な停止をエラー表示しないこと', async () => {
        let rejectPlay: (reason?: unknown) => void = () => undefined;
        const playPromise = new Promise<void>((_resolve, reject) => {
            rejectPlay = reject;
        });
        const audio = {
            paused: true,
            loop: false,
            preload: '',
            muted: false,
            volume: 1,
            play: vi.fn(() => playPromise),
            pause: vi.fn(() => { audio.paused = true; }),
            removeAttribute: vi.fn(),
            load: vi.fn()
        };
        const AudioMock = vi.fn(function AudioConstructor() {
            return audio;
        });
        globalThis.Audio = AudioMock as unknown as typeof Audio;
        AMBIENT_SOUNDS[0].source = '/audio/ambient/rain-light.ogg';
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const mixer = useAmbientSoundMixer();
        mixer.initializeMixer();
        mixer.setChannelSelected('rain-light', true);
        const startPromise = mixer.toggleRunning();
        await Promise.resolve();

        mixer.setChannelSelected('rain-light', false);
        await nextTick();
        rejectPlay(new DOMException('play() was interrupted by pause()', 'AbortError'));
        await startPromise;
        await flushPromises();

        expect(mixer.isRunning.value).toBe(false);
        expect(mixer.playbackError.value).toBe('');
        expect(audio.pause).toHaveBeenCalledTimes(1);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('selectedChannels_再生開始待機中に追加した音源も再生すること', async () => {
        let resolveInitialPlay: () => void = () => undefined;
        const initialPlayPromise = new Promise<void>(resolve => {
            resolveInitialPlay = resolve;
        });
        const rainAudio = {
            loop: false,
            preload: '',
            muted: false,
            volume: 1,
            play: vi.fn(() => initialPlayPromise),
            pause: vi.fn(),
            removeAttribute: vi.fn(),
            load: vi.fn()
        };
        const windAudio = {
            loop: false,
            preload: '',
            muted: false,
            volume: 1,
            play: vi.fn().mockResolvedValue(undefined),
            pause: vi.fn(),
            removeAttribute: vi.fn(),
            load: vi.fn()
        };
        const AudioMock = vi.fn(function AudioConstructor(source: string) {
            return source.includes('wind') ? windAudio : rainAudio;
        });
        globalThis.Audio = AudioMock as unknown as typeof Audio;
        AMBIENT_SOUNDS[0].source = '/audio/ambient/rain-light.ogg';
        AMBIENT_SOUNDS[4].source = '/audio/ambient/wind.ogg';

        const mixer = useAmbientSoundMixer();
        mixer.initializeMixer();
        mixer.setChannelSelected('rain-light', true);
        const startPromise = mixer.toggleRunning();
        await Promise.resolve();

        expect(mixer.isRunning.value).toBe(true);
        mixer.setChannelSelected('wind', true);
        await nextTick();
        await flushPromises();

        expect(AudioMock).toHaveBeenCalledWith('/audio/ambient/wind.ogg');
        expect(windAudio.play).toHaveBeenCalledTimes(1);

        resolveInitialPlay();
        await startPromise;
        expect(mixer.isRunning.value).toBe(true);

        mixer.disposeMixer();
    });

    it('selectedChannels_高速なOFF_ON後に古い再生失敗で新しい音源を停止しないこと', async () => {
        let rejectOldPlay: (reason?: unknown) => void = () => undefined;
        const oldPlayPromise = new Promise<void>((_resolve, reject) => {
            rejectOldPlay = reject;
        });
        const oldAudio = {
            loop: false,
            preload: '',
            muted: false,
            volume: 1,
            play: vi.fn(() => oldPlayPromise),
            pause: vi.fn(),
            removeAttribute: vi.fn(),
            load: vi.fn()
        };
        const newAudio = {
            loop: false,
            preload: '',
            muted: false,
            volume: 1,
            play: vi.fn().mockResolvedValue(undefined),
            pause: vi.fn(),
            removeAttribute: vi.fn(),
            load: vi.fn()
        };
        const audioQueue = [oldAudio, newAudio];
        const AudioMock = vi.fn(function AudioConstructor() {
            return audioQueue.shift();
        });
        globalThis.Audio = AudioMock as unknown as typeof Audio;
        AMBIENT_SOUNDS[0].source = '/audio/ambient/rain-light.ogg';
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const mixer = useAmbientSoundMixer();
        mixer.initializeMixer();
        mixer.setChannelSelected('rain-light', true);
        const startPromise = mixer.toggleRunning();
        await Promise.resolve();

        mixer.setChannelSelected('rain-light', false);
        mixer.setChannelSelected('rain-light', true);
        expect(AudioMock).toHaveBeenCalledTimes(2);

        rejectOldPlay(new DOMException('old play failed', 'AbortError'));
        await startPromise;
        await flushPromises();

        expect(mixer.isRunning.value).toBe(true);
        expect(mixer.playbackError.value).toBe('');
        expect(oldAudio.pause).toHaveBeenCalledTimes(1);
        expect(newAudio.pause).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();

        mixer.disposeMixer();
        expect(newAudio.pause).toHaveBeenCalledTimes(1);
    });
});
