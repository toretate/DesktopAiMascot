<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

const props = withDefaults(defineProps<{
    defaultDurationMinutes?: number;
    stepMinutes?: number;
}>(), {
    defaultDurationMinutes: 60,
    stepMinutes: 15
});

const startMinute = defineModel<number>('startMinute', { required: true });
const endMinute = defineModel<number>('endMinute', { required: true });

const MINUTES_PER_DAY = 24 * 60;
const HOUR_HEIGHT = 48;
const TIMELINE_HEIGHT = 24 * HOUR_HEIGHT;

const scrollContainerRef = ref<HTMLElement | null>(null);
const timelineRef = ref<HTMLElement | null>(null);
const dragAnchorMinute = ref<number | null>(null);
const didDrag = ref(false);

const hourMarkers = Array.from({ length: 25 }, (_, hour) => ({
    hour,
    minute: hour * 60,
    label: `${String(hour).padStart(2, '0')}:00`
}));

const clampMinute = (value: number) => Math.min(MINUTES_PER_DAY, Math.max(0, value));

const snapMinute = (value: number) => {
    return clampMinute(Math.round(value / props.stepMinutes) * props.stepMinutes);
};

const formatMinute = (value: number) => {
    const normalized = clampMinute(value);
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const selectionStyle = computed(() => ({
    top: `${(startMinute.value / MINUTES_PER_DAY) * TIMELINE_HEIGHT}px`,
    height: `${Math.max(2, ((endMinute.value - startMinute.value) / MINUTES_PER_DAY) * TIMELINE_HEIGHT)}px`
}));

const timeValue = (minute: number) => {
    if (minute >= MINUTES_PER_DAY) return '00:00';
    return formatMinute(minute);
};

const updateMinuteFromTime = (target: 'start' | 'end', value: string) => {
    const [hoursText, minutesText] = value.split(':');
    let parsed = Number(hoursText) * 60 + Number(minutesText);
    if (!Number.isFinite(parsed)) return;

    if (target === 'end' && parsed === 0 && startMinute.value > 0) {
        parsed = MINUTES_PER_DAY;
    }

    const nextMinute = snapMinute(parsed);
    if (target === 'start') {
        startMinute.value = Math.min(nextMinute, MINUTES_PER_DAY - props.stepMinutes);
        if (startMinute.value >= endMinute.value) {
            endMinute.value = Math.min(
                MINUTES_PER_DAY,
                startMinute.value + Math.max(props.stepMinutes, props.defaultDurationMinutes)
            );
        }
    } else {
        endMinute.value = Math.max(nextMinute, startMinute.value + props.stepMinutes);
    }
};

const minuteFromPointer = (event: PointerEvent) => {
    if (!timelineRef.value) return 0;
    const rect = timelineRef.value.getBoundingClientRect();
    return snapMinute(((event.clientY - rect.top) / rect.height) * MINUTES_PER_DAY);
};

const handlePointerMove = (event: PointerEvent) => {
    if (dragAnchorMinute.value === null) return;

    const currentMinute = minuteFromPointer(event);
    if (currentMinute !== dragAnchorMinute.value) didDrag.value = true;

    if (currentMinute >= dragAnchorMinute.value) {
        startMinute.value = dragAnchorMinute.value;
        endMinute.value = Math.min(
            MINUTES_PER_DAY,
            Math.max(currentMinute, dragAnchorMinute.value + props.stepMinutes)
        );
    } else {
        startMinute.value = currentMinute;
        endMinute.value = dragAnchorMinute.value;
    }

    if (event.cancelable) event.preventDefault();
};

const removePointerListeners = () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerEnd);
    window.removeEventListener('pointercancel', handlePointerEnd);
};

const handlePointerEnd = () => {
    if (dragAnchorMinute.value === null) return;

    if (!didDrag.value) {
        startMinute.value = dragAnchorMinute.value;
        endMinute.value = Math.min(
            MINUTES_PER_DAY,
            dragAnchorMinute.value + Math.max(props.stepMinutes, props.defaultDurationMinutes)
        );
    }

    dragAnchorMinute.value = null;
    removePointerListeners();
};

const handlePointerStart = (event: PointerEvent) => {
    if (event.button !== 0) return;

    dragAnchorMinute.value = minuteFromPointer(event);
    didDrag.value = false;
    startMinute.value = dragAnchorMinute.value;
    endMinute.value = Math.min(MINUTES_PER_DAY, dragAnchorMinute.value + props.stepMinutes);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    event.preventDefault();
};

