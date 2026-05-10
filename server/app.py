"""Mister Lyceum — FastAPI Backend."""
import asyncio
import json
import random
import time
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from fuzzywuzzy import fuzz

from .db import queries
from .config import BOT_TOKEN

app = FastAPI(title="Mister Lyceum API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── SSE state ─────────────────────────────────────────────────────
_vote_version = 0
_raffle_version = 0


def _bump_vote_version():
    global _vote_version
    _vote_version += 1


def _bump_raffle_version():
    global _raffle_version
    _raffle_version += 1


# Hall seating: row -> number of seats
HALL_ROWS = {
    1: 18, 2: 18, 3: 20, 4: 21, 5: 22, 6: 23, 7: 24, 8: 24, 9: 24, 10: 24,
    11: 19, 12: 20, 13: 20, 14: 26, 15: 26, 16: 26, 17: 26, 18: 26,
    19: 26, 20: 26, 21: 26, 22: 26, 23: 26, 24: 26, 25: 20, 26: 20,
}


# ── Helpers ───────────────────────────────────────────────────────

def _get_active_event():
    ev = queries.get_active_event()
    if not ev:
        raise HTTPException(status_code=404, detail="No active event")
    return ev  # (id, year, title, is_active, voting_enabled, interviews_enabled, tapbar_enabled)


def _event_dict(ev):
    return {
        "id": ev[0],
        "year": ev[1],
        "title": ev[2],
        "is_active": ev[3],
        "voting_enabled": ev[4],
        "interviews_enabled": ev[5],
        "tapbar_enabled": ev[6],
        "results_visible": ev[7],
        "contest_type": ev[8] if len(ev) > 8 else "person",
        "accent_color": ev[9] if len(ev) > 9 else "#A855F7",
        "classes": json.loads(ev[10]) if len(ev) > 10 and ev[10] else [],
    }


def _texts_dict(event_id):
    rows = queries.get_app_texts(event_id)
    return {row[0]: row[1] for row in rows}


def _results_payload(event_id):
    rows = queries.get_results(event_id)
    total = queries.get_total_votes(event_id)
    contestants = []
    for r in rows:
        contestants.append({
            "id": r[0],
            "display_name": r[1],
            "photo_url": _resolve_photo_url(r[2]),
            "votes": r[3],
            "percentage": round(r[3] / total * 100, 1) if total > 0 else 0,
        })
    return {"contestants": contestants, "total_votes": total}


# ── Public API ────────────────────────────────────────────────────

@app.get("/api/config")
def api_config():
    ev = _get_active_event()
    return {
        "event": _event_dict(ev),
        "texts": _texts_dict(ev[0]),
    }


def _resolve_photo_url(raw: str) -> str:
    """Convert a Telegram file_id (or URL) to a usable photo URL."""
    if not raw:
        return ""
    if raw.startswith("http://") or raw.startswith("https://") or raw.startswith("/"):
        return raw
    # Treat as Telegram file_id — proxy through our endpoint
    return f"/api/photo/{raw}"


@app.get("/api/contestants")
def api_contestants():
    ev = _get_active_event()
    rows = queries.get_contestants(ev[0])
    return [
        {
            "id": r[0],
            "name": r[1],
            "surname": r[2],
            "display_name": r[3],
            "profile": r[4],
            "description": r[5],
            "photo_url": _resolve_photo_url(r[6]),
            "sort_order": r[7],
        }
        for r in rows
    ]


class AuthVoterRequest(BaseModel):
    first_name: str = ""
    last_name: str = ""
    profile: str = ""
    parallel: str = ""
    is_guest: bool = False


FUZZY_THRESHOLD = 80


def _fuzzy_find_member(first_name: str, last_name: str):
    """Find best matching member using fuzzywuzzy."""
    members = queries.get_all_members()
    if not members:
        return None

    best_score = 0
    best_member = None
    input_name = f"{last_name} {first_name}".lower()

    for m in members:
        # m = (id, last_name, first_name, middle_name, full_name)
        candidate = f"{m[1]} {m[2]}".lower()
        score = fuzz.ratio(input_name, candidate)
        if score > best_score:
            best_score = score
            best_member = m
    if best_score >= FUZZY_THRESHOLD:
        return best_member
    return None


@app.post("/api/auth-voter")
def api_auth_voter(req: AuthVoterRequest):
    ev = _get_active_event()
    event_id = ev[0]

    if req.is_guest:
        row = queries.create_voter(event_id, "Гость", "", "", True, True)
        return {"voter_id": row[0], "access": True, "already_voted": False}

    first_name = req.first_name.strip()
    last_name = req.last_name.strip()
    profile = req.profile.strip()
    parallel = req.parallel.strip()
    full_profile = f"{profile} {parallel}".strip() if parallel else profile

    if not first_name or not last_name:
        raise HTTPException(status_code=400, detail="first_name and last_name are required")

    # Teachers skip member list verification
    if profile.lower() == "педагог":
        existing = queries.find_voter(event_id, first_name, last_name, "", False)
        if existing:
            voter_id, access_allowed = existing
            already_voted = queries.has_voted(event_id, voter_id)
            return {"voter_id": voter_id, "access": access_allowed, "already_voted": already_voted}
        row = queries.create_voter(event_id, first_name, last_name, "педагог", False, True)
        return {"voter_id": row[0], "access": True, "already_voted": False}

    # Fuzzy match against members list
    member = _fuzzy_find_member(first_name, last_name)
    if not member:
        raise HTTPException(status_code=403, detail="Вас нет в списке участников. Проверьте правильность имени и фамилии.")

    # Use the correct name from the members list
    matched_first = member[2]
    matched_last = member[1]

    # Check if this member already has a voter record
    existing = queries.find_voter(event_id, matched_first, matched_last, "", False)
    if existing:
        voter_id, access_allowed = existing
        already_voted = queries.has_voted(event_id, voter_id)
        return {"voter_id": voter_id, "access": access_allowed, "already_voted": already_voted}

    row = queries.create_voter(event_id, matched_first, matched_last, full_profile, False, True)
    return {"voter_id": row[0], "access": True, "already_voted": False}


class VoteRequest(BaseModel):
    voter_id: int
    contestant_id: int


@app.post("/api/vote")
def api_vote(req: VoteRequest):
    ev = _get_active_event()
    event_id = ev[0]

    if not ev[4]:  # voting_enabled
        raise HTTPException(status_code=403, detail="Голосование закрыто")

    voter = queries.get_voter(req.voter_id)
    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found")
    if voter[1] != event_id:
        raise HTTPException(status_code=400, detail="Voter belongs to a different event")
    if not voter[6]:  # access_allowed
        raise HTTPException(status_code=403, detail="У вас нет доступа к голосованию")

    if queries.has_voted(event_id, req.voter_id):
        raise HTTPException(status_code=409, detail="Вы уже проголосовали")

    contestant = queries.get_contestant(req.contestant_id)
    if not contestant or contestant[1] != event_id or not contestant[9]:  # is_active
        raise HTTPException(status_code=404, detail="Contestant not found")

    try:
        queries.cast_vote(event_id, req.voter_id, req.contestant_id)
    except Exception:
        raise HTTPException(status_code=409, detail="Вы уже проголосовали")

    _bump_vote_version()
    return {"ok": True}


@app.get("/api/results/access")
def api_results_access(tg_id: int = Query(0)):
    ev = _get_active_event()
    if ev[7]:  # results_visible
        return {"can_see": True}
    if tg_id and queries.is_results_admin(tg_id):
        return {"can_see": True}
    return {"can_see": False}


@app.get("/api/results")
def api_results():
    ev = _get_active_event()
    return _results_payload(ev[0])


@app.get("/api/results/stream")
async def api_results_stream():
    ev = _get_active_event()
    event_id = ev[0]

    async def event_generator():
        last_version = -1
        while True:
            if _vote_version != last_version:
                last_version = _vote_version
                payload = _results_payload(event_id)
                yield {"event": "results", "data": json.dumps(payload, ensure_ascii=False)}
            await asyncio.sleep(2)

    return EventSourceResponse(event_generator())


# ── Photo proxy (resolves Telegram file_id → URL) ───────────────

@app.get("/api/photo/{file_id:path}")
async def api_photo(file_id: str):
    if not BOT_TOKEN:
        raise HTTPException(status_code=500, detail="BOT_TOKEN not configured")
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getFile", params={"file_id": file_id})
        data = resp.json()
    if not data.get("ok"):
        raise HTTPException(status_code=404, detail="File not found")
    file_path = data["result"]["file_path"]
    url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}"
    return RedirectResponse(url=url, status_code=302)


