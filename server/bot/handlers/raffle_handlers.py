"""Raffle handlers for the admin bot."""
import random
from aiogram import Router, F
from aiogram.types import CallbackQuery

from server.config import SUPER_ADMIN_ID
from server.db import queries
from server.bot.keyboards.menus import raffle_menu

router = Router(name="raffle")

HALL_ROWS = {
    1: 18, 2: 18, 3: 20, 4: 21, 5: 22, 6: 23, 7: 24, 8: 24, 9: 24, 10: 24,
    11: 19, 12: 20, 13: 20, 14: 26, 15: 26, 16: 26, 17: 26, 18: 26,
    19: 26, 20: 26, 21: 26, 22: 26, 23: 26, 24: 26, 25: 20, 26: 20,
}


def is_admin(user_id: int) -> bool:
    return user_id == SUPER_ADMIN_ID


def _get_active_event():
    ev = queries.get_active_event()
    return ev


@router.callback_query(F.data == "menu_raffle")
async def cb_raffle_menu(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Нет доступа")
        return
    ev = _get_active_event()
    if not ev:
        await callback.answer("Нет активного конкурса")
        return
    raffle = queries.get_active_raffle(ev[0])
    is_active = raffle and raffle[2]
    text = "🎰 <b>Розыгрыш</b>\n\n"
    if is_active and raffle[3]:
        text += f"Текущий победитель: Ряд {raffle[3]}, Место {raffle[4]}"
    elif is_active:
        text += "Розыгрыш запущен. Нажмите «Крутить» для выбора победителя."
    else:
        text += "Розыгрыш не запущен."
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=raffle_menu(is_active))
    await callback.answer()


@router.callback_query(F.data == "raffle_start")
async def cb_raffle_start(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Нет доступа")
        return
    ev = _get_active_event()
    if not ev:
        await callback.answer("Нет активного конкурса")
        return
    queries.stop_raffle(ev[0])
    queries.create_raffle(ev[0])

    # Bump raffle version via the API module
    from server.app import _bump_raffle_version
    try:
        _bump_raffle_version()
    except Exception:
        pass

    await callback.message.edit_text(
        "🎰 <b>Розыгрыш</b>\n\nРозыгрыш запущен! Нажмите «Крутить» для выбора победителя.",
        parse_mode="HTML",
        reply_markup=raffle_menu(True),
    )
    await callback.answer("Розыгрыш запущен!")


@router.callback_query(F.data.in_({"raffle_spin", "raffle_respin"}))
async def cb_raffle_spin(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Нет доступа")
        return
    ev = _get_active_event()
    if not ev:
        await callback.answer("Нет активного конкурса")
        return
    raffle = queries.get_active_raffle(ev[0])
    if not raffle:
        await callback.answer("Розыгрыш не запущен")
        return

    # Pick random row weighted by seats, then random seat
    rows_list = []
    for r, seats in HALL_ROWS.items():
        rows_list.extend([r] * seats)
    winner_row = random.choice(rows_list)
    winner_seat = random.randint(1, HALL_ROWS[winner_row])

    queries.set_raffle_winner(raffle[0], winner_row, winner_seat)

    from server.app import _bump_raffle_version
    try:
        _bump_raffle_version()
    except Exception:
        pass

    await callback.message.edit_text(
        f"🎰 <b>Розыгрыш</b>\n\n🎉 Победитель: <b>Ряд {winner_row}, Место {winner_seat}</b>",
        parse_mode="HTML",
        reply_markup=raffle_menu(True),
    )
    await callback.answer(f"Ряд {winner_row}, Место {winner_seat}")


@router.callback_query(F.data == "raffle_stop")
async def cb_raffle_stop(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Нет доступа")
        return
    ev = _get_active_event()
    if not ev:
        await callback.answer("Нет активного конкурса")
        return
    queries.stop_raffle(ev[0])

    from server.app import _bump_raffle_version
    try:
        _bump_raffle_version()
    except Exception:
        pass

    await callback.message.edit_text(
        "🎰 <b>Розыгрыш</b>\n\nРозыгрыш остановлен.",
        parse_mode="HTML",
        reply_markup=raffle_menu(False),
    )
    await callback.answer("Розыгрыш остановлен")
