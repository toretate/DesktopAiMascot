// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsWindow } from '../composables/useSettingsWindow';
import { createPinia, setActivePinia } from 'pinia';
import { useConfigStore } from '../../../store/config';
import { createApp } from 'vue';

// composable をコンポーネントのコンテキスト内で実行するためのヘルパー
function withSetup<T>(composable: () => T) {
    let result!: T;
    const app = createApp({
        setup() {
            result = composable();
            return () => {};
        }
    });
    const container = document.createElement('div');
    app.mount(container);
    return [result, app] as const;
}

describe('useSettingsWindow', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        
        // window.electronAPI のモックを設定
        (window as any).electronAPI = {
            quitApp: vi.fn(),
            getAppConfig: vi.fn().mockResolvedValue({}),
            updateAppConfig: vi.fn().mockResolvedValue({ success: true }),
            getMascots: vi.fn().mockResolvedValue([]),
            saveMascots: vi.fn().mockResolvedValue({ success: true })
        };

        // alert と confirm のモック化
        vi.stubGlobal('alert', vi.fn());
        vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    });

    it('addMascot - 新しいマスコットを追加したときにリストにマスコットが追加され、アクティブIDが更新されること', () => {
        const configStore = useConfigStore();
        configStore.mascots = [
            {
                id: 'mascot_1',
                name: 'マスコット1',
                avatar: '🤖',
                profile: 'プロフィール1',
                aiConfig: {
                    chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
                    voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
                },
                assets: { outfits: [], expressions: [], poses: [] }
            }
        ];
        configStore.activeMascotId = 'mascot_1';

        const [setupResult, app] = withSetup(() => useSettingsWindow());
        const { mascots, activeMascotId, addMascot } = setupResult;

        addMascot();

        expect(mascots.value.length).toBe(2);
        expect(mascots.value[1].name).toBe('新しいマスコット');
        expect(activeMascotId.value).toBe(mascots.value[1].id);

        app.unmount();
    });

    it('deleteMascot - マスコットが2つ以上存在する場合、確認ダイアログの承認後に削除が実行されること', () => {
        const configStore = useConfigStore();
        configStore.mascots = [
            {
                id: 'mascot_1',
                name: 'マスコット1',
                avatar: '🤖',
                profile: 'プロフィール1',
                aiConfig: {
                    chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
                    voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
                },
                assets: { outfits: [], expressions: [], poses: [] }
            },
            {
                id: 'mascot_2',
                name: 'マスコット2',
                avatar: '🐱',
                profile: 'プロフィール2',
                aiConfig: {
                    chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
                    voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
                },
                assets: { outfits: [], expressions: [], poses: [] }
            }
        ];
        configStore.activeMascotId = 'mascot_2';

        const [setupResult, app] = withSetup(() => useSettingsWindow());
        const { mascots, activeMascotId, deleteMascot } = setupResult;

        deleteMascot('mascot_2');

        expect(window.confirm).toHaveBeenCalledWith('マスコット「マスコット2」を削除しますか？');
        expect(mascots.value.length).toBe(1);
        expect(mascots.value[0].id).toBe('mascot_1');
        expect(activeMascotId.value).toBe('mascot_1');

        app.unmount();
    });

    it('deleteMascot - マスコットが1つだけの場合は削除できず、アラートが表示されること', () => {
        const configStore = useConfigStore();
        configStore.mascots = [
            {
                id: 'mascot_1',
                name: 'マスコット1',
                avatar: '🤖',
                profile: 'プロフィール1',
                aiConfig: {
                    chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
                    voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
                },
                assets: { outfits: [], expressions: [], poses: [] }
            }
        ];
        configStore.activeMascotId = 'mascot_1';

        const [setupResult, app] = withSetup(() => useSettingsWindow());
        const { mascots, deleteMascot } = setupResult;

        deleteMascot('mascot_1');

        expect(window.alert).toHaveBeenCalledWith('最後の1つのマスコットは削除できません。');
        expect(mascots.value.length).toBe(1);

        app.unmount();
    });

    it('saveSettings - 保存処理時に isSaving が true になり、configStore.saveConfig が呼び出されること', async () => {
        const configStore = useConfigStore();
        const saveConfigSpy = vi.spyOn(configStore, 'saveConfig').mockResolvedValue(undefined);

        const [setupResult, app] = withSetup(() => useSettingsWindow());
        const { isSaving, saveStatus, saveSettings } = setupResult;

        const savePromise = saveSettings();

        expect(isSaving.value).toBe(true);
        expect(saveStatus.value).toBe('保存中...');
        
        await savePromise;

        expect(saveConfigSpy).toHaveBeenCalled();

        app.unmount();
    });

    describe('goBack', () => {
        beforeEach(() => {
            vi.stubGlobal('close', vi.fn());
            vi.spyOn(window.history, 'back').mockImplementation(() => {});
        });

        it('goBack - Electron環境で設定画面にいる場合、window.closeが呼び出されること', () => {
            (window as any).electronAPI = {
                ...window.electronAPI,
                isWeb: false
            };
            window.location.hash = '#settings';

            const [setupResult, app] = withSetup(() => useSettingsWindow());
            setupResult.goBack();

            expect(window.close).toHaveBeenCalled();
            app.unmount();
        });

        it('goBack - Web環境で履歴がある場合、history.backが呼び出されること', () => {
            (window as any).electronAPI = {
                ...window.electronAPI,
                isWeb: true
            };
            window.location.hash = '#settings';

            vi.spyOn(window.history, 'length', 'get').mockReturnValue(2);

            const [setupResult, app] = withSetup(() => useSettingsWindow());
            setupResult.goBack();

            expect(window.history.back).toHaveBeenCalled();
            expect(window.close).not.toHaveBeenCalled();
            app.unmount();
        });

        it('goBack - Web環境で履歴がない場合、ハッシュが #integrated になること', () => {
            (window as any).electronAPI = {
                ...window.electronAPI,
                isWeb: true
            };
            window.location.hash = '#settings';

            vi.spyOn(window.history, 'length', 'get').mockReturnValue(1);

            const [setupResult, app] = withSetup(() => useSettingsWindow());
            setupResult.goBack();

            expect(window.location.hash).toBe('#integrated');
            expect(window.history.back).not.toHaveBeenCalled();
            expect(window.close).not.toHaveBeenCalled();
            app.unmount();
        });
    });
});
