"""Voter management and results handlers."""
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext

from server.config import SUPER_ADMIN_ID
from server.db import queries
from server.bot.keyboards.menus import voters_menu
from server.bot.states.states import AddVoterFSM, ImportVotersFSM

router = Router(name="voters")


def is_admin(user_id: int) -> bool:
    return user_id == SUPER_ADMIN_ID


def _get_active_event_id():
    ev = queries.get_active_event()
    return ev[0] if ev else None


# ── List voters ───────────────────────────────────────────────────

@router.callback_query(F.data == "voters_list")
async def cb_voters_list(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    event_id = _get_active_event_id()
    if not event_id:
        await callback.message.answer("Нет активного конкурса.")
        await callback.answer()
        return
    rows = queries.get_all_voters(event_id)
    if not rows:
        await callback.message.answer("Голосующих пока нет.", reply_markup=voters_menu())
        await callback.answer()
        return

    chunks = []
    current = []
    for r in rows:
        access = "✅" if r[5] else "❌"
        voted = "🗳" if r[6] else "—"
        guest = " (гость)" if r[4] else ""
        line = f"{access} {voted} {r[1]} {r[2]} ({r[3]}){guest}"
        current.append(line)
        if len(current) >= 30:
            chunks.append("\n".join(current))
            current = []
    if current:
        chunks.append("\n".join(current))

    for chunk in chunks:
        await callback.message.answer(f"<pre>{chunk}</pre>", parse_mode="HTML")
    await callback.message.answer(f"Всего: {len(rows)}", reply_markup=voters_menu())
    await callback.answer()


# ── Add voter ─────────────────────────────────────────────────────

@router.callback_query(F.data == "voters_add")
async def cb_voters_add(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    event_id = _get_active_event_id()
    if not event_id:
        await callback.message.answer("Нет активного конкурса.")
        await callback.answer()
        return
    await state.update_data(event_id=event_id)
    await state.set_state(AddVoterFSM.data)
    await callback.message.answer(
        "Введите данные пользователя в формате:\n"
        "<code>Имя Фамилия Профиль</code>\n"
        "Например: <code>Иван Петров 10А</code>",
        parse_mode="HTML"
    )
    await callback.answer()


@router.message(AddVoterFSM.data, F.text)
async def add_voter_data(message: Message, state: FSMContext):
    parts = (message.text or "").strip().split()
    if len(parts) < 2:
        await message.answer("Формат: Имя Фамилия [Профиль]")
        return
    data = await state.get_data()
    first_name = parts[0]
    last_name = parts[1]
    profile = parts[2] if len(parts) > 2 else ""
    row = queries.add_voter_with_access(data["event_id"], first_name, last_name, profile)
    await state.clear()
    if row:
        await message.answer(f"✅ {first_name} {last_name} добавлен(а) (id={row[0]}).", reply_markup=voters_menu())
    else:
        await message.answer("Ошибка при добавлении.")


# ── Import voters ─────────────────────────────────────────────────

@router.callback_query(F.data == "voters_import")
async def cb_voters_import(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    event_id = _get_active_event_id()
    if not event_id:
        await callback.message.answer("Нет активного конкурса.")
        await callback.answer()
        return
    await state.update_data(event_id=event_id)
    await state.set_state(ImportVotersFSM.data)
    await callback.message.answer(
        "Отправьте список пользователей, по одному на строку:\n"
        "<code>Имя Фамилия Профиль</code>\n\n"
        "Например:\n"
        "<code>Иван Петров 10А\nМария Сидорова 11Б\nАлексей Козлов 10В</code>",
        parse_mode="HTML"
    )
    await callback.answer()


@router.message(ImportVotersFSM.data, F.text)
async def import_voters_data(message: Message, state: FSMContext):
    data = await state.get_data()
    event_id = data["event_id"]
    lines = (message.text or "").strip().split("\n")
    added = 0
    errors = 0
    for line in lines:
        parts = line.strip().split()
        if len(parts) < 2:
            errors += 1
            continue
        first_name = parts[0]
        last_name = parts[1]
        profile = parts[2] if len(parts) > 2 else ""
        row = queries.add_voter_with_access(event_id, first_name, last_name, profile)
        if row:
            added += 1
        else:
            errors += 1
    await state.clear()
    await message.answer(
        f"✅ Импорт завершён: добавлено {added}, ошибок {errors}.",
        reply_markup=voters_menu()
    )


# ── Voted list ────────────────────────────────────────────────────

@router.callback_query(F.data == "voters_voted")
async def cb_voters_voted(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    event_id = _get_active_event_id()
    if not event_id:
        await callback.message.answer("Нет активного конкурса.")
        await callback.answer()
        return
    rows = queries.get_voted_voters(event_id)
    if not rows:
        await callback.message.answer("Пока никто не проголосовал.", reply_markup=voters_menu())
        await callback.answer()
        return

    lines = []
    for r in rows:
        guest = " (гость)" if r[3] else ""
        lines.append(f"{r[0]} {r[1]} ({r[2]}){guest} → {r[4]}")

    chunks = []
    current = []
    for line in lines:
        current.append(line)
        if len(current) >= 30:
            chunks.append("\n".join(current))
            current = []
    if current:
        chunks.append("\n".join(current))

    for chunk in chunks:
        await callback.message.answer(f"<pre>{chunk}</pre>", parse_mode="HTML")
    await callback.message.answer(f"Всего проголосовало: {len(rows)}", reply_markup=voters_menu())
    await callback.answer()


# ── Results ───────────────────────────────────────────────────────

@router.callback_query(F.data == "menu_results")
async def cb_results(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    event_id = _get_active_event_id()
    if not event_id:
        await callback.message.answer("Нет активного конкурса.")
        await callback.answer()
        return
    rows = queries.get_results(event_id)
    total = queries.get_total_votes(event_id)
    if not rows:
        await callback.message.answer("Результатов пока нет.")
        await callback.answer()
        return

    lines = ["📊 <b>Результаты голосования</b>\n"]
    for r in rows:
        votes = r[3]
        pct = round(votes / total * 100, 1) if total > 0 else 0
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        lines.append(f"<b>{r[1]}</b>: {votes} ({pct}%)\n{bar}")
    lines.append(f"\nВсего голосов: {total}")

    from server.bot.keyboards.menus import main_menu
    await callback.message.answer("\n".join(lines), parse_mode="HTML", reply_markup=main_menu())
    await callback.answer()
