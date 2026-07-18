// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useTaskWidgetWindow } from '../task-management/composables/useTaskWidgetWindow';
import { useTaskStore } from '../../store/task';
import { useConfigStore } from '../../store/config';
import MemoWidget from '../MemoWidget.vue';

describe('Widget Resize IPC Behavior', () => {
    let mockResizeWindow: ReturnType<typeof vi.fn>;
    let mockResizeChatWindow: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(createPinia());

        mockResizeWindow = vi.fn();
        mockResizeChatWindow = vi.fn();

        (window as any).electronAPI = {
            resizeWindow: mockResizeWindow,
            resizeChatWindow: mockResizeChatWindow
        };
    });

    describe('Task (useTaskWidgetWindow)', () => {
        it('standaloneモードの場合、resizeWindow IPCが呼び出され、ローカルstyleが更新されること', () => {
            let result: any;
            const windowMode = ref('standalone');
            const TestComponent = defineComponent({
                setup() {
                    const taskStore = useTaskStore();
                    const configStore = useConfigStore();
                    result = useTaskWidgetWindow(taskStore, configStore, windowMode);
                    return () => null;
                }
            });

            const wrapper = mount(TestComponent);

            const mousedownEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
            result.initResize(mousedownEvent, 'right');

            const mousemoveEvent = new MouseEvent('mousemove', { clientX: 150, clientY: 100 });
            window.dispatchEvent(mousemoveEvent);

            expect(mockResizeWindow).toHaveBeenCalledWith({ width: 390, height: 480 });
            expect(result.widgetStyle.value.width).toBe('390px');

            window.dispatchEvent(new MouseEvent('mouseup'));
            wrapper.unmount();
        });

        it.each(['integrated', 'compact'] as const)(
            '%sモードの場合、resizeWindow IPCは呼び出されず、ローカルstyleのみ更新されること',
            (mode) => {
                let result: any;
                const windowMode = ref(mode);
                const TestComponent = defineComponent({
                    setup() {
                        const taskStore = useTaskStore();
                        const configStore = useConfigStore();
                        result = useTaskWidgetWindow(taskStore, configStore, windowMode);
                        return () => null;
                    }
                });

                const wrapper = mount(TestComponent);

                const mousedownEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
                result.initResize(mousedownEvent, 'right');

                const mousemoveEvent = new MouseEvent('mousemove', { clientX: 150, clientY: 100 });
                window.dispatchEvent(mousemoveEvent);

                expect(mockResizeWindow).not.toHaveBeenCalled();
                expect(result.widgetStyle.value.width).toBe('390px');

                window.dispatchEvent(new MouseEvent('mouseup'));
                wrapper.unmount();
            }
        );
    });

    describe('Memo (MemoWidget 本体リサイズ検証)', () => {
        it('standaloneモードの場合、右端のハンドルドラッグで resizeWindow IPC が呼び出されること', async () => {
            const configStore = useConfigStore();
            configStore.windowMode = 'standalone' as any;

            const wrapper = mount(MemoWidget, {
                global: {
                    stubs: {
                        Button: true,
                        InputText: true,
                        Textarea: true
                    }
                }
            });

            const handle = wrapper.find('.resize-handle.right');
            expect(handle.exists()).toBe(true);

            await handle.trigger('mousedown', {
                clientX: 100,
                clientY: 100,
                button: 0,
                preventDefault: () => {},
                stopPropagation: () => {}
            });

            window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 100 }));

            expect(mockResizeWindow).toHaveBeenCalledWith({ width: 390, height: 480 });

            window.dispatchEvent(new MouseEvent('mouseup'));
            wrapper.unmount();
        });

        it.each(['integrated', 'compact'] as const)(
            '%sモードの場合、ハンドルドラッグで resizeWindow IPC が呼び出されないこと',
            async (mode) => {
                const configStore = useConfigStore();
                configStore.windowMode = mode as any;

                const wrapper = mount(MemoWidget, {
                    global: {
                        stubs: {
                            Button: true,
                            InputText: true,
                            Textarea: true
                        }
                    }
                });

                const handle = wrapper.find('.resize-handle.right');
                if (handle.exists()) {
                    await handle.trigger('mousedown', {
                        clientX: 100,
                        clientY: 100,
                        button: 0,
                        preventDefault: () => {},
                        stopPropagation: () => {}
                    });

                    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 100 }));

                    expect(mockResizeWindow).not.toHaveBeenCalled();

                    window.dispatchEvent(new MouseEvent('mouseup'));
                } else {
                    expect(mockResizeWindow).not.toHaveBeenCalled();
                }

                wrapper.unmount();
            }
        );
    });
});
