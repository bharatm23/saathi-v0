from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    openai_api_key: str
    llama_cloud_api_key: str
    langchain_api_key: str = ""
    langchain_tracing_v2: str = "false"
    langchain_project: str = "saathi-phase0"
    openclaw_endpoint: str = ""
    openclaw_secret: str = ""
    environment: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
