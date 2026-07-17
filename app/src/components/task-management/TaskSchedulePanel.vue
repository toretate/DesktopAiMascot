<script setup lang="ts">
import { toRef } from 'vue';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import { useTaskStore } from '../../store/task';
import CircularClockPicker from './CircularClockPicker.vue';
import DayTimelinePicker from './DayTimelinePicker.vue';
import type { TaskEditForm } from './composables/useTaskEditor';
import { useTaskScheduleEditor } from './composables/useTaskScheduleEditor';

const props = defineProps<{
    newTaskTitle: string;
    editForm: TaskEditForm;
}>();

const newTaskScheduledAt = defineModel<string | undefined>('newTaskScheduledAt');
const newTaskScheduledEndAt = defineModel<string | undefined>('newTaskScheduledEndAt');
const taskStore = useTaskStore();

const {
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
    clearFullscreenCalendarDate
} = useTaskScheduleEditor(taskStore, {
    newTaskTitle: toRef(props, 'newTaskTitle'),
    newTaskScheduledAt,
    newTaskScheduledEndAt,
    editForm: toRef(props, 'editForm')
});

defineExpose({ openDatePicker });
</script>

<template>
    <div v-if="activeCalendarTaskId" class="fullscreen-calendar-panel">
        <div class="calendar-panel-header">
            <span class="panel-title">{{ getCalendarPanelTitle() }}</span>
            <Button icon="pi pi-times" class="p-button-text p-button-secondary close-btn" @click="activeCalendarTaskId = null" />
        </div>
        <div class="calendar-panel-content">
            <div class="task-title-summary">
                <span class="label">タスク: </span>
                <span class="task-name">{{ getActiveCalendarTaskTitle() }}</span>
            </div>

            <div v-if="calendarStep === 'date'" class="datepicker-container">
                <div v-if="isMeetingSchedulePicker && !showMeetingCustomCalendar" class="meeting-date-options">
                    <button type="button" class="meeting-date-option" :class="{ active: meetingDateChoice === 'today' }" @click="selectMeetingDate('today')">
                        <i class="pi pi-calendar-clock"></i><span>今日</span>
                    </button>
                    <button type="button" class="meeting-date-option" :class="{ active: meetingDateChoice === 'tomorrow' }" @click="selectMeetingDate('tomorrow')">
                        <i class="pi pi-calendar-plus"></i><span>明日</span>
                    </button>
                    <button type="button" class="meeting-date-option" :class="{ active: meetingDateChoice === 'custom' }" @click="selectMeetingDate('custom')">
                        <i class="pi pi-calendar"></i><span>日付指定</span>
                    </button>
                </div>
                <div v-else-if="isMeetingSchedulePicker" class="meeting-custom-date">
                    <button type="button" class="back-to-date-btn" @click="showMeetingCustomCalendar = false">
                        <i class="pi pi-angle-left"></i> 選択肢へ戻る
                    </button>
                    <DatePicker v-model="tempCalendarDate" inline class="calendar-datepicker" @date-select="onDateSelect" />
                </div>
                <DatePicker v-else v-model="tempCalendarDate" inline class="calendar-datepicker" @date-select="onDateSelect" />
            </div>

            <div v-else class="clockpicker-container">
                <CircularClockPicker v-if="isSingleTimePicker" v-model:hour="selectedHour24" v-model:minute="selectedMinuteVal">
                    <template #header-leading>
                        <button class="back-to-date-btn" title="日付選択に戻る" type="button" @click="calendarStep = 'date'">
                            <i class="pi pi-angle-left"></i> 日付
                        </button>
                    </template>
                </CircularClockPicker>
                <DayTimelinePicker v-else v-model:start-minute="timelineStartMinute" v-model:end-minute="timelineEndMinute" :default-duration-minutes="taskStore.defaultDurationHours * 60">
                    <template #header-leading>
                        <button class="back-to-date-btn" title="日付選択に戻る" type="button" @click="calendarStep = 'date'">
                            <i class="pi pi-angle-left"></i> 日付
                        </button>
                    </template>
                </DayTimelinePicker>
            </div>
        </div>
        <div class="calendar-panel-footer">
            <Button label="クリア" class="p-button-outlined p-button-danger p-button-sm mr-auto" @click="clearFullscreenCalendarDate" />
            <Button label="キャンセル" class="p-button-outlined p-button-secondary p-button-sm" @click="activeCalendarTaskId = null" />
            <Button label="決定" class="p-button-primary p-button-sm" @click="saveFullscreenCalendarDate" />
        </div>
    </div>
</template>

<style scoped>
.fullscreen-calendar-panel { position: absolute; inset: 0; background: #fff; z-index: 160; display: flex; flex-direction: column; animation: slide-up 0.2s ease-out; }
.calendar-panel-header, .calendar-panel-footer { display: flex; align-items: center; padding: 10px 16px; }
.calendar-panel-header { justify-content: space-between; border-bottom: 1px solid #f1f5f9; }
.calendar-panel-footer { justify-content: flex-end; gap: 8px; border-top: 1px solid #f1f5f9; background: #f8fafc; }
.panel-title { font-size: 14px; font-weight: 700; color: #1e293b; }
.close-btn { width: 24px; height: 24px; padding: 0; }
.calendar-panel-content { flex: 1; overflow-y: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
.task-title-summary { background: #f8fafc; border-left: 3px solid #3b82f6; padding: 8px 12px; border-radius: 4px; font-size: 12px; line-height: 1.4; flex-shrink: 0; word-break: break-all; white-space: pre-wrap; }
.task-title-summary .label { color: #64748b; font-weight: 600; margin-right: 6px; }
.task-title-summary .task-name { color: #1e293b; font-weight: 500; }
.datepicker-container { display: flex; justify-content: center; align-items: center; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fff; flex-shrink: 0; }
.calendar-datepicker { width: 100%; border: none; }
.clockpicker-container { width: 100%; min-height: 0; display: flex; flex: 1; flex-direction: column; align-items: center; gap: 8px; padding: 4px 0; }
.back-to-date-btn { align-self: center; background: transparent; border: none; color: #64748b; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 4px; }
.meeting-date-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 16px 4px; width: 100%; }
.meeting-date-option { min-height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #475569; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.meeting-date-option:hover, .meeting-date-option.active { border-color: #3b82f6; background: #eff6ff; color: #2563eb; }
.meeting-date-option .pi { font-size: 18px; }
.meeting-custom-date { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.meeting-custom-date .back-to-date-btn { align-self: flex-start; }
:deep(.p-datepicker) { border: none; width: 100%; font-size: 11px; padding: 2px; }
:deep(.p-datepicker-header) { padding: 2px 4px; font-size: 11px; }
:deep(.p-datepicker-calendar th) { padding: 2px; font-size: 9px; }
:deep(.p-datepicker-calendar td) { padding: 1px; }
:deep(.p-datepicker-calendar td > span) { width: 20px; height: 20px; line-height: 20px; font-size: 10px; }
@keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>
