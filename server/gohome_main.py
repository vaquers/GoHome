"""Entry point for the GoHome backend server."""
import uvicorn
from server.config import BACKEND_PORT

if __name__ == "__main__":
    uvicorn.run("server.gohome_app:app", host="0.0.0.0", port=BACKEND_PORT, reload=True)
