import { render } from 'preact';

// Шрифты самохостятся: без запросов к сторонним CDN — быстрее на слабом Wi-Fi.
import '@fontsource-variable/oswald/wght.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/noto-sans-arabic/arabic-400.css';
import '@fontsource/noto-sans-arabic/arabic-700.css';

import './styles/tokens.css';
import './styles/app.css';

import { App } from './app/App';
import { applySettings } from './core/settings';

applySettings();

const root = document.getElementById('app');
if (root) render(<App />, root);
