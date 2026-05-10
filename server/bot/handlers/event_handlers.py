"""Event management handlers."""
import json
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext

from server.config import SUPER_ADMIN_ID
from server.db import queries
from server.bot.keyboards.menus import events_menu, event_actions
from server.bot.states.states import CreateEventFSM, EditEventFSM, AddResultsAdminFSM

ALL_PROFILES = ["ИФ", "ИМ", "ГУМ", "ФИЗ", "МАТ", "ФИЛ", "ЭГ", "ХИМ", "ОБЩ", "ИСТ", "БИО-1", "БИО-2"]

COLOR_PRESETS = {
    "Фиолетовый": "#A855F7",
    "Синий": "#3B82F6",
    "Розовый": "#EC4899",
    "Зелёный": "#22C55E",
    "Красный": "#EF4444",
    "Оранжевый": "#F97316",
    "Бирюзовый": "#14B8A6",
    "Жёлтый": "#EAB308",
}

router = Router(name="events")


def is_admin(user_id: int) -> bool:
    return user_id == SUPER_ADMIN_ID


# ── List events ───────────────────────────────────────────────────

@router.callback_query(F.data == "events_list")
async def cb_events_list(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    events = queries.get_all_events()
    if not events:
        await callback.message.answer("Конкурсов пока нет.", reply_markup=events_menu())
        await callback.answer()
        return

    for ev in events:
        active = "✅" if ev[3] else "❌"
        voting = "🟢" if ev[4] else "🔴"
        contest_type = ev[8] if len(ev) > 8 else "person"
        type_label = "🏫 Классы" if contest_type == "class" else "👤 Люди"
        text = (
            f"{active} <b>{ev[2]}</b> ({ev[1]})\n"
            f"Голосование: {voting} | Тип: {type_label}"
        )
        await callback.message.answer(text, parse_mode="HTML", reply_markup=event_actions(ev[0], ev))
    await callback.answer()


# ── Create event ──────────────────────────────────────────────────

@router.callback_query(F.data == "events_create")
async def cb_events_create(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    await state.set_state(CreateEventFSM.year)
    await callback.message.answer("Введите год конкурса (например: 2026):")
    await callback.answer()


@router.message(CreateEventFSM.year, F.text)
async def create_event_year(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    if not text.isdigit():
        await message.answer("Введите число (год).")
        return
    await state.update_data(year=int(text))
    await state.set_state(CreateEventFSM.title)
    await message.answer("Введите название конкурса:")


@router.message(CreateEventFSM.title, F.text)
async def create_event_title(message: Message, state: FSMContext):
    title = (message.text or "").strip()
    if not title:
        await message.answer("Название не может быть пустым.")
        return
    await state.update_data(title=title)
    await state.set_state(CreateEventFSM.contest_type)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="👤 За людей", callback_data="create_type_person")],
        [InlineKeyboardButton(text="🏫 За классы", callback_data="create_type_class")],
    ])
    await message.answer("Выберите тип конкурса:", reply_markup=kb)


@router.callback_query(F.data.startswith("create_type_"))
async def cb_create_type(callback: CallbackQuery, state: FSMContext):
    contest_type = callback.data.split("_")[2]  # person or class
    await state.update_data(contest_type=contest_type)
    await state.set_state(CreateEventFSM.accent_color)
    rows = []
    for name, color in COLOR_PRESETS.items():
        rows.append([InlineKeyboardButton(text=f"● {name}", callback_data=f"create_color_{color}")])
    kb = InlineKeyboardMarkup(inline_keyboard=rows)
    await callback.message.answer("Выберите цвет конкурса:", reply_markup=kb)
    await callback.answer()


@router.callback_query(F.data.startswith("create_color_"))
async def cb_create_color(callback: CallbackQuery, state: FSMContext):
    color = callback.data[len("create_color_"):]
    await state.update_data(accent_color=color)

    data = await state.get_data()
    if data["contest_type"] == "class":
        await state.update_data(selected_classes=[])
        await state.set_state(CreateEventFSM.classes)
        await callback.message.answer("Выберите классы для конкурса:", reply_markup=_classes_keyboard([]))
        await callback.answer()
    else:
        # Person contest — create immediately
        row = queries.create_event(data["year"], data["title"])
        if row:
            event_id = row[0]
            queries.update_event_field(event_id, "contest_type", "person")
            queries.update_event_field(event_id, "accent_color", color)
            queries.seed_default_texts(event_id)
        await state.clear()
        await callback.message.answer(f"✅ Конкурс «{data['title']}» создан.", reply_markup=events_menu())
        await callback.answer()


