import { defineNitroPlugin } from 'nitropack/runtime';
import { getRuntimePathConfig } from '../utils/paths';

export default defineNitroPlugin(() => {
    console.info('[ServerPaths] 起動時パス設定:', getRuntimePathConfig());
});
