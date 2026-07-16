import { onUnmounted, ref } from 'vue';
import { useTaskStore, type SubTask, type Task } from '../../../store/task';

export const useTaskInlineEdit = (taskStore: ReturnType<typeof useTaskStore>) => {
    const editingTaskId = ref<string | null>(null);
    const editingSubTaskId = ref<string | null>(null);
    const editingTitle = ref('');
    let pressTimer: ReturnType<typeof setTimeout> | null = null;

    const startEditTask = (task: Task) => {
        editingTaskId.value = task.id;
        editingSubTaskId.value = null;
        editingTitle.value = task.title;
    };

    const startEditSubTask = (taskId: string, subTask: SubTask) => {
        editingTaskId.value = taskId;
        editingSubTaskId.value = subTask.id;
        editingTitle.value = subTask.title;
    };

    const handlePressEnd = () => {
        if (!pressTimer) return;
        clearTimeout(pressTimer);
        pressTimer = null;
    };

    const handlePressStart = (
        type: 'task' | 'subtask',
        item: Task | SubTask,
        parentId?: string
    ) => {
        handlePressEnd();
        pressTimer = setTimeout(() => {
            if (type === 'task') {
                startEditTask(item as Task);
            } else if (parentId) {
                startEditSubTask(parentId, item as SubTask);
            }
        }, 700);
    };

    const cancelTitleEdit = () => {
        editingTaskId.value = null;
        editingSubTaskId.value = null;
        editingTitle.value = '';
    };

    const saveTitleEdit = () => {
        if (!editingTaskId.value) return;
        const title = editingTitle.value.trim();
        if (title) {
            if (editingSubTaskId.value) {
                taskStore.updateSubTask(editingTaskId.value, editingSubTaskId.value, { title });
            } else {
                taskStore.updateTask(editingTaskId.value, { title });
            }
        }
        cancelTitleEdit();
    };

    onUnmounted(handlePressEnd);

    return {
        editingTaskId,
        editingSubTaskId,
        editingTitle,
        handlePressStart,
        handlePressEnd,
        startEditTask,
        startEditSubTask,
        saveTitleEdit,
        cancelTitleEdit
    };
};
