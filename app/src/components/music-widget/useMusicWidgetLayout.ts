import { computed, ref, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useConfigStore } from '../../store/config';
import { useMusicStore } from '../../store/music';

interface MusicWidgetLayoutOptions {
    opacity: Ref<number>;
    playlistExpanded: Ref<boolean>;
    secondaryPanelExpanded?: Ref<boolean>;
    pausePlayback: () => void;
}

/** 画面モード別の配置とElectron分離画面のドラッグ操作を管理する。 */
export function useMusicWidgetLayout(options: MusicWidgetLayoutOptions) {
    const configStore = useConfigStore();
    const musicStore = useMusicStore();
    const { windowMode } = storeToRefs(configStore);
    const showInlineSettings = ref(false);
    let isElectronDragging = false;
    let electronDragX = 0;
    let electronDragY = 0;

    const isStandalone = computed(() => window.location.hash === '#music');
    const isIntegrated = computed(() => !isStandalone.value && windowMode.value === 'integrated');
    const isCompact = computed(() => !isStandalone.value && windowMode.value === 'compact');

    const stopElectronDrag = () => {
        if (!isElectronDragging) return;
        isElectronDragging = false;
        window.electronAPI?.dragWindow?.({ dx: 0, dy: 0, isEnd: true });
        window.removeEventListener('mousemove', handleElectronDrag);
        window.removeEventListener('mouseup', stopElectronDrag);
    };

    const handleElectronDrag = (event: MouseEvent) => {
        if (!isElectronDragging) return;
        if (event.buttons !== 1) {
            stopElectronDrag();
            return;
        }

        const dx = event.screenX - electronDragX;
        const dy = event.screenY - electronDragY;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            window.electronAPI?.dragWindow?.({ dx, dy });
            electronDragX = event.screenX;
            electronDragY = event.screenY;
        }
    };

    const startWidgetDrag = (event: MouseEvent) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('button, input')) return;
        if (!isStandalone.value) return;
        event.preventDefault();
        isElectronDragging = true;
        electronDragX = event.screenX;
        electronDragY = event.screenY;
        window.electronAPI?.dragWindow?.({ dx: 0, dy: 0, isStart: true });
        window.addEventListener('mousemove', handleElectronDrag);
        window.addEventListener('mouseup', stopElectronDrag);
    };

    const widgetStyle = computed(() => {
        const transparentStyle = { opacity: String(options.opacity.value) };
        if (isIntegrated.value) {
            return {
                ...transparentStyle,
                left: '12px',
                right: '12px',
                bottom: '12px',
                top: 'auto',
                width: 'auto',
                height: options.playlistExpanded.value || showInlineSettings.value || options.secondaryPanelExpanded?.value ? '196px' : '76px'
            };
        }
        if (isCompact.value) {
            return { ...transparentStyle, left: '8px', right: '8px', top: '52px', width: 'auto', height: '38px' };
        }
        return { ...transparentStyle, left: '0', top: '0', width: '100%', height: '100%' };
    });

    const toggleMusicSettings = () => {
        showInlineSettings.value = !showInlineSettings.value;
    };

    const closeWidget = () => {
        musicStore.showMusicWidget = false;
        options.pausePlayback();
        if (isStandalone.value) window.electronAPI?.toggleMusic?.();
    };

    const disposeLayout = () => {
        window.removeEventListener('mousemove', handleElectronDrag);
        window.removeEventListener('mouseup', stopElectronDrag);
        stopElectronDrag();
    };

    return {
        isStandalone,
        isIntegrated,
        isCompact,
        showInlineSettings,
        widgetStyle,
        startWidgetDrag,
        toggleMusicSettings,
        closeWidget,
        disposeLayout
    };
}
