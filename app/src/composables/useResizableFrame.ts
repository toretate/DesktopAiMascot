import { onUnmounted, getCurrentInstance } from 'vue';

export type ResizeDirection = 'right' | 'bottom' | 'corner';

export type ListenerTargetOption = Window | Document | (() => Window | Document);

export interface ResizableFrameOptions {
    minWidth?: number;
    minHeight?: number;
    onResizeApply: (width: number, height: number) => void;
    getStartSize: () => { width: number; height: number };
    listenerTarget?: ListenerTargetOption;
}

export function useResizableFrame(options: ResizableFrameOptions) {
    let isResizing = false;
    let resizeDirection: ResizeDirection | '' = '';
    let startWidth = 0;
    let startHeight = 0;
    let startMouseX = 0;
    let startMouseY = 0;
    let activeTarget: Window | Document | null = null;

    const minWidth = options.minWidth ?? 300;
    const minHeight = options.minHeight ?? 300;

    const resolveListenerTarget = (): Window | Document => {
        if (!options.listenerTarget) {
            return window;
        }
        if (typeof options.listenerTarget === 'function') {
            return options.listenerTarget();
        }
        return options.listenerTarget;
    };

    const handleResizeMove = (e: MouseEvent) => {
        if (!isResizing) return;
        const dx = e.clientX - startMouseX;
        const dy = e.clientY - startMouseY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        if (resizeDirection === 'right' || resizeDirection === 'corner') {
            newWidth = Math.max(minWidth, startWidth + dx);
        }
        if (resizeDirection === 'bottom' || resizeDirection === 'corner') {
            newHeight = Math.max(minHeight, startHeight + dy);
        }

        options.onResizeApply(newWidth, newHeight);
    };

    const stopResize = () => {
        isResizing = false;
        if (activeTarget) {
            activeTarget.removeEventListener('mousemove', handleResizeMove as EventListener);
            activeTarget.removeEventListener('mouseup', stopResize as EventListener);
            activeTarget = null;
        }
    };

    const initResize = (e: MouseEvent, direction: ResizeDirection) => {
        e.preventDefault();
        e.stopPropagation();
        if (isResizing) {
            stopResize();
        }
        isResizing = true;
        resizeDirection = direction;

        const startSize = options.getStartSize();
        startWidth = startSize.width;
        startHeight = startSize.height;
        startMouseX = e.clientX;
        startMouseY = e.clientY;

        activeTarget = resolveListenerTarget();
        activeTarget.addEventListener('mousemove', handleResizeMove as EventListener);
        activeTarget.addEventListener('mouseup', stopResize as EventListener);
    };

    if (getCurrentInstance()) {
        onUnmounted(() => {
            stopResize();
        });
    }

    return {
        initResize,
        stopResize
    };
}
