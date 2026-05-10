"""GoHome Telegram bot entry point."""
import asyncio
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand

from server.config import BOT_TOKEN
from server.bot.handlers import gohome_handler


async def main():
    if not BOT_TOKEN:
        print("ERROR: BOT_TOKEN is not set")
        return

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())

    dp.include_router(gohome_handler.router)

    await bot.set_my_commands([
        BotCommand(command="start", description="Главное меню"),
    ])

    print("GoHome bot started")
    await dp.start_polling(bot, allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    asyncio.run(main())
