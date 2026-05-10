import os

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
SUPER_ADMIN_ID = int(os.environ.get("SUPER_ADMIN_ID", "0"))
BACKEND_PORT = int(os.environ.get("BACKEND_PORT", "8000"))
