"""Main handler: /start and main menu navigation."""
from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton

from server.config import SUPER_ADMIN_ID
from server.bot.keyboards.menus import main_menu, events_menu, contestants_menu, texts_menu, voters_menu

router = Router(name="main")


def is_admin(user_id: int) -> bool:
    return user_id == SUPER_ADMIN_ID


@router.message(Command("start"))
async def cmd_start(message: Message):
    if not is_admin(message.from_user.id):
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🏆 Открыть голосование", url="https://t.me/mister_lyceum_bot?startapp")]
        ])
        await message.answer("Здравствуйте! Открывайте приложение по кнопке ниже 👇", reply_markup=kb)
        return
    await message.answer("🏠 <b>Админ-панель</b>", parse_mode="HTML", reply_markup=main_menu())


@router.callback_query(F.data == "menu_main")
async def cb_main_menu(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Нет доступа")
        return
    await callback.message.edit_text("🏠 <b>Админ-панель</b>", parse_mode="HTML", reply_markup=main_menu())
    await callback.answer()


@router.callback_query(F.data == "menu_events")
async def cb_events_menu(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Нет доступа")
        return
    await callback.message.edit_text("🏆 <b>Управление конкурсами</b>", parse_mode="HTML", reply_markup=events_menu())
    await callback.answer()


@router.callback_query(F.data == "menu_contestants")
async def cb_contestants_menu(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Нет доступа")
        return
    await callback.message.edit_text("👔 <b>Управление мистерами</b>", parse_mode="HTML", reply_markup=contestants_menu())
    await callback.answer()


@router.callback_query(F.data == "menu_texts")
async def cb_texts_menu(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Нет доступа")
        return
    await callback.message.edit_text("📝 <b>Управление текстами</b>", parse_mode="HTML", reply_markup=texts_menu())
    await callback.answer()


@router.callback_query(F.data == "menu_voters")
async def cb_voters_menu(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔ Нет доступа")
        return
    await callback.message.edit_text("👥 <b>Управление голосующими</b>", parse_mode="HTML", reply_markup=voters_menu())
    await callback.answer()
