#!/usr/bin/env python3
"""
Парсер расписания региональных автобусов minsktrans.by

Использование:
    python minsktrans.py <номер_автобуса> <id_остановки> <направление 0|1>

Пример:
    python minsktrans.py 323 4891505 0
"""

import sys
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


def get_session():
    """Получить сессию с токеном верификации."""
    session = requests.Session()
    resp = session.get(PAGE_URL)
    soup = BeautifulSoup(resp.text, "html.parser")
    token_input = soup.find("input", {"name": "__RequestVerificationToken"})
    token = token_input["value"] if token_input else ""
    return session, token


def api_post(session, token, endpoint, params):
    """POST-запрос к API."""
    params["__RequestVerificationToken"] = token
    resp = session.post(f"{DATA_URL}/{endpoint}", data=params, headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def decode_days(bitmask):
    """Превратить битовую маску дней в строку."""
    days = []
    for bit, name in sorted(DAYS_NAMES.items()):
        if bitmask & bit:
            days.append(name)
    return ", ".join(days) if days else f"mask={bitmask}"


def format_schedule(hour_lines):
    """Форматировать расписание из HourLines."""
    lines = []
    for hl in hour_lines:
        hour = int(hl["Hour"])
        minutes = hl.get("Minutes", "")
        if not minutes or not minutes.strip():
            continue
        mins = minutes.strip().split()
        times = [f"{hour:02d}:{m.strip()}" for m in mins]
        lines.append(f"  {hour:02d}: {' '.join(times)}")
    return "\n".join(lines)


def main():
    if len(sys.argv) < 4:
        print("Использование: python minsktrans.py <номер> <остановка_id> <направление>")
        print("Пример: python minsktrans.py 323 4891505 0")
        sys.exit(1)

    route_num = sys.argv[1]
    stop_id = sys.argv[2]
    direction = sys.argv[3]

    print(f"Подключение к minsktrans.by...")
    session, token = get_session()

    # Получить информацию о маршруте (список остановок)
    route_data = api_post(session, token, "Route", {
        "p": "region", "tt": "bus", "r": route_num
    })

    trips = route_data.get("Trips", {})
    stops_key = "StopsA" if direction == "0" else "StopsB"
    name_key = "NameA" if direction == "0" else "NameB"
    stops = trips.get(stops_key, [])

    route_name = trips.get(name_key, route_num)
    print(f"\nМаршрут {route_num}: {route_name}")
    print(f"Направление: {direction}, остановок: {len(stops)}")

    # Найти индекс нашей остановки
    stop_ids = [str(s["Id"]) for s in stops]
    if stop_id not in stop_ids:
        print(f"\nОшибка: остановка {stop_id} не найдена на маршруте {route_num} (направление {direction})")
        print("Доступные остановки:")
        for s in stops:
            name_resp = api_post(session, token, "StopName", {"stopid": s["Id"]})
            print(f"  {s['Id']} — {name_resp.get('Name', '?')}")
        sys.exit(1)

    start_idx = stop_ids.index(stop_id)

    # Получить названия остановок от нашей до конца маршрута
    remaining_stops = stops[start_idx:]
    print(f"\nОстановки от выбранной до конца ({len(remaining_stops)} шт.):\n")

    for i, stop in enumerate(remaining_stops):
        sid = str(stop["Id"])

        # Название остановки
        name_resp = api_post(session, token, "StopName", {"stopid": sid})
        stop_name = name_resp.get("Name", sid)

        # Расписание для этой остановки
        sched_data = api_post(session, token, "Schedule", {
            "p": "region", "tt": "bus", "r": route_num,
            "s": sid, "d": direction,
        })

        print(f"{'='*60}")
        print(f"  [{start_idx + i + 1}/{len(stop_ids)}] {stop_name} (id: {sid})")
        print(f"{'='*60}")

        # Текущее расписание
        current = sched_data.get("Schedule", {})
        current_hours = current.get("HourLines", [])
        if current_hours:
            print(f"\n  Сегодня:")
            print(format_schedule(current_hours))

        # Расписание по дням недели
        days_list = sched_data.get("DaysOfWeek", [])
        for day_sched in days_list:
            mask = day_sched.get("DaysOfWeek", 0)
            hours = day_sched.get("HourLines", [])
            if hours:
                print(f"\n  {decode_days(mask)}:")
                print(format_schedule(hours))

        print()


if __name__ == "__main__":
    main()
