import { ref, watch } from 'vue';
import { useDraggable } from 'vue-draggable-plus';
import { useTaskStore, type Task } from '../../../store/task';

export const useTaskTreeDrag = (taskStore: ReturnType<typeof useTaskStore>) => {
    const localTasks = ref<Task[]>([...taskStore.filteredTasks]);
    const draggedNestTaskId = ref<string | null>(null);
    const draggedSubTask = ref<{ parentId: string; subTaskId: string } | null>(null);
    const dragStartX = ref(0);
    const isNesting = ref(false);
    const parentRef = ref<HTMLElement | null>(null);
    const activeDropTargetTaskId = ref<string | null>(null);

    watch(() => taskStore.filteredTasks, (newTasks) => {
        if (!draggedNestTaskId.value && !draggedSubTask.value) {
            localTasks.value = [...newTasks];
        }
    }, { deep: true });

    const canNest = (targetTask: Task) => {
        if (!draggedNestTaskId.value || targetTask.id === draggedNestTaskId.value) return false;
        const sourceTask = localTasks.value.find(task => task.id === draggedNestTaskId.value);
        return Boolean(sourceTask && (!sourceTask.steps || sourceTask.steps.length === 0));
    };

    const onParentDragOver = (_event: DragEvent, taskId: string) => {
        if (!draggedNestTaskId.value || !isNesting.value) return;
        const targetTask = localTasks.value.find(task => task.id === taskId);
        if (targetTask && canNest(targetTask)) activeDropTargetTaskId.value = taskId;
    };

    useDraggable(parentRef, localTasks, {
        animation: 150,
        handle: '.drag-handle',
        onStart(event) {
            const originalEvent = (event as typeof event & { originalEvent?: MouseEvent }).originalEvent;
            if (originalEvent) dragStartX.value = originalEvent.clientX;
            const task = localTasks.value[event.oldIndex ?? -1];
            draggedNestTaskId.value = task?.id ?? null;
        },
        onMove(_event, originalEvent) {
            if (originalEvent instanceof MouseEvent) {
                const deltaX = originalEvent.clientX - dragStartX.value;
                if (deltaX >= 24) {
                    isNesting.value = true;
                    return false;
                }
            }
            isNesting.value = false;
            activeDropTargetTaskId.value = null;
        },
        onEnd() {
            taskStore.updateTasksOrder(localTasks.value);
            if (isNesting.value && draggedNestTaskId.value && activeDropTargetTaskId.value) {
                taskStore.convertToSubTask(draggedNestTaskId.value, activeDropTargetTaskId.value);
            }
            draggedNestTaskId.value = null;
            dragStartX.value = 0;
            isNesting.value = false;
            activeDropTargetTaskId.value = null;
        }
    });

    const onSortDragStart = (event: DragEvent, taskId: string) => {
        dragStartX.value = event.clientX;
        draggedNestTaskId.value = taskId;
    };

    const promoteDraggedSubTask = () => {
        if (!draggedSubTask.value) return;
        const subTask = draggedSubTask.value;
        draggedSubTask.value = null;
        taskStore.promoteSubTaskToParent(subTask.parentId, subTask.subTaskId);
        localTasks.value = [...taskStore.filteredTasks];
    };

    const onParentDrop = (_event: DragEvent, _targetTaskId: string) => promoteDraggedSubTask();
    const onContainerDrop = (_event: DragEvent) => promoteDraggedSubTask();
    const onSubTaskDragStart = (parentId: string, subTaskId: string) => {
        draggedSubTask.value = { parentId, subTaskId };
    };
    const onSubTaskDragEnd = () => {
        draggedSubTask.value = null;
    };

    return {
        localTasks,
        draggedNestTaskId,
        draggedSubTask,
        isNesting,
        parentRef,
        activeDropTargetTaskId,
        canNest,
        onParentDragOver,
        onSortDragStart,
        onParentDrop,
        onSubTaskDragStart,
        onSubTaskDragEnd,
        onContainerDrop
    };
};
