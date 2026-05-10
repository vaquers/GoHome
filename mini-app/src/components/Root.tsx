import { TonConnectUIProvider } from '@tonconnect/ui-react';

import { App } from '@/components/App.tsx';
import { ErrorBoundary } from '@/components/ErrorBoundary.tsx';
import { publicUrl } from '@/helpers/publicUrl.ts';

function ErrorFallback({ error, reset }: { error: unknown; reset: () => void }) {
  const handleReset = () => {
    try {
      // Clear potentially corrupted state
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('miski:')) keysToRemove.push(key);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // localStorage may be unavailable
    }

    // Reset hash to home to avoid re-navigating to a broken route
    if (window.location.hash && window.location.hash !== '#/') {
      window.location.hash = '#/';
    }

    reset();
  };

  return (
    <div style={{
      padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      color: 'rgba(255, 255, 255, 0.85)',
      background: '#08080F',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: 16,
    }}>
      <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Что-то пошло не так</p>
      <pre style={{
        fontSize: 12,
        overflow: 'auto',
        maxWidth: '90vw',
        color: 'rgba(255, 255, 255, 0.4)',
        margin: 0,
      }}>
        {error instanceof Error ? error.message : String(error)}
      </pre>
      <button
        onClick={handleReset}
        style={{
          marginTop: 8,
          padding: '12px 32px',
          borderRadius: 999,
          border: 'none',
          background: 'rgba(255, 255, 255, 0.1)',
          color: 'rgba(255, 255, 255, 0.85)',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Попробовать снова
      </button>
    </div>
  );
}

export function Root() {
  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <ErrorBoundary fallback={<App />}>
        <TonConnectUIProvider
          manifestUrl={publicUrl('tonconnect-manifest.json')}
        >
          <App />
        </TonConnectUIProvider>
      </ErrorBoundary>
    </ErrorBoundary>
  );
}
