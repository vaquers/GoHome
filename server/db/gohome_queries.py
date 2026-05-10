"""Database queries for GoHome bus schedule app."""
from .connection import fetch_all, fetch_one, execute, execute_returning


def get_user_routes(tg_id: int, category: str = None):
    if category:
        return fetch_all(
            "SELECT id, tg_id, category, route_number, direction, stop_from_id, stop_from_name, stop_to_id, stop_to_name, sort_order "
            "FROM user_routes WHERE tg_id = %s AND category = %s ORDER BY sort_order, id",
            (tg_id, category)
        )
    return fetch_all(
        "SELECT id, tg_id, category, route_number, direction, stop_from_id, stop_from_name, stop_to_id, stop_to_name, sort_order "
        "FROM user_routes WHERE tg_id = %s ORDER BY category, sort_order, id",
        (tg_id,)
    )


def add_user_route(tg_id: int, category: str, route_number: str, direction: int,
                   stop_from_id: str, stop_from_name: str, stop_to_id: str, stop_to_name: str):
    return execute_returning(
        "INSERT INTO user_routes (tg_id, category, route_number, direction, stop_from_id, stop_from_name, stop_to_id, stop_to_name) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
        "ON CONFLICT (tg_id, category, route_number, direction) DO UPDATE SET "
        "stop_from_id = EXCLUDED.stop_from_id, stop_from_name = EXCLUDED.stop_from_name, "
        "stop_to_id = EXCLUDED.stop_to_id, stop_to_name = EXCLUDED.stop_to_name "
        "RETURNING id",
        (tg_id, category, route_number, direction, stop_from_id, stop_from_name, stop_to_id, stop_to_name)
    )


def delete_user_route(route_id: int, tg_id: int):
    execute("DELETE FROM user_routes WHERE id = %s AND tg_id = %s", (route_id, tg_id))


def delete_user_route_by_number(tg_id: int, category: str, route_number: str):
    execute(
        "DELETE FROM user_routes WHERE tg_id = %s AND category = %s AND route_number = %s",
        (tg_id, category, route_number)
    )
