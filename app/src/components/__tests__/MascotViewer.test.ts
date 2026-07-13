// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import MascotViewer from '../MascotViewer.vue';

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
            scale = { set: () => {} };
            rotation = 0;
        },
        Assets: {
            load: () => Promise.resolve({ width: 100, height: 100 })
        },
        Texture: {
            EMPTY: {}
        }
    };
});

describe('MascotViewer.vue - ドラッグ＆ドロップテスト', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        
        // window.electronAPI のモック
        window.electronAPI = {
            dragWindow: vi.fn(),
            setIgnoreMouseEvents: vi.fn(),
            toggleChat: vi.fn(),
            onTimerTrigger: vi.fn().mockReturnValue(() => {}),
            getAppConfig: vi.fn().mockResolvedValue({ mascotScale: 1.0, windowMode: 'split' }),
            onApplyPreviewState: vi.fn().mockReturnValue(() => {}),
            onChatToggled: vi.fn().mockReturnValue(() => {}),
            onEmotionChanged: vi.fn().mockReturnValue(() => {}),
            onConfigUpdated: vi.fn().mockReturnValue(() => {}),
        } as any;
    });

    it('マスコットキャラクター上でmousedownしてドラッグしたとき、dragWindow IPCイベントが呼ばれること', async () => {
        const wrapper = mount(MascotViewer);

        const mascotChar = wrapper.find('.mascot-character');
        expect(mascotChar.exists()).toBe(true);

        // 1. ドラッグ開始 (mousedown)
        await mascotChar.trigger('mousedown', {
            button: 0,
            screenX: 100,
            screenY: 100,
        });

        expect(window.electronAPI!.dragWindow).toHaveBeenNthCalledWith(1, {
            dx: 0,
            dy: 0,
            isStart: true
        });

        // 2. ドラッグ移動 (mousemove)
        const moveEvent = new MouseEvent('mousemove', {
            screenX: 120,
            screenY: 130,
            buttons: 1, // ドラッグ中であることを示すために必要
        });
        window.dispatchEvent(moveEvent);

        // dragWindow が正しい差分 { dx: 20, dy: 30 } で呼ばれたことを確認
        expect(window.electronAPI!.dragWindow).toHaveBeenNthCalledWith(2, {
            dx: 20,
            dy: 30
        });

        // 3. ドラッグ終了 (mouseup)
        const upEvent = new MouseEvent('mouseup');
        window.dispatchEvent(upEvent);

        expect(window.electronAPI!.dragWindow).toHaveBeenNthCalledWith(3, {
            dx: 0,
            dy: 0,
            isEnd: true
        });
    });
});
