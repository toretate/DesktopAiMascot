<script setup lang="ts">
import Button from 'primevue/button';
import { ref } from 'vue';

const count = ref(0);
</script>

<template>
    <div class="mascot-container drag-area app-dark">
        <div class="mascot-placeholder">
            <div class="mascot-avatar">🤖</div>
            <p class="mascot-text">Desktop AI Mascot</p>
            <!-- no-dragを指定してドラッグ領域から外し、クリックを有効化する -->
            <Button 
                class="no-drag p-button-sm p-button-rounded" 
                icon="pi pi-plus" 
                :label="`Count: ${count}`" 
                @click="count++" 
            />
        </div>
    </div>
</template>

<style scoped>
.mascot-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(18, 18, 18, 0.45); /* 透過デバッグ用の薄い背景 */
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    box-sizing: border-box;
}

.mascot-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    user-select: none;
}

.mascot-avatar {
    font-size: 80px;
    animation: float 3s ease-in-out infinite;
}

.mascot-text {
    font-size: 14px;
    font-weight: 500;
    margin: 12px 0;
    color: rgba(255, 255, 255, 0.9);
}

@keyframes float {
    0%, 100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-10px);
    }
}
</style>
