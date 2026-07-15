import { createApp } from 'vue';
import './utils/browser-polyfill';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import App from './app.vue';

// グローバルスタイルの読み込み
import './styles/main.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// PrimeVueの初期化とAuraテーマの設定
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            darkModeSelector: '.app-dark', // ダークモード適用クラスの指定
        }
    }
});

app.mount('#app');
