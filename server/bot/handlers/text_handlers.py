"""App text management handlers."""
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext

from server.config import SUPER_ADMIN_ID
from server.db import queries
from server.bot.keyboards.menus import texts_menu, confirm_delete
from server.bot.states.states import EditTextFSM, AddTextFSM

router = Router(name="texts")


def is_admin(user_id: int) -> bool:
    return user_id == SUPER_ADMIN_ID


def _get_active_event_id():
    ev = queries.get_active_event()
    return ev[0] if ev else None


TEXT_LABELS = {
    "main_title": "Заголовок (экран голосования)",
    "subtitle": "Подзаголовок",
    "vote_button_text": "Текст кнопки «Голосовать»",
    "results_title": "Заголовок результатов",
    "auth_title": "Заголовок формы входа",
    "auth_subtitle": "Подзаголовок формы входа",
    "guest_label": "Кнопка «Войти как гость»",
    "voting_closed": "Сообщение «голосование закрыто»",
    "thank_you_title": "Заголовок после голосования",
    "thank_you_text": "Текст после голосования",
}


@router.callback_query(F.data == "texts_list")
async def cb_texts_list(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    event_id = _get_active_event_id()
    if not event_id:
        await callback.message.answer("Нет активного конкурса.")
        await callback.answer()
        return
    rows = queries.get_app_texts(event_id)
    if not rows:
        await callback.message.answer("Текстов пока нет.", reply_markup=texts_menu())
        await callback.answer()
        return

    lines = []
    for key, value in rows:
        label = TEXT_LABELS.get(key, key)
        preview = value[:60] + "…" if len(value) > 60 else value
        lines.append(f"<b>{label}</b>\n└ {preview}")

    text = "\n\n".join(lines)
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"✏️ {TEXT_LABELS.get(key, key)}", callback_data=f"text_edit_{key}")]
        for key, _ in rows
    ] + [
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu_texts")]
    ])
    await callback.message.answer(text, parse_mode="HTML", reply_markup=keyboard)
    await callback.answer()


@router.callback_query(F.data.startswith("text_edit_"))
async def cb_text_edit(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    key = callback.data[len("text_edit_"):]
    event_id = _get_active_event_id()
    if not event_id:
        await callback.answer("Нет активного конкурса")
        return
    current = queries.get_app_text(event_id, key)
    current_val = current[0] if current else ""
    await state.update_data(text_key=key, event_id=event_id)
    await state.set_state(EditTextFSM.value)
    label = TEXT_LABELS.get(key, key)
    await callback.message.answer(
        f"<b>{label}</b>\n\nТекущее значение:\n{current_val}\n\nВведите новое значение:",
        parse_mode="HTML"
    )
    await callback.answer()


@router.message(EditTextFSM.value, F.text)
async def edit_text_value(message: Message, state: FSMContext):
    data = await state.get_data()
    queries.set_app_text(data["event_id"], data["text_key"], (message.text or "").strip())
    await state.clear()
    await message.answer(f"✅ Текст «{data['text_key']}» обновлён.", reply_markup=texts_menu())


@router.callback_query(F.data == "texts_add")
async def cb_text_add(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    event_id = _get_active_event_id()
    if not event_id:
        await callback.answer("Нет активного конкурса")
        return
    await state.update_data(event_id=event_id)
    await state.set_state(AddTextFSM.key)
    await callback.message.answer("Введите ключ нового текста (например: welcome_message):")
    await callback.answer()


@router.message(AddTextFSM.key, F.text)
async def add_text_key(message: Message, state: FSMContext):
    key = (message.text or "").strip()
    if not key:
        await message.answer("Ключ не может быть пустым.")
        return
    await state.update_data(text_key=key)
    await state.set_state(AddTextFSM.value)
    await message.answer("Введите значение:")


@router.message(AddTextFSM.value, F.text)
async def add_text_value(message: Message, state: FSMContext):
    data = await state.get_data()
    queries.set_app_text(data["event_id"], data["text_key"], (message.text or "").strip())
    await state.clear()
    await message.answer(f"✅ Текст «{data['text_key']}» добавлен.", reply_markup=texts_menu())


@router.callback_query(F.data.startswith("text_delete_"))
async def cb_text_delete(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("⛔")
        return
    key = callback.data[len("text_delete_"):]
    event_id = _get_active_event_id()
    if not event_id:
        await callback.answer("Нет активного конкурса")
        return
    queries.delete_app_text(event_id, key)
    await callback.answer(f"Текст «{key}» удалён")
    try:
        await callback.message.edit_text(f"Текст «{key}» удалён.")
    except Exception:
        pass
