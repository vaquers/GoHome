from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton


def main_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏆 Конкурсы", callback_data="menu_events")],
        [InlineKeyboardButton(text="👔 Мистеры", callback_data="menu_contestants")],
        [InlineKeyboardButton(text="📝 Тексты", callback_data="menu_texts")],
        [InlineKeyboardButton(text="👥 Голосующие", callback_data="menu_voters")],
        [InlineKeyboardButton(text="📊 Результаты", callback_data="menu_results")],
        [InlineKeyboardButton(text="🎰 Розыгрыш", callback_data="menu_raffle")],
    ])


def events_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Список конкурсов", callback_data="events_list")],
        [InlineKeyboardButton(text="➕ Создать конкурс", callback_data="events_create")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu_main")],
    ])


def event_actions(event_id, ev):
    voting = "🟢" if ev[4] else "🔴"
    interviews = "🟢" if ev[5] else "🔴"
    tapbar = "🟢" if ev[6] else "🔴"
    results = "🟢" if ev[7] else "🔴"
    contest_type = ev[8] if len(ev) > 8 else "person"
    type_label = "🏫 Классы" if contest_type == "class" else "👤 Люди"
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Сделать активным", callback_data=f"ev_activate_{event_id}")],
        [InlineKeyboardButton(text="✏️ Год", callback_data=f"ev_edit_{event_id}_year"),
         InlineKeyboardButton(text="✏️ Название", callback_data=f"ev_edit_{event_id}_title")],
        [InlineKeyboardButton(text=f"{voting} Голосование", callback_data=f"ev_toggle_{event_id}_voting_enabled")],
        [InlineKeyboardButton(text=f"{results} Результаты видны всем", callback_data=f"ev_toggle_{event_id}_results_visible")],
        [InlineKeyboardButton(text=f"{interviews} Интервью", callback_data=f"ev_toggle_{event_id}_interviews_enabled")],
        [InlineKeyboardButton(text=f"{tapbar} Tapbar", callback_data=f"ev_toggle_{event_id}_tapbar_enabled")],
        [InlineKeyboardButton(text=f"Тип: {type_label}", callback_data=f"ev_info_{event_id}"),
         InlineKeyboardButton(text="🎨 Цвет", callback_data=f"ev_color_{event_id}")],
        [InlineKeyboardButton(text="👁 Admins результатов", callback_data=f"results_admins_list")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu_events")],
    ])


def contestants_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Список мистеров", callback_data="cont_list")],
        [InlineKeyboardButton(text="➕ Добавить мистера", callback_data="cont_add")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu_main")],
    ])


def contestant_actions(c_id):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✏️ Имя", callback_data=f"cont_edit_{c_id}_name"),
         InlineKeyboardButton(text="✏️ Фамилия", callback_data=f"cont_edit_{c_id}_surname")],
        [InlineKeyboardButton(text="✏️ Отображаемое имя", callback_data=f"cont_edit_{c_id}_display_name")],
        [InlineKeyboardButton(text="✏️ Профиль/класс", callback_data=f"cont_edit_{c_id}_profile"),
         InlineKeyboardButton(text="✏️ Описание", callback_data=f"cont_edit_{c_id}_description")],
        [InlineKeyboardButton(text="🖼 Фото", callback_data=f"cont_edit_{c_id}_photo_url"),
         InlineKeyboardButton(text="🔢 Порядок", callback_data=f"cont_edit_{c_id}_sort_order")],
        [InlineKeyboardButton(text="👁 Вкл/Выкл", callback_data=f"cont_toggle_{c_id}")],
        [InlineKeyboardButton(text="🗑 Удалить", callback_data=f"cont_delete_{c_id}")],
    ])


def texts_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Список текстов", callback_data="texts_list")],
        [InlineKeyboardButton(text="➕ Добавить текст", callback_data="texts_add")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu_main")],
    ])


def voters_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Список голосующих", callback_data="voters_list")],
        [InlineKeyboardButton(text="➕ Добавить пользователя", callback_data="voters_add")],
        [InlineKeyboardButton(text="📥 Импорт списка", callback_data="voters_import")],
        [InlineKeyboardButton(text="📊 Кто проголосовал", callback_data="voters_voted")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu_main")],
    ])


def raffle_menu(is_active=False):
    if is_active:
        return InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🎲 Крутить", callback_data="raffle_spin")],
            [InlineKeyboardButton(text="🔄 Перекрутить", callback_data="raffle_respin")],
            [InlineKeyboardButton(text="⏹ Остановить розыгрыш", callback_data="raffle_stop")],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="menu_main")],
        ])
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="▶️ Начать розыгрыш", callback_data="raffle_start")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu_main")],
    ])


def confirm_delete(callback_prefix, item_id):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Да, удалить", callback_data=f"{callback_prefix}_confirm_{item_id}"),
         InlineKeyboardButton(text="Отмена", callback_data=f"{callback_prefix}_cancel")],
    ])
