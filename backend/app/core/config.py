# backend/app/core/config.py
import os  # Import os module
from pathlib import Path  # Import Path
from typing import List, Union

from pydantic.networks import AnyHttpUrl, HttpUrl
from pydantic_settings import (  # Import SettingsConfigDict for newer Pydantic
    BaseSettings,
    SettingsConfigDict,
)

# Determine the base directory of your 'backend' application
# This assumes config.py is in backend/app/core/
# So, Path(__file__).resolve() -> backend/app/core/config.py
# .parent -> backend/app/core/
# .parent -> backend/app/
# .parent -> backend/
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "Dental X-ray DICOM Viewer"
    API_VERSION: str = "0.1.0"
    API_STR: str = "/api/v1"
    ROBOFLOW_API_KEY: Union[str, None] = None
    # OPENAI_API_KEY: Union[str, None] = None

    CORS_ORIGINS: List[Union[AnyHttpUrl, str]] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://daant-zydm-git-master-steppes-projects.vercel.app",
        "https://daant-zydm.vercel.app",
    ]

    UVICORN_HOST: str = "0.0.0.0"
    UVICORN_PORT: int = 8000
    UVICORN_RELOAD: bool = True

    # For Pydantic V2 (pydantic-settings)
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR
        / ".env",  # Construct absolute path to .env in backend directory
        env_file_encoding="utf-8",
        extra="ignore",  # Good practice
    )

    # For Pydantic V1 (if still using older pydantic for settings)
    # class Config:
    #     env_file = str(BACKEND_DIR / ".env") # Convert Path object to string for Pydantic V1
    #     env_file_encoding = "utf-8"
    #     extra = "ignore"


settings = Settings()

print(f"--- [config.py] Attempting to load .env from: {str(BACKEND_DIR / '.env')}")
print(
    f"--- [config.py] Loaded ROBOFLOW_API_KEY: '{settings.ROBOFLOW_API_KEY}' (is set: {bool(settings.ROBOFLOW_API_KEY)})"
)
# print(f"--- [config.py] Loaded OPENAI_API_KEY: '{settings.OPENAI_API_KEY}' (is set: {bool(settings.OPENAI_API_KEY)})")
