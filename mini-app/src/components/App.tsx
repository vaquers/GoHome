import { lazy, Suspense } from 'react';
import {
  Navigate,
  Route,
  Routes,
  HashRouter,
  useNavigate,
} from 'react-router-dom';
import { AppRoot } from '@telegram-apps/telegram-ui';

import { ErrorBoundary } from '@/components/ErrorBoundary';

const GoHomeScreen = lazy(() =>
  import('@/screens/GoHomeScreen').then((m) => ({ default: m.GoHomeScreen })),
);

function ScreenFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      background: 'transparent',
      color: 'rgba(255, 255, 255, 0.3)',
      fontFamily: 'inherit',
    }}>
      Загрузка...
    </div>
  );
}

function RouteErrorFallback({ error, reset }: { error: unknown; reset: () => void }) {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      padding: 24,
      textAlign: 'center',
      gap: 16,
      color: 'rgba(255, 255, 255, 0.85)',
    }}>
      <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Ошибка</p>
      <pre style={{
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.35)',
        maxWidth: '80vw',
        overflow: 'auto',
        margin: 0,
      }}>
        {error instanceof Error ? error.message : String(error)}
      </pre>
      <button
        onClick={() => { reset(); navigate('/'); }}
        style={{
          padding: '10px 24px',
          borderRadius: 999,
          border: 'none',
          background: 'rgba(255, 255, 255, 0.1)',
          color: 'rgba(255, 255, 255, 0.85)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        На главную
      </button>
    </div>
  );
}

function AppContent() {
  return (
    <>
      <div className="app-global-bg" aria-hidden />
      <ErrorBoundary fallback={RouteErrorFallback}>
        <Suspense fallback={<ScreenFallback />}>
          <Routes>
            <Route path="/" element={<GoHomeScreen />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export function App() {
  return (
    <AppRoot
      appearance="dark"
      platform="base"
    >
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AppRoot>
  );
}
