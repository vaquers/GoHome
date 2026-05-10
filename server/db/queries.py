"""Database queries for the Mister voting app."""
from .connection import fetch_all, fetch_one, execute, execute_returning


# ── Events ────────────────────────────────────────────────────────

def get_active_event():
    return fetch_one("SELECT id, year, title, is_active, voting_enabled, interviews_enabled, tapbar_enabled, results_visible, contest_type, accent_color, classes FROM events WHERE is_active = TRUE LIMIT 1")

def get_event(event_id):
    return fetch_one("SELECT id, year, title, is_active, voting_enabled, interviews_enabled, tapbar_enabled, results_visible, contest_type, accent_color, classes FROM events WHERE id = %s", (event_id,))

def get_all_events():
    return fetch_all("SELECT id, year, title, is_active, voting_enabled, interviews_enabled, tapbar_enabled, results_visible, contest_type, accent_color, classes FROM events ORDER BY year DESC")

def create_event(year, title):
    return execute_returning("INSERT INTO events (year, title) VALUES (%s, %s) RETURNING id", (year, title))

def update_event_field(event_id, field, value):
    allowed = {"year", "title", "is_active", "voting_enabled", "interviews_enabled", "tapbar_enabled", "results_visible", "contest_type", "accent_color", "classes"}
    if field not in allowed:
        return
    execute(f"UPDATE events SET {field} = %s, updated_at = NOW() WHERE id = %s", (value, event_id))

def set_active_event(event_id):
    execute("UPDATE events SET is_active = FALSE WHERE is_active = TRUE")
    execute("UPDATE events SET is_active = TRUE, updated_at = NOW() WHERE id = %s", (event_id,))


# ── Contestants ───────────────────────────────────────────────────

def get_contestants(event_id):
    return fetch_all(
        "SELECT id, name, surname, display_name, profile, description, photo_url, sort_order, is_active "
        "FROM contestants WHERE event_id = %s AND is_active = TRUE ORDER BY sort_order",
        (event_id,)
    )

def get_all_contestants(event_id):
    return fetch_all(
        "SELECT id, name, surname, display_name, profile, description, photo_url, sort_order, is_active "
        "FROM contestants WHERE event_id = %s ORDER BY sort_order",
        (event_id,)
    )

def get_contestant(contestant_id):
    return fetch_one(
        "SELECT id, event_id, name, surname, display_name, profile, description, photo_url, sort_order, is_active "
        "FROM contestants WHERE id = %s",
        (contestant_id,)
    )

def add_contestant(event_id, name, surname, display_name, profile, description="", photo_url="", sort_order=0):
    return execute_returning(
        "INSERT INTO contestants (event_id, name, surname, display_name, profile, description, photo_url, sort_order) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (event_id, name, surname, display_name, profile, description, photo_url, sort_order)
    )

def update_contestant_field(contestant_id, field, value):
    allowed = {"name", "surname", "display_name", "profile", "description", "photo_url", "sort_order", "is_active"}
    if field not in allowed:
        return
    execute(f"UPDATE contestants SET {field} = %s, updated_at = NOW() WHERE id = %s", (value, contestant_id))

def delete_contestant(contestant_id):
    execute("DELETE FROM contestants WHERE id = %s", (contestant_id,))


# ── App Texts ─────────────────────────────────────────────────────

def get_app_texts(event_id):
    return fetch_all("SELECT key, value FROM app_texts WHERE event_id = %s ORDER BY key", (event_id,))

def get_app_text(event_id, key):
    return fetch_one("SELECT value FROM app_texts WHERE event_id = %s AND key = %s", (event_id, key))

def set_app_text(event_id, key, value):
    execute(
        "INSERT INTO app_texts (event_id, key, value) VALUES (%s, %s, %s) "
        "ON CONFLICT (event_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
        (event_id, key, value)
    )

def delete_app_text(event_id, key):
    execute("DELETE FROM app_texts WHERE event_id = %s AND key = %s", (event_id, key))


DEFAULT_TEXTS = {
    "main_title": "Голосование",
    "subtitle": "",
    "vote_button_text": "Голосовать",
    "results_title": "Результаты",
    "auth_title": "Представьтесь, пожалуйста",
    "auth_subtitle": "Перед голосованием введите свои данные",
    "guest_label": "Войти как гость",
    "voting_closed": "Голосование ещё не открыто",
    "thank_you_title": "Спасибо за голос!",
    "thank_you_text": "Ваш голос учтён.",
}


def seed_default_texts(event_id):
    for key, value in DEFAULT_TEXTS.items():
        execute(
            "INSERT INTO app_texts (event_id, key, value) VALUES (%s, %s, %s) "
            "ON CONFLICT (event_id, key) DO NOTHING",
            (event_id, key, value)
        )


# ── Voters ────────────────────────────────────────────────────────

def find_voter(event_id, first_name, last_name, profile, is_guest):
    if is_guest:
        return None
    return fetch_one(
        "SELECT id, access_allowed FROM voters WHERE event_id = %s AND LOWER(first_name) = LOWER(%s) AND LOWER(last_name) = LOWER(%s)",
        (event_id, first_name, last_name)
    )

