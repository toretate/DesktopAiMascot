import { computed, ref, type Ref } from 'vue';
import { MEETING_CATEGORY_ID, useTaskStore } from '../../../store/task';
import type { TaskEditForm } from './useTaskEditor';

export const EDIT_START_CALENDAR_TARGET = '__edit_start__';
export const EDIT_END_CALENDAR_TARGET = '__edit_end__';

interface TaskScheduleEditorOptions {
    newTaskTitle: Ref<string>;
    newTaskScheduledAt: Ref<string | undefined>;
    newTaskScheduledEndAt: Ref<string | undefined>;
    editForm: Ref<TaskEditForm>;
}

export const useTaskScheduleEditor = (
    taskStore: ReturnType<typeof useTaskStore>,
    options: TaskScheduleEditorOptions
) => {
    const activeCalendarTaskId = ref<string | null>(null);
    const tempCalendarDate = ref<Date | null>(null);
    const calendarStep = ref<'date' | 'time'>('date');
    const selectedHour24 = ref(12);
    const selectedMinuteVal = ref(0);
    const timelineStartMinute = ref(12 * 60);
    const timelineEndMinute = ref(13 * 60);
    const meetingDateChoice = ref<'today' | 'tomorrow' | 'custom'>('today');
    const showMeetingCustomCalendar = ref(false);

    const isSingleTimePicker = computed(() => {
        return activeCalendarTaskId.value === EDIT_START_CALENDAR_TARGET ||
            activeCalendarTaskId.value === EDIT_END_CALENDAR_TARGET;
    });

    const isMeetingSchedulePicker = computed(() => {
        if (!activeCalendarTaskId.value) return false;
        if (activeCalendarTaskId.value === 'new_task') {
            return taskStore.activeCategoryId === MEETING_CATEGORY_ID;
        }
        if (isSingleTimePicker.value) return false;
        return taskStore.tasks.find(task => task.id === activeCalendarTaskId.value)?.categoryId === MEETING_CATEGORY_ID;
    });

    const initializeTimelineRange = (start: Date, endIso?: string) => {
        const stepMinutes = 15;
        const rawStartMinute = start.getHours() * 60 + start.getMinutes();
        timelineStartMinute.value = Math.min(
            24 * 60 - stepMinutes,
            Math.round(rawStartMinute / stepMinutes) * stepMinutes
        );

        const end = endIso ? new Date(endIso) : null;
        const storedDurationMinutes = end ? (end.getTime() - start.getTime()) / 60_000 : Number.NaN;
        const durationMinutes = Number.isFinite(storedDurationMinutes) && storedDurationMinutes > 0
            ? storedDurationMinutes
            : taskStore.defaultDurationHours * 60;
        timelineEndMinute.value = Math.min(
            24 * 60,
            timelineStartMinute.value + Math.max(
                stepMinutes,
                Math.round(durationMinutes / stepMinutes) * stepMinutes
            )
        );
    };

    const getMeetingDateChoice = (date: Date) => {
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
        const tomorrowKey = `${tomorrow.getFullYear()}-${tomorrow.getMonth()}-${tomorrow.getDate()}`;
        if (dateKey === todayKey) return 'today';
        if (dateKey === tomorrowKey) return 'tomorrow';
        return 'custom';
    };

    const openDatePicker = (taskId: string | 'new_task') => {
        activeCalendarTaskId.value = taskId;
        calendarStep.value = 'date';
        showMeetingCustomCalendar.value = false;

        let scheduledAt: string | undefined;
        let scheduledEndAt: string | undefined;
        if (taskId === 'new_task') {
            scheduledAt = options.newTaskScheduledAt.value;
            scheduledEndAt = options.newTaskScheduledEndAt.value;
        } else if (taskId === EDIT_START_CALENDAR_TARGET) {
            scheduledAt = options.editForm.value.scheduledAt?.toISOString();
        } else if (taskId === EDIT_END_CALENDAR_TARGET) {
            scheduledAt = options.editForm.value.scheduledEndAt?.toISOString();
        } else {
            const task = taskStore.tasks.find(item => item.id === taskId);
            scheduledAt = task?.scheduledAt;
            scheduledEndAt = task?.scheduledEndAt;
        }

        const date = scheduledAt ? new Date(scheduledAt) : new Date();
        if (!scheduledAt) {
            date.setMinutes(date.getMinutes() >= 30 ? 30 : 0, 0, 0);
        }
        tempCalendarDate.value = date;
        selectedHour24.value = date.getHours();
        selectedMinuteVal.value = date.getMinutes();
        initializeTimelineRange(date, scheduledEndAt);
        meetingDateChoice.value = scheduledAt ? getMeetingDateChoice(date) : 'today';
    };

    const onDateSelect = () => {
        calendarStep.value = 'time';
    };

    const selectMeetingDate = (choice: 'today' | 'tomorrow' | 'custom') => {
        meetingDateChoice.value = choice;
        if (choice === 'custom') {
            showMeetingCustomCalendar.value = true;
            return;
        }

        const selected = new Date();
        if (choice === 'tomorrow') selected.setDate(selected.getDate() + 1);
        selected.setHours(selectedHour24.value, selectedMinuteVal.value, 0, 0);
        tempCalendarDate.value = selected;
        onDateSelect();
    };

    const getActiveCalendarTaskTitle = () => {
        if (!activeCalendarTaskId.value) return '';
        if (activeCalendarTaskId.value === 'new_task') {
            return options.newTaskTitle.value.trim() || '新規タスク';
        }
        if (isSingleTimePicker.value) return options.editForm.value.title.trim() || '編集中のタスク';
        return taskStore.tasks.find(task => task.id === activeCalendarTaskId.value)?.title ?? '';
    };

    const getCalendarPanelTitle = () => {
        if (activeCalendarTaskId.value === EDIT_START_CALENDAR_TARGET) return '開始日時の設定';
        if (activeCalendarTaskId.value === EDIT_END_CALENDAR_TARGET) return '終了日時の設定';
        return '予定日時の設定';
    };

    const saveFullscreenCalendarDate = () => {
        if (!activeCalendarTaskId.value || !tempCalendarDate.value) {
            activeCalendarTaskId.value = null;
            return;
        }

        const targetDate = new Date(tempCalendarDate.value);
        if (isSingleTimePicker.value) {
            targetDate.setHours(selectedHour24.value, selectedMinuteVal.value, 0, 0);
        } else {
            targetDate.setHours(0, timelineStartMinute.value, 0, 0);
        }

        if (activeCalendarTaskId.value === EDIT_START_CALENDAR_TARGET) {
            options.editForm.value.scheduledAt = targetDate;
        } else if (activeCalendarTaskId.value === EDIT_END_CALENDAR_TARGET) {
            options.editForm.value.scheduledEndAt = targetDate;
        } else {
            const targetEndDate = new Date(tempCalendarDate.value);
            targetEndDate.setHours(0, timelineEndMinute.value, 0, 0);
            if (activeCalendarTaskId.value === 'new_task') {
                options.newTaskScheduledAt.value = targetDate.toISOString();
                options.newTaskScheduledEndAt.value = targetEndDate.toISOString();
            } else {
                taskStore.updateTask(activeCalendarTaskId.value, {
                    scheduledAt: targetDate.toISOString(),
                    scheduledEndAt: targetEndDate.toISOString()
                });
            }
        }
        activeCalendarTaskId.value = null;
    };

    const clearFullscreenCalendarDate = () => {
        if (activeCalendarTaskId.value === 'new_task') {
            options.newTaskScheduledAt.value = undefined;
            options.newTaskScheduledEndAt.value = undefined;
        } else if (activeCalendarTaskId.value === EDIT_START_CALENDAR_TARGET) {
            options.editForm.value.scheduledAt = null;
        } else if (activeCalendarTaskId.value === EDIT_END_CALENDAR_TARGET) {
            options.editForm.value.scheduledEndAt = null;
        } else if (activeCalendarTaskId.value) {
            taskStore.updateTask(activeCalendarTaskId.value, {
                scheduledAt: undefined,
                scheduledEndAt: undefined
            });
        }
        activeCalendarTaskId.value = null;
    };

    return {
        activeCalendarTaskId,
        tempCalendarDate,
        calendarStep,
        selectedHour24,
        selectedMinuteVal,
        timelineStartMinute,
        timelineEndMinute,
        meetingDateChoice,
        showMeetingCustomCalendar,
        isSingleTimePicker,
        isMeetingSchedulePicker,
        openDatePicker,
        onDateSelect,
        selectMeetingDate,
        getActiveCalendarTaskTitle,
        getCalendarPanelTitle,
        saveFullscreenCalendarDate,
        clearFullscreenCalendarDate,
        EDIT_START_CALENDAR_TARGET,
        EDIT_END_CALENDAR_TARGET
    };
};
