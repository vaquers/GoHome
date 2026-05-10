"""GoHome — FastAPI Backend for bus schedule tracker."""
import json
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .db import gohome_queries as gq
from .minsktrans import get_schedule_for_stops, get_route_stops, get_stop_name, get_route_info

app = FastAPI(title="GoHome API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _route_dict(r):
    return {
        "id": r[0],
        "tg_id": r[1],
        "category": r[2],
        "route_number": r[3],
        "direction": r[4],
        "stop_from_id": r[5],
        "stop_from_name": r[6],
        "stop_to_id": r[7],
        "stop_to_name": r[8],
        "sort_order": r[9],
    }


# ── Routes CRUD ──────────────────────────────────────────────────

@app.get("/api/routes")
def api_get_routes(tg_id: int = Query(...), category: str = Query(None)):
    rows = gq.get_user_routes(tg_id, category)
    return [_route_dict(r) for r in rows]


class AddRouteRequest(BaseModel):
    tg_id: int
    category: str  # "minsk" or "home"
    route_number: str
    direction: int = 0
    stop_from_id: str
    stop_to_id: str


@app.post("/api/routes")
def api_add_route(req: AddRouteRequest):
    if req.category not in ("minsk", "home"):
        raise HTTPException(400, "category must be 'minsk' or 'home'")

    # Resolve stop names from minsktrans
    from_name = get_stop_name(req.stop_from_id)
    to_name = get_stop_name(req.stop_to_id)

    row = gq.add_user_route(
        req.tg_id, req.category, req.route_number, req.direction,
        req.stop_from_id, from_name, req.stop_to_id, to_name,
    )
    return {"id": row[0], "stop_from_name": from_name, "stop_to_name": to_name}


@app.delete("/api/routes/{route_id}")
def api_delete_route(route_id: int, tg_id: int = Query(...)):
    gq.delete_user_route(route_id, tg_id)
    return {"ok": True}


# ── Schedule ─────────────────────────────────────────────────────

@app.get("/api/schedule")
def api_schedule(tg_id: int = Query(...), category: str = Query(...)):
    """Get schedules for all user's routes in a category."""
    if category not in ("minsk", "home"):
        raise HTTPException(400, "category must be 'minsk' or 'home'")

    routes = gq.get_user_routes(tg_id, category)
    results = []
    for r in routes:
        route_number = r[3]
        direction = r[4]
        stop_from_id = r[5]
        stop_to_id = r[7]
        try:
            sched = get_schedule_for_stops(route_number, direction, stop_from_id, stop_to_id)
            results.append(sched)
        except Exception as e:
            results.append({
                "route_number": route_number,
                "direction": direction,
                "error": str(e),
            })
    return results


@app.get("/api/schedule/single")
def api_schedule_single(
    route: str = Query(...),
    direction: int = Query(0),
    stop_from: str = Query(...),
    stop_to: str = Query(...),
):
    """Get schedule for a single route between two stops."""
    try:
        return get_schedule_for_stops(route, direction, stop_from, stop_to)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Route info (for bot) ────────────────────────────────────────

@app.get("/api/minsktrans/stops")
def api_minsktrans_stops(route: str = Query(...), direction: int = Query(0)):
    """Get list of stops for a route."""
    stops = get_route_stops(route, direction)
    result = []
    for s in stops:
        name = get_stop_name(s["id"])
        result.append({"id": s["id"], "name": name})
    return result


@app.get("/api/minsktrans/route-info")
def api_minsktrans_route_info(route: str = Query(...)):
    return get_route_info(route)