# ── Admin API (used by Telegram bot) ─────────────────────────────
# These are internal endpoints — the bot calls them directly via DB queries.
# But we expose a results endpoint for the admin panel too.

@app.get("/api/admin/voters")
def api_admin_voters(event_id: int = Query(None)):
    if event_id is None:
        ev = _get_active_event()
        event_id = ev[0]
    rows = queries.get_all_voters(event_id)
    return [
        {
            "id": r[0],
            "first_name": r[1],
            "last_name": r[2],
            "profile": r[3],
            "is_guest": r[4],
            "access_allowed": r[5],
            "has_voted": r[6],
        }
        for r in rows
    ]


@app.get("/api/admin/voted")
def api_admin_voted(event_id: int = Query(None)):
    if event_id is None:
        ev = _get_active_event()
        event_id = ev[0]
    rows = queries.get_voted_voters(event_id)
    return [
        {
            "first_name": r[0],
            "last_name": r[1],
            "profile": r[2],
            "is_guest": r[3],
            "voted_for": r[4],
            "voted_at": r[5].isoformat() if r[5] else None,
        }
        for r in rows
    ]


# ── Raffle API ───────────────────────────────────────────────────

@app.get("/api/raffle")
def api_raffle():
    ev = _get_active_event()
    raffle = queries.get_active_raffle(ev[0])
    if not raffle:
        return {"active": False, "winner": None}
    return {
        "active": raffle[2],
        "winner": {"row": raffle[3], "seat": raffle[4]} if raffle[3] else None,
    }