const scrollToSelection = async () => {
    await nextTick();
    if (!scrollContainerRef.value) return;

    const selectionTop = (startMinute.value / MINUTES_PER_DAY) * TIMELINE_HEIGHT;
    scrollContainerRef.value.scrollTop = Math.max(
        0,
        selectionTop - scrollContainerRef.value.clientHeight / 3
    );
};

onMounted(scrollToSelection);
onUnmounted(removePointerListeners);
</script>

<template>
    <div class="day-timeline-picker">
        <div class="timeline-header">
            <slot name="header-leading" />
            <div class="time-range-fields" aria-label="選択時間帯">
                <input
                    :value="timeValue(startMinute)"
                    class="time-input"
                    type="time"
                    :step="stepMinutes * 60"
                    aria-label="開始時刻"
                    @change="updateMinuteFromTime('start', ($event.target as HTMLInputElement).value)"
                />
                <span class="time-separator">〜</span>
                <input
                    :value="timeValue(endMinute)"
                    class="time-input"
                    type="time"
                    :step="stepMinutes * 60"
                    aria-label="終了時刻"
                    @change="updateMinuteFromTime('end', ($event.target as HTMLInputElement).value)"
                />
            </div>
        </div>

        <div ref="scrollContainerRef" class="timeline-scroll">
            <div
                ref="timelineRef"
                class="timeline-surface"
                :style="{ height: `${TIMELINE_HEIGHT}px` }"
                @pointerdown="handlePointerStart"
            >
                <div
                    v-for="marker in hourMarkers"
                    :key="marker.hour"
                    class="hour-marker"
                    :style="{ top: `${(marker.minute / MINUTES_PER_DAY) * TIMELINE_HEIGHT}px` }"
                >
                    <span class="hour-label">{{ marker.label }}</span>
                    <span class="hour-line"></span>
                </div>
                <div class="half-hour-lines" aria-hidden="true"></div>
                <div class="selected-time-range" :style="selectionStyle">
                    <strong>{{ formatMinute(startMinute) }}〜{{ formatMinute(endMinute) }}</strong>
                </div>
            </div>
        </div>
        <p class="timeline-help">ドラッグして時間帯を選択（15分単位）</p>
    </div>
</template>

<style scoped>
.day-timeline-picker {
    width: 100%;
    min-height: 0;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
}

.timeline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 0 4px;
}

.time-range-fields {
    display: flex;
    align-items: center;
    gap: 3px;
}

.time-input {
    width: 74px;
    min-width: 0;
    padding: 3px 4px;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: var(--color-surface-raised);
    color: var(--color-ink);
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
}

.time-input:focus-visible {
    border-color: var(--color-primary);
    outline: 2px solid var(--control-focus-color);
    outline-offset: 2px;
}

.time-separator {
    color: #94a3b8;
    font-size: 10px;
}

.timeline-scroll {
    min-height: 190px;
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: 7px;
    background: var(--color-surface-raised);
    scrollbar-width: thin;
}

.timeline-surface {
    position: relative;
    min-width: 0;
    cursor: crosshair;
    touch-action: none;
    user-select: none;
}

.hour-marker {
    position: absolute;
    right: 0;
    left: 0;
    display: flex;
    align-items: center;
    pointer-events: none;
}

.hour-label {
    width: 42px;
    flex-shrink: 0;
    padding-right: 6px;
    color: #64748b;
    font-size: 9px;
    text-align: right;
    transform: translateY(-50%);
}

.hour-line {
    height: 1px;
    flex: 1;
    background: #dbe3ee;
}

.half-hour-lines {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 42px;
    background: repeating-linear-gradient(
        to bottom,
        transparent 0,
        transparent 23px,
        #eef2f7 23px,
        #eef2f7 24px,
        transparent 24px,
        transparent 48px
    );
    pointer-events: none;
}

.selected-time-range {
    position: absolute;
    right: 6px;
    left: 46px;
    z-index: 2;
    min-height: 2px;
    overflow: hidden;
    border: 1px solid #4f6fd5;
    border-radius: 5px;
    padding: 4px 6px;
    background: rgba(99, 119, 210, 0.82);
    box-shadow: 0 2px 5px rgba(30, 64, 175, 0.18);
    color: #ffffff;
    font-size: 10px;
    line-height: 1.2;
    pointer-events: none;
}

.timeline-help {
    margin: 0;
    color: #94a3b8;
    font-size: 9px;
    text-align: center;
}
</style>
