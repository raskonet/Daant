from typing import List, Union

from pydantic.networks import AnyHttpUrl, HttpUrl
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Dental X-ray DICOM Viewer"
    API_VERSION: str = "0.1.0"
    API_STR: str = "/api/v1"

    CORS_ORIGINS: List[Union[AnyHttpUrl, str]] = [
        "http://localhost:3000",
        "http://localhost:3001",
        # "http://192.168.1.7:3000",
        # "http://192.168.1.7:3001",
        "https://daant-zydm-git-master-steppes-projects.vercel.app",
    ]

    UVICORN_HOST: str = "0.0.0.0"
    UVICORN_PORT: int = 8000
    UVICORN_RELOAD: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
