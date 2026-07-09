// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import IntegratedLayout from '../IntegratedLayout.vue';
import { useConfigStore } from '../../../store/config';

// PixiJS のモック
vi.mock('pixi.js', () => {
    return {
        Application: class {
            init() { return Promise.resolve(); }
            stage = { addChild: () => {} };
            destroy() {}
        },
        Container: class {
            addChild() {}
            destroy() {}
        },
        Sprite: class {
            texture = {};
            anchor = { set: () => {} };
        },
        Assets: {
            load: () => Promise.resolve({ width: 100, height: 100 })
        },
        Texture: {
            EMPTY: {}
        }
    };
});

describe('IntegratedLayout.vue - 統合ウィンドウのテスト', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        
        // window.electronAPI のモック
        window.electronAPI = {
            dragWindow: vi.fn(),
            setIgnoreMouseEvents: vi.fn(),
            toggleChat: vi.fn(),
            onTimerTrigger: vi.fn().mockReturnValue(() => {}),
            getAppConfig: vi.fn().mockResolvedValue({ 
                mascotScale: 1.0, 
                windowMode: 'integrated',
                integratedWidth: 1100,
                integratedHeight: 800
            }),
            onApplyPreviewState: vi.fn().mockReturnValue(() => {}),
            onChatToggled: vi.fn().mockReturnValue(() => {}),
            onEmotionChanged: vi.fn().mockReturnValue(() => {}),
            onConfigUpdated: vi.fn().mockReturnValue(() => {}),
        } as any;
    });

    it('統合ウィンドウモードでマスコットをドラッグすると、ウィンドウは移動せずマスコットの比率位置が更新・保存されること', async () => {
        const configStore = useConfigStore();
        configStore.windowMode = 'integrated';
        const saveSpy = vi.spyOn(configStore, 'saveConfig').mockResolvedValue(undefined as any);

        const wrapper = mount(IntegratedLayout);

        // MascotViewerがマウントされ、.mascot-character要素が存在することを確認
        const mascotChar = wrapper.find('.mascot-character');
        expect(mascotChar.exists()).toBe(true);

        // マスコット表示エリアのサイズをモック (1000 x 800)
        const mascotWrapperEl = wrapper.find('.mascot-wrapper').element;
        vi.spyOn(mascotWrapperEl, 'getBoundingClientRect').mockReturnValue({
            left: 0, right: 1000, top: 0, bottom: 800, width: 1000, height: 800, x: 0, y: 0,
            toJSON: () => ({})
        } as DOMRect);

        // 1. ドラッグ開始 (mousedown) -> ウィンドウ移動 IPC は呼ばれない
        await mascotChar.trigger('mousedown', {
            button: 0,
            screenX: 200,
            screenY: 200,
        });
        expect(window.electronAPI!.dragWindow).not.toHaveBeenCalled();

        // 2. ドラッグ移動 (mousemove) -> 比率位置が移動量に応じて更新される
        window.dispatchEvent(new MouseEvent('mousemove', {
            screenX: 230,
            screenY: 215,
            buttons: 1,
        }));

        // X: 0.5 + 30/1000 = 0.53, Y: 0.5 + 15/800 = 0.51875
        expect(configStore.integratedMascotXRatio).toBeCloseTo(0.53);
        expect(configStore.integratedMascotYRatio).toBeCloseTo(0.51875);
        expect(window.electronAPI!.dragWindow).not.toHaveBeenCalled();

        // 3. ドラッグ終了 (mouseup) -> 設定が保存され、チャットのトグルは発生しない
        window.dispatchEvent(new MouseEvent('mouseup'));
        expect(saveSpy).toHaveBeenCalledTimes(1);
        expect(window.electronAPI!.dragWindow).not.toHaveBeenCalled();
        expect(window.electronAPI!.toggleChat).not.toHaveBeenCalled();
    });

    it('統合ウィンドウモードでマスコットをドラッグせずクリックした場合、位置は変わらずチャットのトグルが呼ばれること', async () => {
        const configStore = useConfigStore();
        configStore.windowMode = 'integrated';
        const saveSpy = vi.spyOn(configStore, 'saveConfig').mockResolvedValue(undefined as any);

        const wrapper = mount(IntegratedLayout);
        const mascotChar = wrapper.find('.mascot-character');

        await mascotChar.trigger('mousedown', {
            button: 0,
            screenX: 200,
            screenY: 200,
        });
        window.dispatchEvent(new MouseEvent('mouseup'));

        expect(configStore.integratedMascotXRatio).toBeCloseTo(0.5);
        expect(configStore.integratedMascotYRatio).toBeCloseTo(0.5);
        expect(saveSpy).not.toHaveBeenCalled();
        expect(window.electronAPI!.toggleChat).toHaveBeenCalledTimes(1);
    });

    describe('チャット欄の幅調整スプリッター', () => {
        const mountWithContainerRect = async () => {
            const configStore = useConfigStore();
            configStore.windowMode = 'integrated';
            const saveSpy = vi.spyOn(configStore, 'saveConfig').mockResolvedValue(undefined as any);

            const wrapper = mount(IntegratedLayout);
            const container = wrapper.find('.integrated-container');
            vi.spyOn(container.element, 'getBoundingClientRect').mockReturnValue({
                left: 0, right: 1000, top: 0, bottom: 800, width: 1000, height: 800, x: 0, y: 0,
                toJSON: () => ({})
            } as DOMRect);

            return { configStore, saveSpy, wrapper };
        };

        it('スプリッターをドラッグするとチャット欄の幅比率が更新され、ドラッグ終了時に保存されること', async () => {
            const { configStore, saveSpy, wrapper } = await mountWithContainerRect();

            const splitter = wrapper.find('.section-splitter');
            expect(splitter.exists()).toBe(true);

            await splitter.trigger('pointerdown', { pointerId: 1 });
            window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500 }));

            // ratio = (1000 - 500) / 1000 = 0.5
            expect(configStore.integratedChatRatio).toBeCloseTo(0.5);
            expect(saveSpy).not.toHaveBeenCalled();

            window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
            expect(saveSpy).toHaveBeenCalledTimes(1);
        });

        it('幅比率が 0.2 - 0.8 の範囲にクランプされること', async () => {
            const { configStore, wrapper } = await mountWithContainerRect();
            const splitter = wrapper.find('.section-splitter');

            await splitter.trigger('pointerdown', { pointerId: 1 });
            window.dispatchEvent(new PointerEvent('pointermove', { clientX: 950 }));
            expect(configStore.integratedChatRatio).toBeCloseTo(0.2);

            window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50 }));
            expect(configStore.integratedChatRatio).toBeCloseTo(0.8);

            window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
        });

        it('コンパクトモードではスプリッターが表示されないこと', async () => {
            const configStore = useConfigStore();
            configStore.windowMode = 'compact';

            const wrapper = mount(IntegratedLayout);
            expect(wrapper.find('.section-splitter').exists()).toBe(false);
        });
    });
});
