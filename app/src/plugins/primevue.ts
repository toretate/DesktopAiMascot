import { defineNuxtPlugin } from 'nuxt/app';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import { definePreset } from '@primevue/themes';

const AppAura = definePreset(Aura, {
    semantic: {
        primary: {
            50: 'var(--theme-accent-50)',
            100: 'var(--theme-accent-100)',
            200: 'var(--theme-accent-200)',
            300: 'var(--theme-accent-300)',
            400: 'var(--theme-accent-400)',
            500: 'var(--theme-accent-500)',
            600: 'var(--theme-accent-600)',
            700: 'var(--theme-accent-700)',
            800: 'var(--theme-accent-800)',
            900: 'var(--theme-accent-900)',
            950: 'var(--theme-accent-900)',
        },
    },
});

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.use(PrimeVue, {
        theme: {
            preset: AppAura,
            options: {
                darkModeSelector: '.app-dark',
            }
        }
    });
});
