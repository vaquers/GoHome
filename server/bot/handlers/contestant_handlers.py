"""Contestant management handlers."""
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext

from server.config import SUPER_ADMIN_ID, BOT_TOKEN
from server.db import queries
from server.bot.keyboards.menus import contestants_menu, contestant_actions, confirm_delete
from server.bot.states.states import AddContestantFSM, EditContestantFSM

router = Router(name="contestants")


def is_admin(user_id: int) -> bool:
    return user_id == SUPER_ADMIN_ID


def _get_active_event_id():
    ev = queries.get_active_event()
    return ev[0] if ev else None


# ── List ──────────────────────────────────────────────────────────

@router.callback_query(F.data == "cont_list")
async def cb_cont_list(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    event_id = _get_active_event_id()
    if not event_id:
        await callback.message.answer("Нет активного конкурса.")
        await callback.answer()
        return
    rows = queries.get_all_contestants(event_id)
    if not rows:
        await callback.message.answer("Мистеров пока нет.", reply_markup=contestants_menu())
        await callback.answer()
        return

    for r in rows:
        active = "🟢" if r[8] else "🔴"
        text = (
            f"{active} <b>{r[3]}</b> (#{r[0]})\n"
            f"Имя: {r[1]} {r[2]}\n"
            f"Профиль: {r[4]}\n"
            f"Порядок: {r[7]}\n"
            f"Описание: {r[5] or '—'}"
        )
        if r[6]:  # photo_url
            try:
                await callback.message.answer_photo(
                    photo=r[6], caption=text, parse_mode="HTML",
                    reply_markup=contestant_actions(r[0])
                )
                continue
            except Exception:
                pass
        await callback.message.answer(text, parse_mode="HTML", reply_markup=contestant_actions(r[0]))
    await callback.answer()


# ── Add ───────────────────────────────────────────────────────────

@router.callback_query(F.data == "cont_add")
async def cb_cont_add(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    event_id = _get_active_event_id()
    if not event_id:
        await callback.message.answer("Сначала создайте и активируйте конкурс.")
        await callback.answer()
        return
    await state.update_data(event_id=event_id)
    await state.set_state(AddContestantFSM.name)
    await callback.message.answer("Введите имя мистера:")
    await callback.answer()


@router.message(AddContestantFSM.name, F.text)
async def add_cont_name(message: Message, state: FSMContext):
    await state.update_data(name=(message.text or "").strip())
    await state.set_state(AddContestantFSM.surname)
    await message.answer("Введите фамилию:")


@router.message(AddContestantFSM.surname, F.text)
async def add_cont_surname(message: Message, state: FSMContext):
    await state.update_data(surname=(message.text or "").strip())
    await state.set_state(AddContestantFSM.profile)
    await message.answer("Введите профиль/класс:")


@router.message(AddContestantFSM.profile, F.text)
async def add_cont_profile(message: Message, state: FSMContext):
    await state.update_data(profile=(message.text or "").strip())
    await state.set_state(AddContestantFSM.description)
    await message.answer("Введите описание (или «пропустить»):")


@router.message(AddContestantFSM.description, F.text)
async def add_cont_description(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    if text.lower() in ("пропустить", "-"):
        text = ""
    await state.update_data(description=text)
    await state.set_state(AddContestantFSM.photo)
    await message.answer("Отправьте фото (или текст «пропустить»):")


@router.message(AddContestantFSM.photo, F.photo)
async def add_cont_photo_photo(message: Message, state: FSMContext):
    file_id = message.photo[-1].file_id
    await state.update_data(photo_url=file_id)
    await state.set_state(AddContestantFSM.sort_order)
    await message.answer("Введите порядковый номер (число):")


@router.message(AddContestantFSM.photo, F.text)
async def add_cont_photo_skip(message: Message, state: FSMContext):
    await state.update_data(photo_url="")
    await state.set_state(AddContestantFSM.sort_order)
    await message.answer("Введите порядковый номер (число):")


@router.message(AddContestantFSM.sort_order, F.text)
async def add_cont_sort_order(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    if not text.isdigit():
        await message.answer("Введите целое число.")
        return
    data = await state.get_data()
    name = data.get("name", "")
    surname = data.get("surname", "")
    display_name = f"{name} {surname}".strip()
    row = queries.add_contestant(
        event_id=data["event_id"],
        name=name,
        surname=surname,
        display_name=display_name,
        profile=data.get("profile", ""),
        description=data.get("description", ""),
        photo_url=data.get("photo_url", ""),
        sort_order=int(text),
    )
    await state.clear()
    if row:
        await message.answer(f"✅ Мистер «{display_name}» добавлен (id={row[0]}).", reply_markup=contestants_menu())
    else:
        await message.answer("Ошибка при добавлении.")


# ── Edit ──────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("cont_edit_"))
async def cb_cont_edit(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    parts = callback.data.split("_")
    c_id = int(parts[2])
    field = "_".join(parts[3:])
    contestant = queries.get_contestant(c_id)
    if not contestant:
        await callback.answer("Не найден")
        return
    await state.update_data(cont_edit_id=c_id, cont_edit_field=field)
    await state.set_state(EditContestantFSM.value)
    prompts = {
        "name": "Введите новое имя:",
        "surname": "Введите новую фамилию:",
        "display_name": "Введите новое отображаемое имя:",
        "profile": "Введите новый профиль/класс:",
        "description": "Введите новое описание:",
        "photo_url": "Отправьте новое фото (или текст для URL):",
        "sort_order": "Введите новый порядковый номер:",
    }
    await callback.message.answer(prompts.get(field, "Введите новое значение:"))
    await callback.answer()


@router.message(EditContestantFSM.value, F.photo)
async def edit_cont_photo(message: Message, state: FSMContext):
    data = await state.get_data()
    field = data.get("cont_edit_field")
    if field != "photo_url":
        await state.clear()
        return
    file_id = message.photo[-1].file_id
    queries.update_contestant_field(data["cont_edit_id"], "photo_url", file_id)
    await state.clear()
    await message.answer("✅ Фото обновлено.", reply_markup=contestants_menu())


@router.message(EditContestantFSM.value, F.text)
async def edit_cont_text(message: Message, state: FSMContext):
    data = await state.get_data()
    c_id = data.get("cont_edit_id")
    field = data.get("cont_edit_field")
    value = (message.text or "").strip()
    if field == "sort_order":
        if not value.isdigit():
            await message.answer("Введите число.")
            return
        value = int(value)
    if field in ("description", "photo_url") and value.lower() in ("пропустить", "-"):
        value = ""
    queries.update_contestant_field(c_id, field, value)
    await state.clear()
    await message.answer("✅ Обновлено.", reply_markup=contestants_menu())


# ── Toggle active ─────────────────────────────────────────────────

@router.callback_query(F.data.startswith("cont_toggle_"))
async def cb_cont_toggle(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    c_id = int(callback.data.split("_")[2])
    contestant = queries.get_contestant(c_id)
    if not contestant:
        await callback.answer("Не найден")
        return
    new_val = not contestant[9]  # is_active
    queries.update_contestant_field(c_id, "is_active", new_val)
    status = "включён" if new_val else "выключен"
    await callback.answer(f"Мистер {status}")


# ── Delete ────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("cont_delete_"))
async def cb_cont_delete_ask(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    c_id = int(callback.data.split("_")[2])
    contestant = queries.get_contestant(c_id)
    if not contestant:
        await callback.answer("Не найден")
        return
    await callback.message.answer(
        f"Удалить <b>{contestant[4]}</b>?", parse_mode="HTML",
        reply_markup=confirm_delete("contdel", c_id)
    )
    await callback.answer()


@router.callback_query(F.data.startswith("contdel_confirm_"))
async def cb_cont_delete_confirm(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    c_id = int(callback.data.split("_")[2])
    queries.delete_contestant(c_id)
    await callback.answer("Удалён")
    try:
        await callback.message.edit_text("Мистер удалён.")
    except Exception:
        pass


@router.callback_query(F.data == "contdel_cancel")
async def cb_cont_delete_cancel(callback: CallbackQuery):
    await callback.answer("Отменено")
    try:
        await callback.message.edit_text("Отменено.")
    except Exception:
        pass
