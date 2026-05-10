from aiogram.fsm.state import State, StatesGroup


class AddRouteFSM(StatesGroup):
    category = State()
    route_number = State()
    direction = State()
    stop_from = State()
    stop_to = State()
