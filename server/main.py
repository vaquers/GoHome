"""Entry point for the backend server."""
import uvicorn
from server.config import BACKEND_PORT

if __name__ == "__main__":
    uvicorn.run("server.app:app", host="0.0.0.0", port=BACKEND_PORT, reload=True)
