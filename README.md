# Мистер лицея 2026

Приложение для голосования за приз зрительских симпатий на конкурсе «Мистер лицея».

## Архитектура

```
server/           — Backend (FastAPI) + Telegram-бот (aiogram 3) + PostgreSQL
  app.py          — FastAPI приложение (API endpoints)
  main.py         — Запуск backend-сервера
  config.py       — Конфигурация
  db/
    schema.sql    — SQL-схема базы данных
    seed.sql      — Начальные данные (6 участников + тексты)
    connection.py — Подключение к PostgreSQL
    queries.py    — Все SQL-запросы
  bot/
    main.py       — Запуск Telegram-бота
    handlers/     — Обработчики команд бота
    states/       — FSM-состояния
    keyboards/    — Inline-клавиатуры

mini-app/         — Frontend (React + Vite + TypeScript)
  src/
    api/misterApi.ts    — API-клиент для backend
    screens/MisterVotingScreen.tsx — Главный экран голосования
```

## Требования

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- pnpm (для frontend)

## Настройка

### 1. PostgreSQL

```bash
createdb mister
psql -d mister -f server/db/schema.sql
psql -d mister -f server/db/seed.sql
```

### 2. Переменные окружения

Скопируйте `.env.example` в `.env` и заполните:

```bash
cp .env.example .env
```

Обязательные переменные:
- `BOT_TOKEN` — токен Telegram-бота (получить у @BotFather)
- `SUPER_ADMIN_ID` — ваш Telegram user ID
- `DATABASE_URL` или `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`

### 3. Backend

```bash
cd server
pip install -r requirements.txt
# Загрузить .env:
export $(cat ../.env | xargs)
# Запустить backend:
python -m server.main
```

Backend будет доступен на `http://localhost:8000`.

### 4. Telegram-бот

```bash
export $(cat .env | xargs)
python -m server.bot.main
```

Бот запустится и будет отвечать на `/start`.

### 5. Frontend

```bash
cd mini-app
cp .env.example .env  # если нужно
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
pnpm install
pnpm dev
```

Frontend будет доступен на `http://localhost:5173`.

## API Endpoints

### Публичные

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/config` | Активный конкурс + тексты + настройки |
| GET | `/api/contestants` | Список активных участников |
| POST | `/api/auth-voter` | Авторизация голосующего |
| POST | `/api/vote` | Отправка голоса |
| GET | `/api/results` | Результаты голосования |
| GET | `/api/results/stream` | SSE — realtime результаты |

### POST /api/auth-voter

```json
{
  "first_name": "Иван",
  "last_name": "Петров",
  "profile": "10А",
  "is_guest": false
}
```

Ответ:
```json
{
  "voter_id": 1,
  "access": true,
  "already_voted": false
}
```

### POST /api/vote

```json
{
  "voter_id": 1,
  "contestant_id": 3
}
```

### Админские (для бота)

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/admin/voters` | Список всех голосующих |
| GET | `/api/admin/voted` | Кто за кого проголосовал |

## Telegram-бот

Команды бота (только для админа):

- `/start` — Главное меню

Через inline-кнопки:
- **Конкурсы**: создать, активировать, вкл/выкл голосование/интервью/tapbar
- **Мистеры**: добавить, редактировать все поля, загрузить фото, вкл/выкл, удалить
- **Тексты**: просмотр, редактирование, добавление
- **Голосующие**: список, добавление, импорт списком, кто проголосовал
- **Результаты**: голоса, проценты, общее количество

## Защита от повторного голосования

- UNIQUE constraint на `(event_id, voter_id)` в таблице `votes`
- Проверка на уровне API перед вставкой
- Проверка при авторизации (already_voted)
- Хранение voter_id в localStorage

## Realtime обновление

Результаты обновляются через SSE (Server-Sent Events) на `/api/results/stream`.
Frontend подписывается после голосования и получает обновления каждые 2 секунды.
