// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useResizableFrame } from './useResizableFrame';

describe('useResizableFrame', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createMouseEvent = (type: string, clientX: number, clientY: number): MouseEvent => {
        return new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
    };

    it('initResize right方向のmousemoveでonResizeApplyが幅のみ変更して呼び出されること', () => {
        const getStartSize = vi.fn().mockReturnValue({ width: 300, height: 400 });
        const onResizeApply = vi.fn();
        const { initResize } = useResizableFrame({ getStartSize, onResizeApply, minWidth: 200, minHeight: 200 });

        const startEvent = createMouseEvent('mousedown', 100, 100);
        initResize(startEvent, 'right');

        const moveEvent = createMouseEvent('mousemove', 150, 150);
        window.dispatchEvent(moveEvent);

        expect(onResizeApply).toHaveBeenLastCalledWith(350, 400);
    });

    it('initResize bottom方向のmousemoveでonResizeApplyが高さを変更して呼び出されること', () => {
        const getStartSize = vi.fn().mockReturnValue({ width: 300, height: 400 });
        const onResizeApply = vi.fn();
        const { initResize } = useResizableFrame({ getStartSize, onResizeApply, minWidth: 200, minHeight: 200 });

        const startEvent = createMouseEvent('mousedown', 100, 100);
        initResize(startEvent, 'bottom');

        const moveEvent = createMouseEvent('mousemove', 150, 150);
        window.dispatchEvent(moveEvent);

        expect(onResizeApply).toHaveBeenLastCalledWith(300, 450);
    });

    it('initResize corner方向のmousemoveでonResizeApplyが幅と高さを変更して呼び出されること', () => {
        const getStartSize = vi.fn().mockReturnValue({ width: 300, height: 400 });
        const onResizeApply = vi.fn();
        const { initResize } = useResizableFrame({ getStartSize, onResizeApply, minWidth: 200, minHeight: 200 });

        const startEvent = createMouseEvent('mousedown', 100, 100);
        initResize(startEvent, 'corner');

        const moveEvent = createMouseEvent('mousemove', 150, 150);
        window.dispatchEvent(moveEvent);

        expect(onResizeApply).toHaveBeenLastCalledWith(350, 450);
    });

    it('initResize minWidthおよびminHeightの最小値制限が適用されること', () => {
        const getStartSize = vi.fn().mockReturnValue({ width: 300, height: 400 });
        const onResizeApply = vi.fn();
        const { initResize } = useResizableFrame({ getStartSize, onResizeApply, minWidth: 250, minHeight: 350 });

        const startEvent = createMouseEvent('mousedown', 100, 100);
        initResize(startEvent, 'corner');

        const moveEvent = createMouseEvent('mousemove', -100, -100);
        window.dispatchEvent(moveEvent);

        expect(onResizeApply).toHaveBeenLastCalledWith(250, 350);
    });

    describe.each([
        { targetName: '既定 (window)', listenerTarget: undefined, getTarget: () => window },
        { targetName: '指定 (document)', listenerTarget: document, getTarget: () => document },
        { targetName: '指定 (getter関数)', listenerTarget: () => document, getTarget: () => document }
    ])('listenerTarget: $targetName の動作検証', ({ listenerTarget, getTarget }) => {
        it('mouseup発生後はmousemoveイベントがあってもonResizeApplyが呼び出されないこと (mouseup解除)', () => {
            const getStartSize = vi.fn().mockReturnValue({ width: 300, height: 400 });
            const onResizeApply = vi.fn();
            const { initResize } = useResizableFrame({ getStartSize, onResizeApply, listenerTarget });

            const target = getTarget();
            const startEvent = createMouseEvent('mousedown', 100, 100);
            initResize(startEvent, 'right');

            const moveEvent1 = createMouseEvent('mousemove', 150, 100);
            target.dispatchEvent(moveEvent1);
            expect(onResizeApply).toHaveBeenCalledTimes(1);

            const upEvent = createMouseEvent('mouseup', 150, 100);
            target.dispatchEvent(upEvent);

            const moveEvent2 = createMouseEvent('mousemove', 200, 100);
            target.dispatchEvent(moveEvent2);

            expect(onResizeApply).toHaveBeenCalledTimes(1);
        });

        it('stopResizeの呼び出しでlistenerが解除されること (stop解除)', () => {
            const getStartSize = vi.fn().mockReturnValue({ width: 300, height: 400 });
            const onResizeApply = vi.fn();
            const { initResize, stopResize } = useResizableFrame({ getStartSize, onResizeApply, listenerTarget });

            const target = getTarget();
            const startEvent = createMouseEvent('mousedown', 100, 100);
            initResize(startEvent, 'right');

            stopResize();

            const moveEvent = createMouseEvent('mousemove', 150, 100);
            target.dispatchEvent(moveEvent);

            expect(onResizeApply).not.toHaveBeenCalled();
        });

        it('コンポーネントのunmountでcleanupされてlistenerが解除されること (unmount解除)', () => {
            const onResizeApply = vi.fn();

            let initResizeFn: any;
            const TestComponent = defineComponent({
                setup() {
                    const { initResize } = useResizableFrame({
                        getStartSize: () => ({ width: 300, height: 400 }),
                        onResizeApply,
                        listenerTarget
                    });
                    initResizeFn = initResize;
                    return () => null;
                }
            });

            const wrapper = mount(TestComponent);

            const target = getTarget();
            const startEvent = createMouseEvent('mousedown', 100, 100);
            initResizeFn(startEvent, 'right');

            wrapper.unmount();

            const moveEvent = createMouseEvent('mousemove', 150, 100);
            target.dispatchEvent(moveEvent);

            expect(onResizeApply).not.toHaveBeenCalled();
        });
    });
});
