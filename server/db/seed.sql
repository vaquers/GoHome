-- Seed data for Mister Lyceum 2026

-- Create the 2026 event only if no events exist yet
INSERT INTO events (year, title, is_active, voting_enabled, interviews_enabled, tapbar_enabled)
SELECT 2026, 'Мистер лицей 2026', TRUE, FALSE, FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM events WHERE year = 2026);

-- Default app texts
INSERT INTO app_texts (event_id, key, value) VALUES
    (1, 'main_title',       'Мистер лицея'),
    (1, 'subtitle',         '2026'),
    (1, 'vote_button_text', 'Голосовать'),
    (1, 'results_title',    'Результаты голосования'),
    (1, 'auth_title',       'Представьтесь, пожалуйста'),
    (1, 'auth_subtitle',    'Перед голосованием введите свои данные'),
    (1, 'guest_label',      'Войти как гость'),
    (1, 'voting_closed',    'Голосование ещё не открыто'),
    (1, 'thank_you_title',  'Спасибо за голос!'),
    (1, 'thank_you_text',   'Ваш голос учтён.')
ON CONFLICT (event_id, key) DO NOTHING;
