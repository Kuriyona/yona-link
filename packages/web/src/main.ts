import { DateInput, Input, Select, StyleProvider, Themes } from '@varlet/ui';
import '@varlet/ui/es/dialog/style/index.mjs';
import '@varlet/ui/es/snackbar/style/index.mjs';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import './styles/base.css';

Input.setPropsDefaults({ variant: 'outlined' });
Select.setPropsDefaults({ variant: 'outlined' });
DateInput.setPropsDefaults({ variant: 'outlined' });

const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  StyleProvider(colorScheme.matches ? Themes.md3Dark : Themes.md3Light);
}

applyTheme();
colorScheme.addEventListener('change', applyTheme);

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount('#app');
