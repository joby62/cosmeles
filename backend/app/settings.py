from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_env: str = "dev"
    cors_origins: str = "http://localhost:3000"

    storage_dir: str = "./storage"
    database_url: str = "sqlite:///./storage/app.db"

    doubao_mode: str = "mock"  # mock | real
    doubao_api_key: str = ""
    doubao_endpoint: str = ""
    doubao_model: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
