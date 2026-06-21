// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import ChatPanel from '../ChatPanel.vue';

describe('ChatPanel.vue - カスタムリサイズテスト', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        
        // window.electronAPI のモック
        window.electronAPI = {
            resizeChatWindow: vi.fn(),
            getAppConfig: vi.fn().mockResolvedValue({ chatWidth: 350, chatHeight: 400 }),
            onConfigUpdated: vi.fn().mockReturnValue(() => {}),
            onChatToggled: vi.fn().mockReturnValue(() => {}),
            onEmotionChanged: vi.fn().mockReturnValue(() => {}),
        } as any;
    });

    it('右端のハンドルをドラッグした際、メインプロセスへ正しい新規サイズが送信されること', async () => {
        const wrapper = mount(ChatPanel);
        
        // リサイズハンドルを取得
        const rightHandle = wrapper.find('.resize-handle.right');
        expect(rightHandle.exists()).toBe(true);

        // window.innerWidth / innerHeight のモック
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(350);
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(400);

        // 1. ドラッグ開始 (mousedown)
        await rightHandle.trigger('mousedown', {
            clientX: 100,
            clientY: 100,
            button: 0,
            preventDefault: () => {},
            stopPropagation: () => {},
        });

        // 2. ドラッグ移動 (mousemove)
        const moveEvent = new MouseEvent('mousemove', {
            clientX: 150,
            clientY: 100,
        });
        document.dispatchEvent(moveEvent);

        // resizeChatWindow が { width: 400, height: 400 } で呼ばれたことを確認
        expect(window.electronAPI!.resizeChatWindow).toHaveBeenCalledWith({
            width: 400,
            height: 400
        });

        // 3. ドラッグ終了 (mouseup)
        const upEvent = new MouseEvent('mouseup');
        document.dispatchEvent(upEvent);
    });
});
