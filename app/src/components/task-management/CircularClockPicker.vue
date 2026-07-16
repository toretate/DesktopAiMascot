<script setup lang="ts">
import { onUnmounted, ref } from 'vue';

type ClockMode = 'hour' | 'minute';

const hour = defineModel<number>('hour', { required: true });
const minute = defineModel<number>('minute', { required: true });

const clockMode = ref<ClockMode>('hour');
const isDragging = ref(false);
const dialRef = ref<HTMLElement | null>(null);

const innerHourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const outerHourNumbers = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const minuteNumbers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const getClockHandStyle = () => {
    let angle = 0;
    let length = 66;

    if (clockMode.value === 'hour') {
        const selectedHour = hour.value;
        const isInner = selectedHour >= 1 && selectedHour <= 12;
        length = isInner ? 42 : 66;
        angle = (selectedHour % 12) * 30;
    } else {
        angle = minute.value * 6;
    }

    return {
        transform: `rotate(${angle}deg)`,
        height: `${length}px`,
        transition: isDragging.value
            ? 'none'
            : 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), height 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
    };
};

const getClockNumberStyle = (index: number, isInner = false) => {
    const angle = (index * 30 - 90) * (Math.PI / 180);
    const radius = isInner ? 42 : 66;
    const x = Math.round(Math.cos(angle) * radius);
    const y = Math.round(Math.sin(angle) * radius);

    return {
        transform: `translate(${x}px, ${y}px)`
    };
};

const getPointerPosition = (event: MouseEvent | TouchEvent) => {
    if ('touches' in event) {
        const touch = event.touches[0];
        return touch ? { x: touch.clientX, y: touch.clientY } : null;
    }

    return { x: event.clientX, y: event.clientY };
};

const handleClockMove = (event: MouseEvent | TouchEvent) => {
    if (!isDragging.value || !dialRef.value) return;

    const pointer = getPointerPosition(event);
    if (!pointer) return;

    const rect = dialRef.value.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = pointer.x - centerX;
    const deltaY = pointer.y - centerY;

    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    if (clockMode.value === 'hour') {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const isInner = distance < 54;
        let hourIndex = Math.round(angle / 30);
        if (hourIndex === 12) hourIndex = 0;

        hour.value = isInner
            ? (hourIndex === 0 ? 12 : hourIndex)
            : (hourIndex === 0 ? 0 : hourIndex + 12);
    } else {
        let selectedMinute = Math.round(angle / 6);
        if (selectedMinute === 60) selectedMinute = 0;
        minute.value = Math.min(selectedMinute, 59);
    }

    if (event.cancelable) event.preventDefault();
};

const removeDragListeners = () => {
    window.removeEventListener('mousemove', handleClockMove);
    window.removeEventListener('mouseup', handleClockEnd);
    window.removeEventListener('touchmove', handleClockMove);
    window.removeEventListener('touchend', handleClockEnd);
};

const handleClockEnd = () => {
    if (!isDragging.value) return;

    isDragging.value = false;
    removeDragListeners();

    if (clockMode.value === 'hour') clockMode.value = 'minute';
};

const handleClockStart = (event: MouseEvent | TouchEvent) => {
    isDragging.value = true;
    handleClockMove(event);
    window.addEventListener('mousemove', handleClockMove);
    window.addEventListener('mouseup', handleClockEnd);
    window.addEventListener('touchmove', handleClockMove, { passive: false });
    window.addEventListener('touchend', handleClockEnd);
};

onUnmounted(removeDragListeners);
</script>

<template>
    <div class="circular-clock-picker">
        <div class="clockpicker-header">
            <div class="clockpicker-header-leading">
                <slot name="header-leading" />
            </div>
            <div class="digital-time-display" aria-label="選択時刻">
                <button
                    class="time-part"
                    :class="{ active: clockMode === 'hour' }"
                    type="button"
                    @click="clockMode = 'hour'"
                >
                    {{ String(hour).padStart(2, '0') }}
                </button>
                <span class="colon">:</span>
                <button
                    class="time-part"
                    :class="{ active: clockMode === 'minute' }"
                    type="button"
                    @click="clockMode = 'minute'"
                >
                    {{ String(minute).padStart(2, '0') }}
                </button>
            </div>
        </div>

        <div class="clock-face-wrapper">
            <div
                ref="dialRef"
                class="clock-dial"
                @mousedown="handleClockStart"
                @touchstart.prevent="handleClockStart"
            >
                <div class="clock-center-dot"></div>
                <div class="clock-hand-line" :style="getClockHandStyle()">
                    <div class="clock-hand-pointer"></div>
                </div>

                <template v-if="clockMode === 'hour'">
                    <span
                        v-for="(hourNumber, index) in innerHourNumbers"
                        :key="`hour-inner-${hourNumber}`"
                        class="clock-num-btn inner"
                        :class="{ active: hour === hourNumber }"
                        :style="getClockNumberStyle(index, true)"
                    >
                        {{ hourNumber }}
                    </span>
                    <span
                        v-for="(hourNumber, index) in outerHourNumbers"
                        :key="`hour-outer-${hourNumber}`"
                        class="clock-num-btn outer"
                        :class="{ active: hour === hourNumber }"
                        :style="getClockNumberStyle(index)"
                    >
                        {{ hourNumber }}
                    </span>
                </template>
                <template v-else>
                    <span
                        v-for="(minuteNumber, index) in minuteNumbers"
                        :key="`minute-${minuteNumber}`"
                        class="clock-num-btn"
                        :class="{ active: minute === minuteNumber }"
                        :style="getClockNumberStyle(index)"
                    >
                        {{ String(minuteNumber).padStart(2, '0') }}
                    </span>
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped>
.circular-clock-picker {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.clockpicker-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    padding: 0 4px;
}

.clockpicker-header-leading {
    min-width: 0;
}

.digital-time-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 6px;
    background: #f1f5f9;
    color: #334155;
    font-size: 16px;
    font-weight: 700;
}

.time-part {
    padding: 0 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
}

.time-part.active {
    color: #3b82f6;
    background: #eff6ff;
}

.colon {
    color: #94a3b8;
    animation: blink-colon 1.5s infinite;
}

@keyframes blink-colon {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

.clock-face-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.clock-dial {
    position: relative;
    width: 170px;
    height: 170px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e2e8f0;
    border-radius: 50%;
    background: #f8fafc;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
    cursor: pointer;
    user-select: none;
    touch-action: none;
}

.clock-center-dot {
    position: absolute;
    z-index: 10;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
}

.clock-hand-line {
    position: absolute;
    bottom: 50%;
    left: calc(50% - 1px);
    z-index: 5;
    width: 2px;
    height: 64px;
    background: #3b82f6;
    transform-origin: bottom center;
}

.clock-hand-pointer {
    position: absolute;
    top: -12px;
    left: -11px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #3b82f6;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.18);
}

.clock-hand-pointer::after {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
    content: '';
}

.clock-num-btn {
    position: absolute;
    top: calc(50% - 12px);
    left: calc(50% - 12px);
    z-index: 8;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: #334155;
    font-size: 10px;
    font-weight: 600;
    pointer-events: none;
}

.clock-num-btn.inner {
    color: #64748b;
    font-size: 8px;
}

.clock-num-btn.active {
    color: #ffffff;
    background: #3b82f6;
}
</style>