def create_voter(event_id, first_name, last_name, profile, is_guest, access_allowed=True):
    return execute_returning(
        "INSERT INTO voters (event_id, first_name, last_name, profile, is_guest, access_allowed) "
        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (event_id, first_name, last_name, profile, is_guest, access_allowed)
    )

def get_voter(voter_id):
    return fetch_one(
        "SELECT id, event_id, first_name, last_name, profile, is_guest, access_allowed FROM voters WHERE id = %s",
        (voter_id,)
    )

def get_all_voters(event_id):
    return fetch_all(
        "SELECT v.id, v.first_name, v.last_name, v.profile, v.is_guest, v.access_allowed, "
        "EXISTS(SELECT 1 FROM votes vt WHERE vt.voter_id = v.id AND vt.event_id = v.event_id) as has_voted "
        "FROM voters v WHERE v.event_id = %s ORDER BY v.created_at DESC",
        (event_id,)
    )

def update_voter_access(voter_id, access_allowed):
    execute("UPDATE voters SET access_allowed = %s, updated_at = NOW() WHERE id = %s", (access_allowed, voter_id))

def delete_voter(voter_id):
    execute("DELETE FROM voters WHERE id = %s", (voter_id,))

def add_voter_with_access(event_id, first_name, last_name, profile):
    return execute_returning(
        "INSERT INTO voters (event_id, first_name, last_name, profile, is_guest, access_allowed) "
        "VALUES (%s, %s, %s, %s, FALSE, TRUE) RETURNING id",
        (event_id, first_name, last_name, profile)
    )


# ── Votes ─────────────────────────────────────────────────────────

def has_voted(event_id, voter_id):
    row = fetch_one("SELECT id FROM votes WHERE event_id = %s AND voter_id = %s", (event_id, voter_id))
    return row is not None

def cast_vote(event_id, voter_id, contestant_id):
    return execute_returning(
        "INSERT INTO votes (event_id, voter_id, contestant_id) VALUES (%s, %s, %s) RETURNING id",
        (event_id, voter_id, contestant_id)
    )

def get_results(event_id):
    return fetch_all(
        "SELECT c.id, c.display_name, c.photo_url, COUNT(v.id) as vote_count "
        "FROM contestants c "
        "LEFT JOIN votes v ON v.contestant_id = c.id AND v.event_id = c.event_id "
        "WHERE c.event_id = %s AND c.is_active = TRUE "
        "GROUP BY c.id, c.display_name, c.photo_url, c.sort_order "
        "ORDER BY c.sort_order",
        (event_id,)
    )

def get_total_votes(event_id):
    row = fetch_one("SELECT COUNT(*) FROM votes WHERE event_id = %s", (event_id,))
    return row[0] if row else 0

def get_voted_voters(event_id):
    return fetch_all(
        "SELECT v.first_name, v.last_name, v.profile, v.is_guest, c.display_name, vt.created_at "
        "FROM votes vt "
        "JOIN voters v ON v.id = vt.voter_id "
        "JOIN contestants c ON c.id = vt.contestant_id "
        "WHERE vt.event_id = %s ORDER BY vt.created_at DESC",
        (event_id,)
    )


# ── Members ────────────────────���─────────────────────────────────

def is_results_admin(tg_id: int) -> bool:
    row = fetch_one("SELECT 1 FROM results_admins WHERE tg_id = %s", (tg_id,))
    return row is not None

def add_results_admin(tg_id: int):
    execute("INSERT INTO results_admins (tg_id) VALUES (%s) ON CONFLICT DO NOTHING", (tg_id,))

def remove_results_admin(tg_id: int):
    execute("DELETE FROM results_admins WHERE tg_id = %s", (tg_id,))

def get_results_admins():
    return fetch_all("SELECT tg_id FROM results_admins")


def get_all_members():
    return fetch_all("SELECT id, last_name, first_name, middle_name, full_name FROM members ORDER BY last_name, first_name")


def get_members_count():
    row = fetch_one("SELECT COUNT(*) FROM members")
    return row[0] if row else 0


# ── Raffle ────────��──────────────────────────────────────────────

def get_active_raffle(event_id):
    return fetch_one(
        "SELECT id, event_id, is_active, winner_row, winner_seat FROM raffle "
        "WHERE event_id = %s AND is_active = TRUE ORDER BY id DESC LIMIT 1",
        (event_id,)
    )


def create_raffle(event_id):
    return execute_returning(
        "INSERT INTO raffle (event_id, is_active) VALUES (%s, TRUE) RETURNING id",
        (event_id,)
    )


def set_raffle_winner(raffle_id, row, seat):
    execute(
        "UPDATE raffle SET winner_row = %s, winner_seat = %s WHERE id = %s",
        (row, seat, raffle_id)
    )


def stop_raffle(event_id):
    execute(
        "UPDATE raffle SET is_active = FALSE WHERE event_id = %s AND is_active = TRUE",
        (event_id,)
    )
