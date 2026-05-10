"""Minsktrans API client — fetches schedules from minsktrans.by."""
import time
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://minsktrans.by/lookout_yard"
PAGE_URL = f"{BASE_URL}/Home/Index/region"
DATA_URL = f"{BASE_URL}/Data"

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": PAGE_URL,
}

DAYS_NAMES = {
    1: "Пн", 2: "Вт", 4: "Ср", 8: "Чт",
    16: "Пт", 32: "Сб", 64: "Вс",
}

# Cache session for reuse
_session = None
_token = None
_session_ts = 0
SESSION_TTL = 1800  # 30 min


def _get_session():
    global _session, _token, _session_ts
    now = time.time()
    if _session and now - _session_ts < SESSION_TTL:
        return _session, _token
    _session = requests.Session()
    resp = _session.get(PAGE_URL)
    soup = BeautifulSoup(resp.text, "html.parser")
    token_input = soup.find("input", {"name": "__RequestVerificationToken"})
    _token = token_input["value"] if token_input else ""
    _session_ts = now
    return _session, _token


def _api_post(endpoint, params):
    session, token = _get_session()
    params["__RequestVerificationToken"] = token
    resp = session.post(f"{DATA_URL}/{endpoint}", data=params, headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def get_stop_name(stop_id: str) -> str:
    data = _api_post("StopName", {"stopid": stop_id})
    return data.get("Name", stop_id)


def get_route_stops(route_number: str, direction: int) -> list[dict]:
    """Get list of stops for a route direction. Returns [{id, lat, lon}, ...]"""
    data = _api_post("Route", {"p": "region", "tt": "bus", "r": route_number})
    trips = data.get("Trips", {})
    stops_key = "StopsA" if direction == 0 else "StopsB"
    stops = trips.get(stops_key, [])
    return [{"id": str(s["Id"]), "lat": s.get("Latitude"), "lon": s.get("Longitude")} for s in stops]


def get_route_info(route_number: str) -> dict:
    """Get route name info."""
    data = _api_post("Route", {"p": "region", "tt": "bus", "r": route_number})
    trips = data.get("Trips", {})
    return {
        "nameA": trips.get("NameA", ""),
        "nameB": trips.get("NameB", ""),
        "endStopA": trips.get("EndStopA", ""),
        "endStopB": trips.get("EndStopB", ""),
    }


def decode_days(bitmask: int) -> str:
    days = []
    for bit, name in sorted(DAYS_NAMES.items()):
        if bitmask & bit:
            days.append(name)
    return ", ".join(days) if days else f"mask={bitmask}"


def get_schedule(route_number: str, stop_id: str, direction: int) -> dict:
    """Get schedule for a stop on a route.
    Returns {today: [{hour, minutes: [str]}], days: [{label, hours: [{hour, minutes}]}]}
    """
    data = _api_post("Schedule", {
        "p": "region", "tt": "bus", "r": route_number,
        "s": stop_id, "d": str(direction),
    })

    def parse_hours(hour_lines):
        result = []
        for hl in hour_lines:
            hour = int(hl["Hour"])
            minutes_str = hl.get("Minutes", "").strip()
            if not minutes_str:
                continue
            mins = [m.strip() for m in minutes_str.split() if m.strip()]
            result.append({"hour": hour, "minutes": mins})
        return result

    today_hours = parse_hours(data.get("Schedule", {}).get("HourLines", []))

    days = []
    for ds in data.get("DaysOfWeek", []):
        mask = ds.get("DaysOfWeek", 0)
        hours = parse_hours(ds.get("HourLines", []))
        if hours:
            days.append({"label": decode_days(mask), "mask": mask, "hours": hours})

    return {"today": today_hours, "days": days}


def get_schedule_for_stops(route_number: str, direction: int,
                           stop_from_id: str, stop_to_id: str) -> dict:
    """Get schedules for two stops (boarding and alighting).
    Returns {from: {name, schedule}, to: {name, schedule}, route_name}
    """
    # Get stop names
    from_name = get_stop_name(stop_from_id)
    to_name = get_stop_name(stop_to_id)

    # Get schedules
    from_schedule = get_schedule(route_number, stop_from_id, direction)
    to_schedule = get_schedule(route_number, stop_to_id, direction)

    # Get route info
    info = get_route_info(route_number)
    route_name = info["nameA"] if direction == 0 else info["nameB"]

    return {
        "route_number": route_number,
        "route_name": route_name,
        "direction": direction,
        "from": {"id": stop_from_id, "name": from_name, "schedule": from_schedule},
        "to": {"id": stop_to_id, "name": to_name, "schedule": to_schedule},
    }
