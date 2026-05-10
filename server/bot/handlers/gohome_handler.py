"""GoHome bot handler — manage bus routes via Telegram."""
from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext

from server.db import gohome_queries as gq
from server.minsktrans import get_route_stops, get_stop_name, get_route_info
from server.bot.states.gohome_states import AddRouteFSM

router = Router(name="gohome")


def _routes_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🚌 Мои маршруты", callback_data="gh_my_routes")],
        [InlineKeyboardButton(text="➕ Добавить маршрут", callback_data="gh_add_route")],
        [InlineKeyboardButton(text="🌐 Открыть приложение", url="https://t.me/gohome_bus_bot?startapp")],
    ])


def _category_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Домой", callback_data="gh_cat_home")],
        [InlineKeyboardButton(text="🏙 В Минск", callback_data="gh_cat_minsk")],
        [InlineKeyboardButton(text="◀️ Отмена", callback_data="gh_cancel")],
    ])


@router.message(Command("start"))
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(
        "🚌 <b>GoHome</b> — расписание автобусов\n\n"
        "Добавьте маршруты через бота, а расписание смотрите в мини-приложении.",
        parse_mode="HTML",
        reply_markup=_routes_menu(),
    )


@router.callback_query(F.data == "gh_main")
async def cb_main(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "🚌 <b>GoHome</b> — расписание автобусов",
        parse_mode="HTML",
        reply_markup=_routes_menu(),
    )
    await callback.answer()


# ── Show routes ──────────────────────────────────────────────────

@router.callback_query(F.data == "gh_my_routes")
async def cb_my_routes(callback: CallbackQuery):
    tg_id = callback.from_user.id
    routes = gq.get_user_routes(tg_id)
    if not routes:
        await callback.message.edit_text(
            "У вас пока нет маршрутов. Добавьте первый!",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="➕ Добавить маршрут", callback_data="gh_add_route")],
                [InlineKeyboardButton(text="◀️ Назад", callback_data="gh_main")],
            ]),
        )
        await callback.answer()
        return

    lines = []
    current_cat = None
    buttons = []
    for r in routes:
        cat = r[2]
        if cat != current_cat:
            current_cat = cat
            label = "🏠 Домой" if cat == "home" else "🏙 В Минск"
            lines.append(f"\n<b>{label}</b>")
        route_num = r[3]
        direction = r[4]
        from_name = r[6] or r[5]
        to_name = r[8] or r[7]
        lines.append(f"  🚌 <b>{route_num}</b> (напр. {direction}): {from_name} → {to_name}")
        buttons.append([InlineKeyboardButton(
            text=f"🗑 {route_num} ({cat})",
            callback_data=f"gh_del_{r[0]}",
        )])

    buttons.append([InlineKeyboardButton(text="➕ Добавить", callback_data="gh_add_route")])
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="gh_main")])

    await callback.message.edit_text(
        "\n".join(lines),
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )
    await callback.answer()


# ── Delete route ─────────────────────────────────────────────────

@router.callback_query(F.data.startswith("gh_del_"))
async def cb_delete_route(callback: CallbackQuery):
    route_id = int(callback.data.split("_")[2])
    gq.delete_user_route(route_id, callback.from_user.id)
    await callback.answer("Удалено!")
    # Refresh list
    await cb_my_routes(callback)


# ── Add route flow ───────────────────────────────────────────────

@router.callback_query(F.data == "gh_add_route")
async def cb_add_route(callback: CallbackQuery, state: FSMContext):
    await state.set_state(AddRouteFSM.category)
    await callback.message.edit_text(
        "Куда едем на этом маршруте?",
        reply_markup=_category_keyboard(),
    )
    await callback.answer()


@router.callback_query(F.data == "gh_cancel")
async def cb_cancel(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await cb_main(callback, state)


@router.callback_query(F.data.startswith("gh_cat_"), AddRouteFSM.category)
async def cb_category(callback: CallbackQuery, state: FSMContext):
    category = callback.data.replace("gh_cat_", "")
    await state.update_data(category=category)
    await state.set_state(AddRouteFSM.route_number)
    await callback.message.edit_text(
        "Введите номер автобуса (например: 323):",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Отмена", callback_data="gh_cancel")],
        ]),
    )
    await callback.answer()


