from aiogram.fsm.state import State, StatesGroup


class CreateEventFSM(StatesGroup):
    year = State()
    title = State()
    contest_type = State()
    accent_color = State()
    classes = State()


class EditEventFSM(StatesGroup):
    field = State()
    value = State()


class AddContestantFSM(StatesGroup):
    name = State()
    surname = State()
    display_name = State()
    profile = State()
    description = State()
    photo = State()
    sort_order = State()


class EditContestantFSM(StatesGroup):
    value = State()


class EditTextFSM(StatesGroup):
    key = State()
    value = State()


class AddTextFSM(StatesGroup):
    key = State()
    value = State()


class AddVoterFSM(StatesGroup):
    data = State()


class ImportVotersFSM(StatesGroup):
    data = State()


class AddResultsAdminFSM(StatesGroup):
    tg_id = State()