def _classes_keyboard(selected: list[str]):
    rows = []
    # 10 parallel header
    rows.append([InlineKeyboardButton(
        text=f"{'✅' if all(f'10 {p}' in selected for p in ALL_PROFILES) else '⬜'} Вся 10 параллель",
        callback_data="cls_all_10"
    )])
    row_10 = []
    for p in ALL_PROFILES:
        cls = f"10 {p}"
        mark = "✅" if cls in selected else "⬜"
        row_10.append(InlineKeyboardButton(text=f"{mark} {cls}", callback_data=f"cls_toggle_10_{p}"))
        if len(row_10) == 3:
            rows.append(row_10)
            row_10 = []
    if row_10:
        rows.append(row_10)

    # 11 parallel header
    rows.append([InlineKeyboardButton(
        text=f"{'✅' if all(f'11 {p}' in selected for p in ALL_PROFILES) else '⬜'} Вся 11 параллель",
        callback_data="cls_all_11"
    )])
    row_11 = []
    for p in ALL_PROFILES:
        cls = f"11 {p}"
        mark = "✅" if cls in selected else "⬜"
        row_11.append(InlineKeyboardButton(text=f"{mark} {cls}", callback_data=f"cls_toggle_11_{p}"))
        if len(row_11) == 3:
            rows.append(row_11)
            row_11 = []
    if row_11:
        rows.append(row_11)

    rows.append([InlineKeyboardButton(text="✅ Готово", callback_data="cls_done")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.callback_query(F.data.startswith("cls_toggle_"))
async def cb_cls_toggle(callback: CallbackQuery, state: FSMContext):
    parts = callback.data.split("_")
    parallel = parts[2]
    profile = "_".join(parts[3:])
    cls = f"{parallel} {profile}"
    data = await state.get_data()
    selected = data.get("selected_classes", [])
    if cls in selected:
        selected.remove(cls)
    else:
        selected.append(cls)
    await state.update_data(selected_classes=selected)
    await callback.message.edit_reply_markup(reply_markup=_classes_keyboard(selected))
    await callback.answer()


@router.callback_query(F.data.startswith("cls_all_"))
async def cb_cls_all(callback: CallbackQuery, state: FSMContext):
    parallel = callback.data.split("_")[2]
    data = await state.get_data()
    selected = data.get("selected_classes", [])
    all_in_parallel = [f"{parallel} {p}" for p in ALL_PROFILES]
    if all(c in selected for c in all_in_parallel):
        # Deselect all
        selected = [c for c in selected if not c.startswith(f"{parallel} ")]
    else:
        # Select all
        for c in all_in_parallel:
            if c not in selected:
                selected.append(c)
    await state.update_data(selected_classes=selected)
    await callback.message.edit_reply_markup(reply_markup=_classes_keyboard(selected))
    await callback.answer()


@router.callback_query(F.data == "cls_done")
async def cb_cls_done(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    selected = data.get("selected_classes", [])
    if not selected:
        await callback.answer("Выберите хотя бы один класс!")
        return

    row = queries.create_event(data["year"], data["title"])
    if row:
        event_id = row[0]
        queries.update_event_field(event_id, "contest_type", "class")
        queries.update_event_field(event_id, "accent_color", data["accent_color"])
        queries.update_event_field(event_id, "classes", json.dumps(selected, ensure_ascii=False))
        queries.seed_default_texts(event_id)
        # Auto-create contestants from selected classes
        selected.sort(key=lambda c: (c.split()[0], ALL_PROFILES.index(c.split(maxsplit=1)[1]) if c.split(maxsplit=1)[1] in ALL_PROFILES else 99))
        for i, cls in enumerate(selected):
            queries.add_contestant(event_id, cls, "", cls, "", "", "", i)

    await state.clear()
    await callback.message.answer(
        f"✅ Конкурс «{data['title']}» создан с {len(selected)} классами.",
        reply_markup=events_menu()
    )
    await callback.answer()


# ── Activate event ────────────────────────────────────────────────

@router.callback_query(F.data.startswith("ev_activate_"))
async def cb_activate_event(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    event_id = int(callback.data.split("_")[2])
    queries.set_active_event(event_id)
    ev = queries.get_event(event_id)
    await callback.answer(f"Конкурс «{ev[2]}» теперь активный!")
    await callback.message.edit_reply_markup(reply_markup=event_actions(event_id, ev))


# ── Toggle event fields ──────────────────────────────────────────

@router.callback_query(F.data.startswith("ev_toggle_"))
async def cb_toggle_event(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    parts = callback.data.split("_")
    event_id = int(parts[2])
    field = "_".join(parts[3:])
    ev = queries.get_event(event_id)
    if not ev:
        await callback.answer("Конкурс не найден")
        return
    field_map = {"voting_enabled": 4, "interviews_enabled": 5, "tapbar_enabled": 6, "results_visible": 7}
    idx = field_map.get(field)
    if idx is None:
        await callback.answer("Неизвестное поле")
        return
    new_val = not ev[idx]
    queries.update_event_field(event_id, field, new_val)
    ev = queries.get_event(event_id)
    status = "включено" if new_val else "выключено"
    await callback.answer(f"{field}: {status}")
    await callback.message.edit_reply_markup(reply_markup=event_actions(event_id, ev))


# ── Edit event fields ────────────────────────────────────────────

@router.callback_query(F.data.startswith("ev_edit_"))
async def cb_edit_event(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    parts = callback.data.split("_")
    event_id = int(parts[2])
    field = parts[3]
    await state.update_data(event_id=event_id, field=field)
    await state.set_state(EditEventFSM.value)
    prompts = {"year": "Введите новый год:", "title": "Введите новое название:"}
    await callback.message.answer(prompts.get(field, "Введите новое значение:"))
    await callback.answer()


@router.message(EditEventFSM.value, F.text)
async def edit_event_value(message: Message, state: FSMContext):
    data = await state.get_data()
    event_id = data["event_id"]
    field = data["field"]
    value = (message.text or "").strip()
    if field == "year":
        if not value.isdigit():
            await message.answer("Год должен быть числом.")
            return
        value = int(value)
    queries.update_event_field(event_id, field, value)
    await state.clear()
    await message.answer(f"✅ Поле «{field}» обновлено.", reply_markup=events_menu())


# ── Change accent color ──────────────────────────────────────────

@router.callback_query(F.data.startswith("ev_color_"))
async def cb_event_color(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    event_id = int(callback.data.split("_")[2])
    rows = []
    for name, color in COLOR_PRESETS.items():
        rows.append([InlineKeyboardButton(text=f"● {name}", callback_data=f"ev_setcolor_{event_id}_{color}")])
    rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="events_list")])
    kb = InlineKeyboardMarkup(inline_keyboard=rows)
    await callback.message.answer("Выберите цвет:", reply_markup=kb)
    await callback.answer()


@router.callback_query(F.data.startswith("ev_setcolor_"))
async def cb_event_setcolor(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    parts = callback.data.split("_")
    event_id = int(parts[2])
    color = parts[3]
    queries.update_event_field(event_id, "accent_color", color)
    await callback.answer(f"Цвет обновлён: {color}")
    ev = queries.get_event(event_id)
    await callback.message.edit_reply_markup(reply_markup=event_actions(event_id, ev))


@router.callback_query(F.data.startswith("ev_info_"))
async def cb_event_info(callback: CallbackQuery):
    await callback.answer("Тип задаётся при создании конкурса")


# ── Results admins ────────────────────────────────────────────────

@router.callback_query(F.data == "results_admins_list")
async def cb_results_admins_list(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    admins = queries.get_results_admins()
    lines = [f"• `{r[0]}`" for r in admins] if admins else ["Список пуст"]
    text = "👁 <b>Admins результатов:</b>\n" + "\n".join(lines)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Добавить", callback_data="results_admins_add")],
        [InlineKeyboardButton(text="➖ Удалить", callback_data="results_admins_remove")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu_events")],
    ])
    await callback.message.answer(text, parse_mode="HTML", reply_markup=kb)
    await callback.answer()


@router.callback_query(F.data == "results_admins_add")
async def cb_results_admins_add(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    await state.set_state(AddResultsAdminFSM.tg_id)
    await state.update_data(action="add")
    await callback.message.answer("Введите Telegram ID пользователя:")
    await callback.answer()


@router.callback_query(F.data == "results_admins_remove")
async def cb_results_admins_remove(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    await state.set_state(AddResultsAdminFSM.tg_id)
    await state.update_data(action="remove")
    await callback.message.answer("Введите Telegram ID для удаления:")
    await callback.answer()


@router.message(AddResultsAdminFSM.tg_id, F.text)
async def results_admin_tg_id(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    if not text.lstrip("-").isdigit():
        await message.answer("Введите числовой Telegram ID.")
        return
    tg_id = int(text)
    data = await state.get_data()
    await state.clear()
    if data.get("action") == "remove":
        queries.remove_results_admin(tg_id)
        await message.answer(f"✅ ID {tg_id} удалён из admins результатов.")
    else:
        queries.add_results_admin(tg_id)
        await message.answer(f"✅ ID {tg_id} добавлен в admins результатов.")