@router.message(AddRouteFSM.route_number)
async def msg_route_number(message: Message, state: FSMContext):
    route_number = message.text.strip()

    # Validate route exists
    try:
        info = get_route_info(route_number)
    except Exception:
        await message.answer("❌ Маршрут не найден. Попробуйте ещё раз:")
        return

    name_a = info.get("nameA", "")
    name_b = info.get("nameB", "")

    await state.update_data(route_number=route_number, route_info=info)
    await state.set_state(AddRouteFSM.direction)
    await message.answer(
        f"Выберите направление маршрута <b>{route_number}</b>:\n\n"
        f"0️⃣ {name_a}\n"
        f"1️⃣ {name_b}",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=f"0 — {name_a[:40]}", callback_data="gh_dir_0")],
            [InlineKeyboardButton(text=f"1 — {name_b[:40]}", callback_data="gh_dir_1")],
            [InlineKeyboardButton(text="◀️ Отмена", callback_data="gh_cancel")],
        ]),
    )


@router.callback_query(F.data.startswith("gh_dir_"), AddRouteFSM.direction)
async def cb_direction(callback: CallbackQuery, state: FSMContext):
    direction = int(callback.data.replace("gh_dir_", ""))
    data = await state.get_data()
    route_number = data["route_number"]

    # Fetch stops
    try:
        stops = get_route_stops(route_number, direction)
    except Exception:
        await callback.message.edit_text("❌ Ошибка получения остановок.")
        await state.clear()
        await callback.answer()
        return

    # Get stop names
    stop_names = {}
    for s in stops:
        try:
            stop_names[s["id"]] = get_stop_name(s["id"])
        except Exception:
            stop_names[s["id"]] = s["id"]

    await state.update_data(direction=direction, stops=stops, stop_names=stop_names)
    await state.set_state(AddRouteFSM.stop_from)

    # Build stops list (show in pages if too many)
    buttons = []
    for s in stops:
        name = stop_names.get(s["id"], s["id"])
        buttons.append([InlineKeyboardButton(
            text=name,
            callback_data=f"gh_sfrom_{s['id']}",
        )])
    buttons.append([InlineKeyboardButton(text="◀️ Отмена", callback_data="gh_cancel")])

    await callback.message.edit_text(
        "🚏 Выберите остановку <b>посадки</b> (где садитесь):",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("gh_sfrom_"), AddRouteFSM.stop_from)
async def cb_stop_from(callback: CallbackQuery, state: FSMContext):
    stop_from_id = callback.data.replace("gh_sfrom_", "")
    data = await state.get_data()
    stops = data["stops"]
    stop_names = data["stop_names"]

    await state.update_data(stop_from_id=stop_from_id)
    await state.set_state(AddRouteFSM.stop_to)

    # Show only stops after the boarding stop
    stop_ids = [s["id"] for s in stops]
    from_idx = stop_ids.index(stop_from_id) if stop_from_id in stop_ids else 0
    remaining = stops[from_idx + 1:]

    buttons = []
    for s in remaining:
        name = stop_names.get(s["id"], s["id"])
        buttons.append([InlineKeyboardButton(
            text=name,
            callback_data=f"gh_sto_{s['id']}",
        )])
    buttons.append([InlineKeyboardButton(text="◀️ Отмена", callback_data="gh_cancel")])

    from_name = stop_names.get(stop_from_id, stop_from_id)
    await callback.message.edit_text(
        f"Посадка: <b>{from_name}</b>\n\n"
        "🚏 Выберите остановку <b>высадки</b> (где выходите):",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("gh_sto_"), AddRouteFSM.stop_to)
async def cb_stop_to(callback: CallbackQuery, state: FSMContext):
    stop_to_id = callback.data.replace("gh_sto_", "")
    data = await state.get_data()

    category = data["category"]
    route_number = data["route_number"]
    direction = data["direction"]
    stop_from_id = data["stop_from_id"]
    stop_names = data["stop_names"]

    from_name = stop_names.get(stop_from_id, stop_from_id)
    to_name = stop_names.get(stop_to_id, stop_to_id)

    # Save to DB
    gq.add_user_route(
        callback.from_user.id, category, route_number, direction,
        stop_from_id, from_name, stop_to_id, to_name,
    )

    await state.clear()

    cat_label = "🏠 Домой" if category == "home" else "🏙 В Минск"
    await callback.message.edit_text(
        f"✅ Маршрут добавлен!\n\n"
        f"{cat_label}\n"
        f"🚌 <b>{route_number}</b> (напр. {direction})\n"
        f"📍 {from_name} → {to_name}",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="➕ Ещё маршрут", callback_data="gh_add_route")],
            [InlineKeyboardButton(text="🚌 Мои маршруты", callback_data="gh_my_routes")],
            [InlineKeyboardButton(text="◀️ Главная", callback_data="gh_main")],
        ]),
    )
    await callback.answer()
