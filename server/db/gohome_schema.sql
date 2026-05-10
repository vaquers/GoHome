-- GoHome — Bus schedule tracker schema
-- Run: psql -d gohome -f server/db/gohome_schema.sql

CREATE TABLE IF NOT EXISTS user_routes (
    id              SERIAL PRIMARY KEY,
    tg_id           BIGINT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('minsk', 'home')),
    route_number    TEXT NOT NULL,
    direction       INT NOT NULL DEFAULT 0,
    stop_from_id    TEXT NOT NULL,
    stop_from_name  TEXT NOT NULL DEFAULT '',
    stop_to_id      TEXT NOT NULL,
    stop_to_name    TEXT NOT NULL DEFAULT '',
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tg_id, category, route_number, direction)
);

CREATE INDEX IF NOT EXISTS idx_user_routes_tg ON user_routes(tg_id);
CREATE INDEX IF NOT EXISTS idx_user_routes_tg_cat ON user_routes(tg_id, category);
