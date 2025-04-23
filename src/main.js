import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './assets/main.css';

// Create pinia store
const pinia = createPinia();

// Create and mount the Vue application
const app = createApp(App);

app.use(pinia);
app.use(router);

// Mount the app
app.mount('#app');
