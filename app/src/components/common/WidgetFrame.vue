<script setup lang="ts">
import type { ResizeDirection } from '../../composables/useResizableFrame';

defineProps<{
    tag?: string;
    showHandles?: boolean;
}>();

const emit = defineEmits<{
    (e: 'init-resize', event: MouseEvent, direction: ResizeDirection): void;
}>();
</script>

<template>
    <component :is="tag || 'div'">
        <slot></slot>

        <template v-if="showHandles">
            <div class="resize-handle right" @mousedown="emit('init-resize', $event, 'right')"></div>
            <div class="resize-handle bottom" @mousedown="emit('init-resize', $event, 'bottom')"></div>
            <div class="resize-handle corner" @mousedown="emit('init-resize', $event, 'corner')"></div>
        </template>
    </component>
</template>

<style scoped>
.resize-handle {
    position: absolute;
    background: transparent;
    z-index: 9999;
    -webkit-app-region: no-drag;
}
.resize-handle.right {
    top: 0;
    right: 0;
    width: 6px;
    height: calc(100% - 10px);
    cursor: e-resize;
}
.resize-handle.bottom {
    bottom: 0;
    left: 0;
    width: calc(100% - 10px);
    height: 6px;
    cursor: s-resize;
}
.resize-handle.corner {
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    cursor: se-resize;
}
</style>
