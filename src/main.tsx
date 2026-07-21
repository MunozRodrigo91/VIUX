import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import posthog from 'posthog-js';
import App from './App.tsx';
import './index.css';

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (posthogKey) {
  try {
    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
      defaults: '2026-05-30',
    });
  } catch (error) {
    console.error('No se pudo iniciar la analítica:', error);
  }
}
