import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import App from './App.vue';

// グローバルスタイルの読み込み
import './styles/main.css';

const app = createApp(App);

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
