import { emitEvent, isTMA, mockTelegramEnv } from '@tma.js/sdk-react';

if (!await isTMA('complete')) {
  const themeParams = {
    accent_text_color: '#6ab2f2',
    bg_color: '#17212b',
    button_color: '#5288c1',
    button_text_color: '#ffffff',
    destructive_text_color: '#ec3942',
    header_bg_color: '#17212b',
    hint_color: '#708499',
    link_color: '#6ab3f3',
    secondary_bg_color: '#232e3c',
    section_bg_color: '#17212b',
    section_header_text_color: '#6ab3f3',
    subtitle_text_color: '#708499',
    text_color: '#f5f5f5',
  } as const;
  const noInsets = { left: 0, top: 0, bottom: 0, right: 0 } as const;

  const BROWSER_USER_ID = 99999;

  mockTelegramEnv({
    onEvent(e) {
      if (e.name === 'web_app_request_theme') {
        return emitEvent('theme_changed', { theme_params: themeParams });
      }
      if (e.name === 'web_app_request_viewport') {
        return emitEvent('viewport_changed', {
          height: window.innerHeight,
          width: window.innerWidth,
          is_expanded: true,
          is_state_stable: true,
        });
      }
      if (e.name === 'web_app_request_content_safe_area') {
        return emitEvent('content_safe_area_changed', noInsets);
      }
      if (e.name === 'web_app_request_safe_area') {
        return emitEvent('safe_area_changed', noInsets);
      }
    },
    launchParams: new URLSearchParams([
      ['tgWebAppThemeParams', JSON.stringify(themeParams)],
      ['tgWebAppData', new URLSearchParams([
        ['auth_date', (new Date().getTime() / 1000 | 0).toString()],
        ['hash', 'some-hash'],
        ['signature', 'some-signature'],
        ['user', JSON.stringify({ id: BROWSER_USER_ID, first_name: 'Browser', last_name: 'User' })],
      ]).toString()],
      ['tgWebAppVersion', '8.4'],
      ['tgWebAppPlatform', 'tdesktop'],
    ]),
  });

  console.info('[Miski] Running outside Telegram — using mocked environment.');
}
