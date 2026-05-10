import {
  setDebug,
  themeParams,
  initData,
  viewport,
  init as initSDK,
  mockTelegramEnv,
  retrieveLaunchParams,
  emitEvent,
  miniApp,
  backButton,
} from '@tma.js/sdk-react';

export async function init(options: {
  debug: boolean;
  eruda: boolean;
  mockForMacOS: boolean;
}): Promise<void> {
  setDebug(options.debug);
  initSDK();

  if (options.eruda) {
    import('eruda').then(({ default: eruda }) => {
      eruda.init();
      eruda.position({ x: window.innerWidth - 50, y: 0 });
    }).catch(() => {});
  }

  if (options.mockForMacOS) {
    let firstThemeSent = false;
    mockTelegramEnv({
      onEvent(event, next) {
        if (event.name === 'web_app_request_theme') {
          let tp: any = {};
          if (firstThemeSent) {
            tp = themeParams.state();
          } else {
            firstThemeSent = true;
            tp ||= retrieveLaunchParams().tgWebAppThemeParams;
          }
          return emitEvent('theme_changed', { theme_params: tp });
        }

        if (event.name === 'web_app_request_safe_area') {
          return emitEvent('safe_area_changed', { left: 0, top: 0, right: 0, bottom: 0 });
        }

        if (event.name === 'web_app_request_content_safe_area') {
          return emitEvent('content_safe_area_changed', { left: 0, top: 0, right: 0, bottom: 0 });
        }

        next();
      },
    });
  }

  try { backButton.mount.ifAvailable(); } catch {}
  try { initData.restore(); } catch {}

  if (miniApp.mount.isAvailable()) {
    try {
      themeParams.mount();
      miniApp.mount();
      themeParams.bindCssVars();
    } catch {}
  }

  if (viewport.mount.isAvailable()) {
    try {
      await viewport.mount();
      viewport.bindCssVars();
      // Expand the app to fill the full viewport
      if (!viewport.isExpanded()) {
        viewport.expand();
      }
    } catch {}
  }

  // Disable vertical swipes / pull-to-refresh on Telegram WebApp so
  // in-app scroll containers can scroll without the host intercepting.
  try {
    const tg = (window as any).Telegram?.WebApp;
    tg?.disableVerticalSwipes?.();
    tg?.expand?.();
  } catch {}
}
