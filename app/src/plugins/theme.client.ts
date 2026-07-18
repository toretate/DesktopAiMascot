import { defineNuxtPlugin } from 'nuxt/app';
import { initializeAppTheme } from '@/config/theme';

export default defineNuxtPlugin(() => {
    initializeAppTheme();
});
