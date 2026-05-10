"""Telegram admin bot entry point."""
import asyncio
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand

from server.config import BOT_TOKEN
from server.bot.handlers import main_handler, event_handlers, contestant_handlers, text_handlers, voter_handlers, raffle_handlers


async def main():
    if not BOT_TOKEN:
        print("ERROR: BOT_TOKEN is not set")
        return

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())

    dp.include_router(main_handler.router)
    dp.include_router(event_handlers.router)
    dp.include_router(contestant_handlers.router)
    dp.include_router(text_handlers.router)
    dp.include_router(voter_handlers.router)
    dp.include_router(raffle_handlers.router)

    await bot.set_my_commands([
        BotCommand(command="start", description="Открыть админ-панель"),
    ])

    print("Bot started")
    await dp.start_polling(bot, allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    asyncio.run(main())