@app.post("/api/raffle/spin")
def api_raffle_spin():
    ev = _get_active_event()
    event_id = ev[0]
    raffle = queries.get_active_raffle(event_id)
    if not raffle:
        raise HTTPException(status_code=404, detail="Розыгрыш не запущен")

    # Pick random row weighted by seats, then random seat
    rows_list = []
    for r, seats in HALL_ROWS.items():
        rows_list.extend([r] * seats)
    winner_row = random.choice(rows_list)
    winner_seat = random.randint(1, HALL_ROWS[winner_row])

    queries.set_raffle_winner(raffle[0], winner_row, winner_seat)
    _bump_raffle_version()
    return {"row": winner_row, "seat": winner_seat}


@app.post("/api/raffle/respin")
def api_raffle_respin():
    return api_raffle_spin()


@app.get("/api/raffle/stream")
async def api_raffle_stream():
    ev = _get_active_event()
    event_id = ev[0]

    async def event_generator():
        last_version = -1
        while True:
            if _raffle_version != last_version:
                last_version = _raffle_version
                raffle = queries.get_active_raffle(event_id)
                if raffle:
                    payload = {
                        "active": raffle[2],
                        "winner": {"row": raffle[3], "seat": raffle[4]} if raffle[3] else None,
                    }
                else:
                    payload = {"active": False, "winner": None}
                yield {"event": "raffle", "data": json.dumps(payload, ensure_ascii=False)}
            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


@app.post("/api/admin/raffle/start")
def api_admin_raffle_start():
    ev = _get_active_event()
    event_id = ev[0]
    queries.stop_raffle(event_id)
    row = queries.create_raffle(event_id)
    _bump_raffle_version()
    return {"raffle_id": row[0]}


@app.post("/api/admin/raffle/stop")
def api_admin_raffle_stop():
    ev = _get_active_event()
    queries.stop_raffle(ev[0])
    _bump_raffle_version()
    return {"ok": True}
