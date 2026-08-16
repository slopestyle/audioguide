import { render } from 'preact';

import '@fontsource-variable/oswald/wght.css';
import '@fontsource-variable/inter/wght.css';

import '../styles/tokens.css';
import '../styles/app.css';
import '../styles/admin.css';

import { AdminApp } from './AdminApp';

const root = document.getElementById('admin');
if (root) render(<AdminApp />, root);
