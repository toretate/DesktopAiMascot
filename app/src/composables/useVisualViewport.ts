import { onMounted, onUnmounted } from 'vue';

export interface VisualViewportMetrics {
    height: number;
    offsetTop: number;
    keyboardInset: number;
}

export const calculateVisualViewportMetrics = (
    innerHeight: number,
    viewport?: Pick<VisualViewport, 'height' | 'offsetTop'> | null,
): VisualViewportMetrics => {
    const height = viewport?.height ?? innerHeight;
    const offsetTop = viewport?.offsetTop ?? 0;

    return {
        height,
        offsetTop,
        keyboardInset: Math.max(0, innerHeight - height - offsetTop),
    };
};

export const useVisualViewport = (): void => {
    const updateViewportVariables = () => {
        const metrics = calculateVisualViewportMetrics(window.innerHeight, window.visualViewport);
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--visual-viewport-height', `${metrics.height}px`);
        rootStyle.setProperty('--visual-viewport-offset-top', `${metrics.offsetTop}px`);
        rootStyle.setProperty('--software-keyboard-inset', `${metrics.keyboardInset}px`);
    };

    onMounted(() => {
        updateViewportVariables();
        window.addEventListener('resize', updateViewportVariables);
        window.visualViewport?.addEventListener('resize', updateViewportVariables);
        window.visualViewport?.addEventListener('scroll', updateViewportVariables);
    });

    onUnmounted(() => {
        window.removeEventListener('resize', updateViewportVariables);
        window.visualViewport?.removeEventListener('resize', updateViewportVariables);
        window.visualViewport?.removeEventListener('scroll', updateViewportVariables);
    });
};
