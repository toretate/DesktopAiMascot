import { computed, ref } from 'vue';
import { useTaskStore, type Task } from '../../../store/task';

export interface TaskEditForm {
    title: string;
    memo: string;
    categoryId: string;
    scheduledAt: Date | null;
    durationHours: number;
    scheduledEndAt: Date | null;
    endMode: 'duration' | 'datetime';
}

export const useTaskEditor = (taskStore: ReturnType<typeof useTaskStore>) => {
    const editingFullTaskId = ref<string | null>(null);
    const editForm = ref<TaskEditForm>({
        title: '',
        memo: '',
        categoryId: '',
        scheduledAt: null,
        durationHours: 1,
        scheduledEndAt: null,
        endMode: 'duration'
    });

    const getDurationHours = (task: Task) => {
        if (!task.scheduledAt || !task.scheduledEndAt) return taskStore.defaultDurationHours;
        const durationMs = new Date(task.scheduledEndAt).getTime() - new Date(task.scheduledAt).getTime();
        return Number.isFinite(durationMs) && durationMs > 0
            ? Math.round((durationMs / 3_600_000) * 100) / 100
            : taskStore.defaultDurationHours;
    };

    const openTaskEditor = (task: Task) => {
        editingFullTaskId.value = task.id;
        editForm.value = {
            title: task.title || '',
            memo: task.memo || '',
            categoryId: task.categoryId || (taskStore.categories[0]?.id ?? ''),
            scheduledAt: task.scheduledAt ? new Date(task.scheduledAt) : null,
            durationHours: getDurationHours(task),
            scheduledEndAt: task.scheduledEndAt ? new Date(task.scheduledEndAt) : null,
            endMode: 'duration'
        };
    };

    const setEditEndMode = (mode: TaskEditForm['endMode']) => {
        editForm.value.endMode = mode;
        if (mode === 'datetime' && !editForm.value.scheduledEndAt && editForm.value.scheduledAt) {
            editForm.value.scheduledEndAt = new Date(
                editForm.value.scheduledAt.getTime() + editForm.value.durationHours * 3_600_000
            );
        }
    };

    const isTaskEditorTimeValid = computed(() => {
        if (editForm.value.endMode !== 'datetime') return true;
        if (!editForm.value.scheduledAt || !editForm.value.scheduledEndAt) return true;
        return editForm.value.scheduledEndAt.getTime() > editForm.value.scheduledAt.getTime();
    });

    const closeTaskEditor = () => {
        editingFullTaskId.value = null;
    };

    const saveTaskEditor = () => {
        if (!editingFullTaskId.value) return;
        const title = editForm.value.title.trim();
        if (!title) return;

        const durationHours = Number.isFinite(editForm.value.durationHours) && editForm.value.durationHours > 0
            ? editForm.value.durationHours
            : taskStore.defaultDurationHours;
        const scheduledEndAt = editForm.value.endMode === 'datetime'
            ? editForm.value.scheduledEndAt
            : editForm.value.scheduledAt
                ? new Date(editForm.value.scheduledAt.getTime() + durationHours * 3_600_000)
                : null;

        taskStore.updateTask(editingFullTaskId.value, {
            title,
            memo: editForm.value.memo,
            categoryId: editForm.value.categoryId,
            scheduledAt: editForm.value.scheduledAt?.toISOString(),
            scheduledEndAt: scheduledEndAt?.toISOString()
        });
        editingFullTaskId.value = null;
    };

    return {
        editingFullTaskId,
        editForm,
        openTaskEditor,
        setEditEndMode,
        isTaskEditorTimeValid,
        closeTaskEditor,
        saveTaskEditor
    };
};
