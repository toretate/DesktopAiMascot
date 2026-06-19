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

    it('統合ウィンドウモードでマスコットキャラクターをドラッグした際、dragWindow IPCイベントが正しい順序（isStart -> 座標移動 -> isEnd）で呼ばれること', async () => {
        const configStore = useConfigStore();
        configStore.windowMode = 'integrated';

        const wrapper = mount(IntegratedLayout);

        // MascotViewerがマウントされ、.mascot-character要素が存在することを確認
        const mascotChar = wrapper.find('.mascot-character');
        expect(mascotChar.exists()).toBe(true);

        // 1. ドラッグ開始 (mousedown)
        await mascotChar.trigger('mousedown', {
            button: 0,
            screenX: 200,
            screenY: 200,
        });

        // dragWindow が isStart: true で呼ばれていることを確認
        expect(window.electronAPI!.dragWindow).toHaveBeenNthCalledWith(1, {
            dx: 0,
            dy: 0,
            isStart: true
        });

        // 2. ドラッグ移動 (mousemove)
        const moveEvent = new MouseEvent('mousemove', {
            screenX: 230,
            screenY: 215,
            buttons: 1,
        });
        window.dispatchEvent(moveEvent);

        // dragWindow が移動量 { dx: 30, dy: 15 } で呼ばれていることを確認
        expect(window.electronAPI!.dragWindow).toHaveBeenNthCalledWith(2, {
            dx: 30,
            dy: 15
        });

        // 3. ドラッグ終了 (mouseup)
        const upEvent = new MouseEvent('mouseup');
        window.dispatchEvent(upEvent);

        // dragWindow が isEnd: true で呼ばれていることを確認
        expect(window.electronAPI!.dragWindow).toHaveBeenNthCalledWith(3, {
            dx: 0,
            dy: 0,
            isEnd: true
        });
    });
});
