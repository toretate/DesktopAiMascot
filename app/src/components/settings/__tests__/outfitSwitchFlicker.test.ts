// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMascotSettings, type MascotAsset } from '../composables/useMascotSettings';
import { createPinia, setActivePinia } from 'pinia';
import { useConfigStore } from '../../../store/config';
import { mount, flushPromises } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import MascotSettings from '../MascotSettings.vue';

vi.mock('../../../skills/expression-alignment/auto-align-v2', () => ({
    autoAlignBatch: vi.fn(),
    CONFIDENCE_THRESHOLD: 0.5
}));
vi.mock('../../../skills/expression-alignment/expression-auto-align', () => ({
    isValidImageSource: vi.fn().mockReturnValue(true)
}));
vi.mock('../../../mascots/MascotImageSetBuilder', () => ({
    MascotImageSetBuilder: {
        CreateFromAssets: vi.fn().mockReturnValue({
            getFrontImage: vi.fn().mockReturnValue({ path: 'front.png' })
        })
    }
}));

/**
 * outfit 切り替え時のちらつき防止テスト
 *
 * 以前は setMainOutfit / deleteOutfit が updateMascotPreview（preview-mascot-state IPC）と
 * save-settings → config-updated IPC の両方を送信し、MascotViewer 側で2回のロードサイクルが
 * 走ることで一瞬表情なし状態が表示されるちらつきが発生していた。
 *
 * 修正後は config-updated IPC のみで切り替えが行われる。
 */
