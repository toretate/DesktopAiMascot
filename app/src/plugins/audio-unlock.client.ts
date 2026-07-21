import { defineNuxtPlugin } from 'nuxt/app';
import { setupAudioUnlock } from '../utils/audio-unlock';

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.hook('app:mounted', () => {
        setupAudioUnlock();
    });
});
