import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue';
import { useConfigStore } from '../../../store/config';
import { useTaskStore } from '../../../store/task';
import { useResizableFrame } from '../../../composables/useResizableFrame';

export const useTaskWidgetWindow = (
    taskStore: ReturnType<typeof useTaskStore>,
    configStore: ReturnType<typeof useConfigStore>,
    windowMode: Ref<string>
) => {
    const posX = ref(window.innerWidth - 400);
    const posY = ref(80);
    const width = ref(340);
    const height = ref(480);
    const isLocalDragging = ref(false);

    let localDragStartX = 0;
    let localDragStartY = 0;
    let isElectronDragging = false;
    let electronDragStartX = 0;
    let electronDragStartY = 0;

    const { initResize } = useResizableFrame({
        minWidth: 300,
        minHeight: 350,
        getStartSize: () => ({ width: width.value, height: height.value }),
        onResizeApply: (nextWidth, nextHeight) => {
            width.value = nextWidth;
            height.value = nextHeight;
            if (windowMode.value !== 'integrated' && windowMode.value !== 'compact') {
                window.electronAPI?.resizeWindow?.({ width: nextWidth, height: nextHeight });
            }
        }
    });

    const onLocalMouseMove = (event: MouseEvent) => {
        if (!isLocalDragging.value) return;
        const x = event.clientX - localDragStartX;
        const y = event.clientY - localDragStartY;
        posX.value = Math.max(10, Math.min(window.innerWidth - width.value - 10, x));
        posY.value = Math.max(10, Math.min(window.innerHeight - height.value - 10, y));
    };

    const onLocalMouseUp = () => {
        isLocalDragging.value = false;
        window.removeEventListener('mousemove', onLocalMouseMove);
        window.removeEventListener('mouseup', onLocalMouseUp);
        localStorage.setItem('task_widget_pos_x', posX.value.toString());
        localStorage.setItem('task_widget_pos_y', posY.value.toString());
    };

    const onElectronMouseUp = () => {
        if (!isElectronDragging) return;
        isElectronDragging = false;
        window.removeEventListener('mousemove', onElectronMouseMove);
        window.removeEventListener('mouseup', onElectronMouseUp);
        window.electronAPI?.dragWindow?.({ dx: 0, dy: 0, isEnd: true });
    };

    const onElectronMouseMove = (event: MouseEvent) => {
        if (!isElectronDragging) return;
        if (event.buttons !== 1) {
            onElectronMouseUp();
            return;
        }

        const dx = event.screenX - electronDragStartX;
        const dy = event.screenY - electronDragStartY;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            window.electronAPI?.dragWindow?.({ dx, dy });
            electronDragStartX = event.screenX;
            electronDragStartY = event.screenY;
        }
    };

    const startWidgetDrag = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (
            event.button !== 0 ||
            target.closest('button') ||
            target.closest('input') ||
            target.closest('.category-tabs') ||
            target.closest('.completion-progress') ||
            target.closest('.view-selector') ||
            target.closest('.resize-handle')
        ) return;

        event.preventDefault();
        if (windowMode.value === 'integrated') {
            isLocalDragging.value = true;
            localDragStartX = event.clientX - posX.value;
            localDragStartY = event.clientY - posY.value;
            window.addEventListener('mousemove', onLocalMouseMove);
            window.addEventListener('mouseup', onLocalMouseUp);
        } else if (window.electronAPI?.dragWindow) {
            isElectronDragging = true;
            electronDragStartX = event.screenX;
            electronDragStartY = event.screenY;
            window.electronAPI.dragWindow({ dx: 0, dy: 0, isStart: true });
            window.addEventListener('mousemove', onElectronMouseMove);
            window.addEventListener('mouseup', onElectronMouseUp);
        }
    };

    const closeWidget = () => {
        taskStore.showTaskWidget = false;
        if (windowMode.value !== 'integrated' && windowMode.value !== 'compact') {
            window.electronAPI?.toggleTasks?.();
        }
    };

    const widgetStyle = computed(() => {
        const opacity = configStore.taskOpacity ?? 1;
        if (window.location.hash === '#tasks' || window.location.hash === '#compact') {
            return { width: '100%', height: '100%', opacity };
        }

        return {
            position: 'absolute' as const,
            left: `${posX.value}px`,
            top: `${posY.value}px`,
            width: `${width.value}px`,
            height: `${height.value}px`,
            opacity,
            zIndex: 100
        };
    });

    onMounted(() => {
        const savedX = Number.parseInt(localStorage.getItem('task_widget_pos_x') ?? '', 10);
        const savedY = Number.parseInt(localStorage.getItem('task_widget_pos_y') ?? '', 10);
        posX.value = Number.isNaN(savedX) || savedX < 0 || savedX >= window.innerWidth - 50
            ? window.innerWidth - 400
            : savedX;
        posY.value = Number.isNaN(savedY) || savedY < 0 || savedY >= window.innerHeight - 50
            ? 80
            : savedY;
    });

    onUnmounted(() => {
        onLocalMouseUp();
        onElectronMouseUp();
    });

    return {
        widgetStyle,
        startWidgetDrag,
        initResize,
        closeWidget
    };
};
