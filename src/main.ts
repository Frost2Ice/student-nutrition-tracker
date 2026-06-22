import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import './journeys.css';
import AppShell from './AppShell.vue';

createApp(AppShell).use(createPinia()).mount('#app');
