-- Mister Lyceum Voting App — Database Schema
-- Run: psql -d mister -f schema.sql

CREATE TABLE IF NOT EXISTS events (
    id              SERIAL PRIMARY KEY,
    year            INT NOT NULL UNIQUE,
    title           TEXT NOT NULL DEFAULT '',
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    voting_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    interviews_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    tapbar_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contestants (
    id              SERIAL PRIMARY KEY,
    event_id        INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name            TEXT NOT NULL DEFAULT '',
    surname         TEXT NOT NULL DEFAULT '',
    display_name    TEXT NOT NULL DEFAULT '',
    profile         TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    photo_url       TEXT NOT NULL DEFAULT '',
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, name, surname)
);

CREATE INDEX IF NOT EXISTS idx_contestants_event ON contestants(event_id);

CREATE TABLE IF NOT EXISTS app_texts (
    id              SERIAL PRIMARY KEY,
    event_id        INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    value           TEXT NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, key)
);

CREATE INDEX IF NOT EXISTS idx_app_texts_event ON app_texts(event_id);

CREATE TABLE IF NOT EXISTS voters (
    id              SERIAL PRIMARY KEY,
    event_id        INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    first_name      TEXT NOT NULL DEFAULT '',
    last_name       TEXT NOT NULL DEFAULT '',
    profile         TEXT NOT NULL DEFAULT '',
    is_guest        BOOLEAN NOT NULL DEFAULT FALSE,
    access_allowed  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voters_event ON voters(event_id);
CREATE INDEX IF NOT EXISTS idx_voters_lookup ON voters(event_id, first_name, last_name, profile);

CREATE TABLE IF NOT EXISTS votes (
    id              SERIAL PRIMARY KEY,
    event_id        INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    voter_id        INT NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
    contestant_id   INT NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_event ON votes(event_id);
CREATE INDEX IF NOT EXISTS idx_votes_contestant ON votes(contestant_id);

-- ── Members (imported from CSV for auth verification) ────────────
CREATE TABLE IF NOT EXISTS members (
    id              SERIAL PRIMARY KEY,
    last_name       TEXT NOT NULL DEFAULT '',
    first_name      TEXT NOT NULL DEFAULT '',
    middle_name     TEXT NOT NULL DEFAULT '',
    full_name       TEXT NOT NULL DEFAULT '',
    UNIQUE(last_name, first_name, middle_name)
);

CREATE INDEX IF NOT EXISTS idx_members_name ON members(last_name, first_name);

-- ── Raffle ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raffle (
    id              SERIAL PRIMARY KEY,
    event_id        INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    winner_row      INT,
    winner_seat     INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Results admins (always can see results) ─────────────────────
CREATE TABLE IF NOT EXISTS results_admins (
    tg_id BIGINT PRIMARY KEY
);

-- Migration: add contest_type, accent_color, classes to events
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='contest_type'
    ) THEN
        ALTER TABLE events ADD COLUMN contest_type TEXT NOT NULL DEFAULT 'person';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='accent_color'
    ) THEN
        ALTER TABLE events ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#A855F7';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='classes'
    ) THEN
        ALTER TABLE events ADD COLUMN classes TEXT NOT NULL DEFAULT '[]';
    END IF;
END $$;

-- Migration: add results_visible to events
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='results_visible'
    ) THEN
        ALTER TABLE events ADD COLUMN results_visible BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- Migration: add UNIQUE constraints to existing tables if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contestants_event_id_name_surname_key'
    ) THEN
        BEGIN
            ALTER TABLE contestants ADD CONSTRAINT contestants_event_id_name_surname_key UNIQUE (event_id, name, surname);
        EXCEPTION WHEN duplicate_table THEN NULL;
        END;
    END IF;
END $$;
