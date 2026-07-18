// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MusicWidget from '../MusicWidget.vue';
import { useConfigStore } from '../../store/config';
import { useMusicStore } from '../../store/music';
import { AMBIENT_SOUNDS } from '../music-widget/ambient-sounds';

const directoryMocks = vi.hoisted(() => ({
    supports: vi.fn(() => false),
    load: vi.fn(),
    save: vi.fn(),
    clear: vi.fn(),
    scan: vi.fn()
}));

vi.mock('../../utils/music-directory-handle', () => ({
    supportsMusicDirectoryPicker: directoryMocks.supports,
    loadMusicDirectoryHandle: directoryMocks.load,
    saveMusicDirectoryHandle: directoryMocks.save,
    clearMusicDirectoryHandle: directoryMocks.clear,
    scanMusicDirectory: directoryMocks.scan
}));

describe('MusicWidget', () => {
    const createObjectURL = vi.fn(() => 'blob:music-test');
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
        const pinia = createPinia();
        setActivePinia(pinia);
        window.electronAPI = undefined;
        localStorage.clear();
        window.location.hash = '#music';
        for (const sound of AMBIENT_SOUNDS) sound.source = null;
        createObjectURL.mockClear();
        revokeObjectURL.mockClear();
        directoryMocks.supports.mockReturnValue(false);
        directoryMocks.load.mockReset();
        directoryMocks.save.mockReset();
        directoryMocks.clear.mockReset();
        directoryMocks.scan.mockReset();
        Reflect.deleteProperty(window, 'showDirectoryPicker');
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
        Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() });
        Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
        Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('handleFiles_選択した音声をプレイリストへ追加すること', async () => {
        const wrapper = mount(MusicWidget, { global: { plugins: [createPinia()] } });
        const input = wrapper.get<HTMLInputElement>('input[type="file"]');
        const file = new File(['music'], 'Sample Artist - Sample Song.mp3', { type: 'audio/mpeg' });
        Object.defineProperty(file, 'webkitRelativePath', { configurable: true, value: 'Music/Sample Artist - Sample Song.mp3' });
        Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });

        await input.trigger('change');
        await flushPromises();

        expect(createObjectURL).toHaveBeenCalledWith(file);
        expect(input.attributes('webkitdirectory')).toBeDefined();
        expect(wrapper.text()).toContain('Sample Song');
        expect(wrapper.text()).toContain('Sample Artist');
        wrapper.unmount();
    });

    it('onMounted_Electronでは前回選択したフォルダを再読み込みすること', async () => {
        localStorage.setItem('desktop-mascot-music-restore-mode', 'electron');
        localStorage.setItem('desktop-mascot-music-folder-name', 'Music');
        localStorage.setItem('desktop-mascot-music-track-key', 'Sample Artist - Restored Song.mp3');
        localStorage.setItem('desktop-mascot-music-track-size', '1234');
        localStorage.setItem('desktop-mascot-music-track-last-modified', '1000');
        localStorage.setItem('desktop-mascot-music-playback-position', '15');
        const loadLastMusicFolder = vi.fn().mockResolvedValue({
            success: true,
            folderPath: 'C:\\Music',
            files: [{
                name: 'Sample Artist - Restored Song.mp3',
                relativePath: 'Sample Artist - Restored Song.mp3',
                size: 1234,
                lastModified: 1000,
                url: 'local-music://track/restored'
            }]
        });
        window.electronAPI = { isWeb: false, loadLastMusicFolder } as any;

        const wrapper = mount(MusicWidget, { global: { plugins: [createPinia()] } });
        await flushPromises();

        expect(loadLastMusicFolder).toHaveBeenCalledTimes(1);
        expect(wrapper.text()).toContain('Restored Song');
        expect(wrapper.text()).toContain('Sample Artist');
        const audio = wrapper.get<HTMLAudioElement>('audio');
        expect(audio.attributes('src')).toBe('local-music://track/restored');
        Object.defineProperty(audio.element, 'duration', { configurable: true, value: 180 });
        await audio.trigger('loadedmetadata');
        expect(audio.element.currentTime).toBe(15);
        expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    it('directoryInput_同じフォルダの再選択後に前回の曲と再生位置を復元すること', async () => {
        localStorage.setItem('desktop-mascot-music-restore-mode', 'directory-input');
        localStorage.setItem('desktop-mascot-music-folder-name', 'Music');
        localStorage.setItem('desktop-mascot-music-track-key', 'Album/Restored Song.mp3');
        localStorage.setItem('desktop-mascot-music-track-size', '5');
        localStorage.setItem('desktop-mascot-music-track-last-modified', '1000');
        localStorage.setItem('desktop-mascot-music-playback-position', '42');

        const wrapper = mount(MusicWidget, { global: { plugins: [createPinia()] } });
        await flushPromises();
        expect(wrapper.text()).toContain('前回のフォルダ「Music」を再選択');

        const input = wrapper.get<HTMLInputElement>('input[type="file"]');
        const file = new File(['music'], 'Restored Song.mp3', { type: 'audio/mpeg', lastModified: 1000 });
        Object.defineProperty(file, 'webkitRelativePath', { configurable: true, value: 'Music/Album/Restored Song.mp3' });
        Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });
        await input.trigger('change');
        await flushPromises();

        const audio = wrapper.get<HTMLAudioElement>('audio');
        Object.defineProperty(audio.element, 'duration', { configurable: true, value: 180 });
        await audio.trigger('loadedmetadata');

        expect(audio.element.currentTime).toBe(42);
        expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    it('fileSystemAccess_権限が残っていれば前回フォルダを自動復元すること', async () => {
        localStorage.setItem('desktop-mascot-music-restore-mode', 'file-system-access');
        localStorage.setItem('desktop-mascot-music-folder-name', 'Music');
        localStorage.setItem('desktop-mascot-music-track-key', 'Restored Song.mp3');
        const queryPermission = vi.fn().mockResolvedValue('granted');
        const handle = { kind: 'directory', name: 'Music', queryPermission };
        const file = new File(['music'], 'Restored Song.mp3', { type: 'audio/mpeg' });
        directoryMocks.supports.mockReturnValue(true);
        directoryMocks.load.mockResolvedValue(handle);
        directoryMocks.scan.mockResolvedValue([{ file, relativePath: 'Restored Song.mp3' }]);

        const wrapper = mount(MusicWidget, { global: { plugins: [createPinia()] } });
        await flushPromises();

        expect(queryPermission).toHaveBeenCalledWith({ mode: 'read' });
        expect(directoryMocks.scan).toHaveBeenCalledWith(handle);
        expect(wrapper.text()).toContain('Restored Song');
        wrapper.unmount();
    });

    it('fileSystemAccess_権限確認が必要な場合はユーザー操作まで要求しないこと', async () => {
        localStorage.setItem('desktop-mascot-music-restore-mode', 'file-system-access');
        localStorage.setItem('desktop-mascot-music-folder-name', 'Music');
        const queryPermission = vi.fn().mockResolvedValue('prompt');
        const requestPermission = vi.fn().mockResolvedValue('granted');
        const handle = { kind: 'directory', name: 'Music', queryPermission, requestPermission };
        directoryMocks.supports.mockReturnValue(true);
        directoryMocks.load.mockResolvedValue(handle);
        directoryMocks.scan.mockResolvedValue([]);

        const wrapper = mount(MusicWidget, { global: { plugins: [createPinia()] } });
        await flushPromises();

        expect(wrapper.text()).toContain('前回のフォルダを再開');
        expect(requestPermission).not.toHaveBeenCalled();
        await wrapper.get('.empty-state').trigger('click');
        await flushPromises();
        expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' });
        wrapper.unmount();
    });

    it('fileSystemAccess_ハンドルを保存できない場合はウィジェット上に警告すること', async () => {
        const handle = { kind: 'directory', name: 'Music' };
        const file = new File(['music'], 'Song.mp3', { type: 'audio/mpeg' });
        directoryMocks.supports.mockReturnValue(true);
        directoryMocks.save.mockRejectedValue(new Error('IndexedDB unavailable'));
        directoryMocks.scan.mockResolvedValue([{ file, relativePath: 'Song.mp3' }]);
        Object.defineProperty(window, 'showDirectoryPicker', {
            configurable: true,
            value: vi.fn().mockResolvedValue(handle)
        });

        const wrapper = mount(MusicWidget, { global: { plugins: [createPinia()] } });
        await wrapper.get('button[title="フォルダを選択"]').trigger('click');
        await flushPromises();

        expect(wrapper.get('.warning-message').text()).toContain('次回起動時に自動復元できません');
        expect(wrapper.text()).toContain('Song');
        wrapper.unmount();
    });

    it('clearPlaylist_復元情報と保存済みディレクトリハンドルを削除すること', async () => {
        directoryMocks.clear.mockResolvedValue(undefined);
        Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {} });
        const pinia = createPinia();
        setActivePinia(pinia);
        const wrapper = mount(MusicWidget, { global: { plugins: [pinia] } });
        const input = wrapper.get<HTMLInputElement>('input[type="file"]');
        const file = new File(['music'], 'Song.mp3', { type: 'audio/mpeg' });
        Object.defineProperty(file, 'webkitRelativePath', { configurable: true, value: 'Music/Song.mp3' });
        Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });
        await input.trigger('change');
        await flushPromises();

        await wrapper.get('.playlist-header > button:last-child').trigger('click');
        await flushPromises();

        expect(useMusicStore(pinia).restoreMode).toBe('none');
        expect(directoryMocks.clear).toHaveBeenCalledTimes(1);
        expect(wrapper.text()).toContain('PLAYLIST 0');
        Reflect.deleteProperty(globalThis, 'indexedDB');
        wrapper.unmount();
    });

    it('onUnmounted_作成したObjectURLを解放すること', async () => {
        const wrapper = mount(MusicWidget, { global: { plugins: [createPinia()] } });
        const input = wrapper.get<HTMLInputElement>('input[type="file"]');
        Object.defineProperty(input.element, 'files', {
            configurable: true,
            value: [new File(['music'], 'Sample Song.wav', { type: 'audio/wav' })]
        });

        await input.trigger('change');
        await flushPromises();
        wrapper.unmount();

        expect(revokeObjectURL).toHaveBeenCalledWith('blob:music-test');
    });

    it('widgetStyle_統合モードでは画面下部の横長表示になること', () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        useConfigStore().windowMode = 'integrated';
        window.location.hash = '#integrated';

        const wrapper = mount(MusicWidget, { global: { plugins: [pinia] } });

        expect(wrapper.get('.music-widget').classes()).toContain('integrated');
        expect(wrapper.get<HTMLElement>('.music-widget').element.style.bottom).toBe('12px');
        expect(wrapper.get<HTMLElement>('.music-widget').element.style.width).toBe('auto');
        expect(wrapper.get<HTMLElement>('.music-widget').element.style.height).toBe('76px');
        expect(wrapper.find('.integrated-progress').exists()).toBe(true);
        expect(wrapper.find('input[aria-label="再生位置"]').exists()).toBe(false);
        wrapper.unmount();
    });

    it('muteButton_音量アイコンでミュートを切り替えること', async () => {
        const wrapper = mount(MusicWidget, { global: { plugins: [createPinia()] } });
        const audio = wrapper.get<HTMLAudioElement>('audio').element;
        const muteButton = wrapper.get('.mute-button');

        expect(muteButton.attributes('aria-pressed')).toBe('false');
        await muteButton.trigger('click');

        expect(audio.muted).toBe(true);
        expect(muteButton.attributes('aria-pressed')).toBe('true');
        expect(muteButton.get('i').classes()).toContain('pi-volume-off');
        wrapper.unmount();
    });

    it('settingsButton_ウィジェット内で設定を開閉すること', async () => {
        const openSettings = vi.fn();
        window.electronAPI = { isWeb: false, openSettings } as any;
        const wrapper = mount(MusicWidget, { global: { plugins: [createPinia()] } });
        const settingsButton = wrapper.get('button[title="音楽ウィジェット設定"]');

        await settingsButton.trigger('click');

        expect(wrapper.find('.inline-settings').exists()).toBe(true);
        expect(wrapper.find('input#music-opacity').exists()).toBe(true);
        expect(wrapper.find('input#music-volume').exists()).toBe(false);
        expect(settingsButton.attributes('aria-expanded')).toBe('true');
        expect(openSettings).not.toHaveBeenCalled();

        await settingsButton.trigger('click');
        expect(wrapper.find('.inline-settings').exists()).toBe(false);
        wrapper.unmount();
    });

    it('ambientButton_環境音ミキサーをウィジェット内で開閉すること', async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        useConfigStore().windowMode = 'integrated';
        window.location.hash = '#integrated';
        const wrapper = mount(MusicWidget, { global: { plugins: [pinia] } });
        const ambientButton = wrapper.get('button[title="環境音ミキサー"]');

        await ambientButton.trigger('click');

        expect(wrapper.find('.ambient-mixer').exists()).toBe(true);
        expect(wrapper.text()).toContain('AMBIENT MIXER');
        expect(wrapper.find('.now-playing').exists()).toBe(false);
        expect(ambientButton.attributes('aria-expanded')).toBe('true');
        expect(wrapper.get<HTMLElement>('.music-widget').element.style.height).toBe('196px');
        expect(useMusicStore(pinia).contentPanelExpanded).toBe(true);

        await ambientButton.trigger('click');
        expect(wrapper.find('.ambient-mixer').exists()).toBe(false);
        expect(wrapper.get<HTMLElement>('.music-widget').element.style.height).toBe('76px');
        expect(useMusicStore(pinia).contentPanelExpanded).toBe(false);
        wrapper.unmount();
    });

    it('compactPlayer_コンパクトモードでは1行の操作だけを表示すること', () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        useConfigStore().windowMode = 'compact';
        window.location.hash = '#compact';

        const wrapper = mount(MusicWidget, { global: { plugins: [pinia] } });

        expect(wrapper.find('.compact-player-row').exists()).toBe(true);
        expect(wrapper.find('.widget-header').exists()).toBe(false);
        expect(wrapper.findAll('.compact-control')).toHaveLength(3);
        expect(wrapper.get('.ambient-compact-control').attributes('disabled')).toBeDefined();
        wrapper.unmount();
    });
});
