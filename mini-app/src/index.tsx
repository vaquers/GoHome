import '@telegram-apps/telegram-ui/dist/styles.css';

import ReactDOM from 'react-dom/client';
import { StrictMode } from 'react';
import { retrieveLaunchParams } from '@tma.js/sdk-react';

import { Root } from '@/components/Root.tsx';
import { EnvUnsupported } from '@/components/EnvUnsupported.tsx';
import { init } from '@/init.ts';

import './index.css';

if (import.meta.env.DEV) {
  await import('./mockEnv.ts');
}

// Build fingerprint — always log, never strip
const BUILD_INFO = {
  commit: typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'dev',
  builtAt: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString(),
  env: import.meta.env.MODE,
  source: 'vercel',
};
(window as any).__APP_BUILD_INFO__ = BUILD_INFO;
console.info('%c[BUILD]', 'color:#0ff;font-weight:bold', BUILD_INFO);

const root = ReactDOM.createRoot(document.getElementById('root')!);

function renderApp() {
  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

function renderFallback() {
  root.render(<EnvUnsupported />);
}

root.render(
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#08080F',
    color: 'rgba(255, 255, 255, 0.35)',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  }}>
    Loading…
  </div>,
);

(async () => {
  try {
    const launchParams = retrieveLaunchParams();
    const { tgWebAppPlatform: platform } = launchParams;
    const debug = (launchParams.tgWebAppStartParam || '').includes('debug')
      || import.meta.env.DEV;

    const initPromise = init({
      debug,
      eruda: debug && ['ios', 'android'].includes(platform),
      mockForMacOS: platform === 'macos',
    });

    const timeoutMs = 5000;
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Init timeout')), timeoutMs);
    });

    await Promise.race([initPromise, timeoutPromise]);
    renderApp();
  } catch (e) {
    console.warn('Init failed, rendering app anyway:', e);
    try {
      renderApp();
    } catch {
      renderFallback();
    }
  }
})();