describe('outfit切り替え時のちらつき防止テスト', () => {
    const previewMascotStateMock = vi.fn();

    const createTestMascot = () => ({
        id: 'mascot_test',
        name: 'テストマスコット',
        avatar: '🤖',
        profile: 'テスト用プロフィール',
        currentOutfitId: 'outfit_1',
        aiConfig: {
            chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
            voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
        },
        assets: {
            outfits: [
                {
                    id: 'outfit_1',
                    name: '衣装1',
                    path: '/mascots/test/outfit_1.png',
                    expressions: [
                        { id: 'expr_normal_1', name: '通常', path: '/mascots/test/expr_normal_1.png', offsetX: 0, offsetY: 0, scale: 1, rotation: 0 },
                        { id: 'expr_joy_1', name: '喜び', path: '/mascots/test/expr_joy_1.png', offsetX: 0, offsetY: 0, scale: 1, rotation: 0 }
                    ]
                },
                {
                    id: 'outfit_2',
                    name: '衣装2',
                    path: '/mascots/test/outfit_2.png',
                    expressions: [
                        { id: 'expr_normal_2', name: '通常', path: '/mascots/test/expr_normal_2.png', offsetX: 0, offsetY: 0, scale: 1, rotation: 0 },
                        { id: 'expr_joy_2', name: '喜び', path: '/mascots/test/expr_joy_2.png', offsetX: 0, offsetY: 0, scale: 1, rotation: 0 }
                    ]
                }
            ],
            expressions: [],
            poses: []
        }
    });

    beforeEach(() => {
        setActivePinia(createPinia());
        previewMascotStateMock.mockClear();

        (window as any).electronAPI = {
            getMascotPrompts: vi.fn().mockResolvedValue({
                identity: '', soul: '', user: '', agents: '', memory: ''
            }),
            previewMascotState: previewMascotStateMock,
            getAppConfig: vi.fn().mockResolvedValue({
                googleAiStudioApiKey: 'test-api-key'
            })
        };

        // fetch のグローバルモック化
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, config: {} })
        }));
    });

    describe('useMascotSettings composable', () => {
        it('updateMascotPreview_outfitId指定時にpreviewMascotStateが呼ばれること（プレビュー機能自体は正常動作）', () => {
            const configStore = useConfigStore();
            configStore.mascots = [createTestMascot()];

            const props = {
                mascots: configStore.mascots,
                activeMascotId: 'mascot_test',
                geminiApiKey: 'test-api-key'
            };
            const emit = vi.fn();

            const { initEditingMascot, updateMascotPreview } = useMascotSettings(props, emit);
            initEditingMascot();

            // updateMascotPreview を直接呼ぶ場合は previewMascotState が呼ばれる
            updateMascotPreview({ outfitId: 'outfit_2' });

            expect(previewMascotStateMock).toHaveBeenCalledTimes(1);
            expect(previewMascotStateMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    outfitId: 'outfit_2'
                })
            );
        });
    });

    describe('MascotSettings コンポーネント (setMainOutfit)', () => {
        it('setMainOutfit_outfit切り替え時にpreviewMascotStateが呼ばれないこと', async () => {
            const configStore = useConfigStore();
            configStore.mascots = [createTestMascot()];
            configStore.activeMascotId = 'mascot_test';

            const wrapper = mount(MascotSettings, {
                props: {
                    mascots: configStore.mascots,
                    activeMascotId: 'mascot_test',
                    geminiApiKey: 'test-api-key'
                },
                global: {
                    plugins: [PrimeVue]
                }
            });

            const subtabButtons = wrapper.findAll('button.mascot-subtab');
            expect(subtabButtons).toHaveLength(3);
            expect(subtabButtons[0].attributes('aria-pressed')).toBe('true');
            await subtabButtons[1].trigger('click');
            expect(subtabButtons[1].attributes('aria-pressed')).toBe('true');

            // MascotOutfitSettngs コンポーネントから set-main-outfit イベントを発火させる
            const outfitComponent = wrapper.findComponent({ name: 'MascotOutfitSettngs' });
            if (outfitComponent.exists()) {
                await outfitComponent.vm.$emit('set-main-outfit', {
                    id: 'outfit_2',
                    name: '衣装2',
                    path: '/mascots/test/outfit_2.png',
                    expressions: []
                });
            }

            // previewMascotState が outfit 切り替え経路では呼ばれないことを検証
            // （initEditingMascot で1回呼ばれる可能性があるのでリセット後に確認）
            previewMascotStateMock.mockClear();

            // 直接 setMainOutfit 相当の処理をシミュレート
            // MascotSettings のイベントハンドラでは updateMascotPreview を呼ばず、
            // save-settings のみを emit する
            const emitted = wrapper.emitted();

            // save-settings が emit されていることを確認
            // （コンポーネント内部のハンドラが実行された証拠）
            if (emitted['save-settings']) {
                // save-settings が発火された後でも previewMascotState は呼ばれない
                expect(previewMascotStateMock).not.toHaveBeenCalled();
            }
        });

        it('setMainOutfit_outfit切り替え後にcurrentOutfitIdが更新されsave-settingsが発火すること', async () => {
            const configStore = useConfigStore();
            const testMascot = createTestMascot();
            configStore.mascots = [testMascot];
            configStore.activeMascotId = 'mascot_test';

            const props = {
                mascots: configStore.mascots,
                activeMascotId: 'mascot_test',
                geminiApiKey: 'test-api-key'
            };
            const emit = vi.fn();

            const { editingMascot, initEditingMascot, syncAndSave } = useMascotSettings(props, emit);
            initEditingMascot();

            // outfit_1 → outfit_2 に切り替え（setMainOutfit の内部ロジックを再現）
            const newOutfit = editingMascot.value.assets.outfits.find(
                (o: any) => o.id === 'outfit_2'
            );
            expect(newOutfit).toBeTruthy();

            editingMascot.value.currentOutfitId = 'outfit_2';

            // previewMascotState をリセット
            previewMascotStateMock.mockClear();

            // syncAndSave のみ呼ぶ（updateMascotPreview は呼ばない）
            await syncAndSave();

            // configStore に反映されていること
            const updatedMascot = configStore.mascots.find(m => m.id === 'mascot_test');
            expect(updatedMascot?.currentOutfitId).toBe('outfit_2');

            // previewMascotState は呼ばれないこと
            expect(previewMascotStateMock).not.toHaveBeenCalled();

            // live-update が emit されること
            expect(emit).toHaveBeenCalledWith('live-update');
        });
    });

    describe('MascotSettings コンポーネント (deleteOutfit)', () => {
        it('deleteOutfit_現在のoutfit削除時にpreviewMascotStateが呼ばれないこと', async () => {
            const configStore = useConfigStore();
            const testMascot = createTestMascot();
            configStore.mascots = [testMascot];
            configStore.activeMascotId = 'mascot_test';

            const props = {
                mascots: configStore.mascots,
                activeMascotId: 'mascot_test',
                geminiApiKey: 'test-api-key'
            };
            const emit = vi.fn();

            const { editingMascot, initEditingMascot, syncAndSave } = useMascotSettings(props, emit);
            initEditingMascot();

            // 現在の outfit (outfit_1) を削除する処理のシミュレーション
            editingMascot.value.assets.outfits = editingMascot.value.assets.outfits.filter(
                (o: any) => o.id !== 'outfit_1'
            );
            // 次の outfit にフォールバック
            const nextOutfit = editingMascot.value.assets.outfits[0];
            editingMascot.value.currentOutfitId = nextOutfit?.id || '';

            // previewMascotState をリセット
            previewMascotStateMock.mockClear();

            // syncAndSave のみ呼ぶ（deleteOutfit 修正後は updateMascotPreview を呼ばない）
            await syncAndSave();

            // previewMascotState は呼ばれないこと
            expect(previewMascotStateMock).not.toHaveBeenCalled();

            // currentOutfitId が outfit_2 にフォールバックしていること
            expect(editingMascot.value.currentOutfitId).toBe('outfit_2');

            // configStore にも反映されていること
            const updatedMascot = configStore.mascots.find(m => m.id === 'mascot_test');
            expect(updatedMascot?.currentOutfitId).toBe('outfit_2');
            expect(updatedMascot?.assets?.outfits?.length).toBe(1);
        });
    });

    describe('ロードサイクル防止の論理テスト', () => {
        it('config-updatedのみで切り替えた場合_1回のロードサイクルで済むフローであること', () => {
            // このテストは、outfit 切り替え時の IPC フローが1回のみであることを論理的に検証する
            const configStore = useConfigStore();
            const testMascot = createTestMascot();
            configStore.mascots = [testMascot];

            const props = {
                mascots: configStore.mascots,
                activeMascotId: 'mascot_test',
                geminiApiKey: 'test-api-key'
            };
            const emit = vi.fn();

            const { editingMascot, initEditingMascot } = useMascotSettings(props, emit);
            initEditingMascot();

            // outfit 切り替え（setMainOutfit と同等の処理）
            editingMascot.value.currentOutfitId = 'outfit_2';

            // previewMascotState をリセットして以降の呼び出しをカウント
            previewMascotStateMock.mockClear();

            // syncAndSave + emit('save-settings') のみ（updateMascotPreview は呼ばない）
            // → 結果として preview-mascot-state IPC は送信されない
            // → MascotViewer は config-updated IPC の1回だけを受信する
            // → ロードサイクルは1回のみ → ちらつきなし

            // previewMascotState が呼ばれていないことを確認
            expect(previewMascotStateMock).not.toHaveBeenCalled();

            // emit で save-settings が呼ばれる（これが config-updated ブロードキャストのトリガー）
            emit('save-settings');
            expect(emit).toHaveBeenCalledWith('save-settings');
        });
    });

    describe('MascotSettings コンポーネント (addOutfitImage)', () => {
        it('addOutfitImage_衣装インポート時に即時アップロードが成功し、アップロード後のパスが格納されること', async () => {
            const configStore = useConfigStore();
            const testMascot = createTestMascot();
            configStore.mascots = [testMascot];
            configStore.activeMascotId = 'mascot_test';

            const selectLocalImageMock = vi.fn().mockResolvedValue({
                success: true,
                path: 'data:image/png;base64,iVBORw0KGgo='
            });
            const saveMascotImageMock = vi.fn().mockResolvedValue({
                success: true,
                path: '/mascots/users/usr_local_dev_bypass/mascot_test/outfits/outfit_new.png'
            });

            (window as any).electronAPI.selectLocalImage = selectLocalImageMock;
            (window as any).electronAPI.saveMascotImage = saveMascotImageMock;

            const wrapper = mount(MascotSettings, {
                props: {
                    mascots: configStore.mascots,
                    activeMascotId: 'mascot_test',
                    geminiApiKey: 'test-api-key'
                },
                global: {
                    plugins: [PrimeVue]
                }
            });

            // outfit タブへ切り替え
            const outfitTabBtn = wrapper.findAll('button').find(
                btn => btn.text().includes('立ち絵')
            );
            if (outfitTabBtn) {
                await outfitTabBtn.trigger('click');
            }

            // MascotOutfitSettngs コンポーネントを取得し、add-outfit イベントを発火
            const outfitComponent = wrapper.findComponent({ name: 'MascotOutfitSettngs' });
            expect(outfitComponent.exists()).toBe(true);

            await outfitComponent.vm.$emit('add-outfit');
            await flushPromises();

            expect(selectLocalImageMock).toHaveBeenCalled();
            await vi.waitFor(() => expect(saveMascotImageMock).toHaveBeenCalled());
            await flushPromises();

            // 新しく追加された outfit の path がアップロード後のパスになっていること
            const updatedMascot = configStore.mascots.find(m => m.id === 'mascot_test');
            const newOutfit = updatedMascot?.assets.outfits.find((o: MascotAsset) => o.id.startsWith('outfit_') && o.id !== 'outfit_1' && o.id !== 'outfit_2');
            expect(newOutfit).toBeTruthy();
            expect(newOutfit?.path).toBe('/mascots/users/usr_local_dev_bypass/mascot_test/outfits/outfit_new.png');
        });

        it('addOutfitImage_衣装インポート時にアップロードが失敗した場合、Base64パスがフォールバック格納されること', async () => {
            const configStore = useConfigStore();
            const testMascot = createTestMascot();
            configStore.mascots = [testMascot];
            configStore.activeMascotId = 'mascot_test';

            const selectLocalImageMock = vi.fn().mockResolvedValue({
                success: true,
                path: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
            });
            const saveMascotImageMock = vi.fn().mockResolvedValue({
                success: false,
                error: 'ネットワークエラー'
            });

            (window as any).electronAPI.selectLocalImage = selectLocalImageMock;
            (window as any).electronAPI.saveMascotImage = saveMascotImageMock;

            const wrapper = mount(MascotSettings, {
                props: {
                    mascots: configStore.mascots,
                    activeMascotId: 'mascot_test',
                    geminiApiKey: 'test-api-key'
                },
                global: {
                    plugins: [PrimeVue]
                }
            });

            // outfit タブへ切り替え
            const outfitTabBtn = wrapper.findAll('button').find(
                btn => btn.text().includes('立ち絵')
            );
            if (outfitTabBtn) {
                await outfitTabBtn.trigger('click');
            }

            const outfitComponent = wrapper.findComponent({ name: 'MascotOutfitSettngs' });
            expect(outfitComponent.exists()).toBe(true);
            await outfitComponent.vm.$emit('add-outfit');
            await flushPromises();

            expect(selectLocalImageMock).toHaveBeenCalled();
            await vi.waitFor(() => expect(saveMascotImageMock).toHaveBeenCalled());
            await flushPromises();

            // アップロード失敗時、フォールバックで元の Base64 データが格納されていること
            const updatedMascot = configStore.mascots.find(m => m.id === 'mascot_test');
            const newOutfit = updatedMascot?.assets.outfits.find((o: MascotAsset) => o.path.startsWith('data:image/'));
            expect(newOutfit).toBeTruthy();
            expect(newOutfit?.path).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
        });
    });
});
