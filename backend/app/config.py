"""
Application configuration via environment variables.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    """Loaded from env or .env file."""

    API_HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"]
    DATABASE_URL: str = "sqlite:///./automedic.db"
    SECRET_KEY: str = "change-me-in-production-use-env"

    # Email: SendGrid (recommended) or SMTP
    SENDGRID_API_KEY: str = ""  # If set, use SendGrid for patient emails
    EMAIL_FROM: str = "noreply@automedic.example.com"  # From address (must be verified in SendGrid)

    @field_validator(
        "SENDGRID_API_KEY", "EMAIL_FROM", "EMAIL_FROM_NAME",
        "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM",
        mode="before",
    )
    @classmethod
    def strip_str(cls, v):
        if v is None:
            return ""
        if isinstance(v, str):
            return v.strip()
        return v
    EMAIL_FROM_NAME: str = "Automedic"
    # Fallback: SMTP (Gmail or other). Used when SENDGRID_API_KEY is not set.
    # For Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, use App Password for SMTP_PASSWORD.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@automedic.example.com"
    SMTP_SSL_VERIFY: bool = True  # Set False only if you get SSL certificate errors (e.g. local/dev).
    EMAIL_ENABLED: bool = False  # If False, emails are logged only (mock). Set True when using SendGrid or SMTP.

    # Voice: Twilio for automated patient calls
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    CALL_ENABLED: bool = False  # If False, call is logged only (mock)
    # Public URL of this backend (e.g. https://your-ngrok-url.ngrok.io). Twilio will GET this to get TwiML.
    PUBLIC_BASE_URL: str = ""

    # Placeholders for future integration
    # OPENAI_API_KEY: str = ""
    # WHISPER_MODEL: str = "base"
    # BERT_MODEL_PATH: str = ""
    # ARDUINO_WS_URL: str = ""
    # LLM provider config (used by clinical report pipeline)
    LLM_PROVIDER: str = "ollama"  # ollama | gemini
    GEMINI_API_KEY: str = ""
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"
    FEATHERLESS_API_KEY: str = ""
    TRIAGE_PIPELINE_TRIAGE_MODEL: str = "mistral"
    TRIAGE_PIPELINE_CARE_MODEL: str = "mistral"
    PARSER_AGENT_MODEL: str = "mistral"
    TRIAGE_PIPELINE_TRIAGE_TOKENS: int = 320
    TRIAGE_PIPELINE_CARE_TOKENS: int = 480
    TRIAGE_PIPELINE_REQUEST_TIMEOUT_SEC: int = 300
    OLLAMA_NUM_CTX: int = 1536
    MODEL_WARMUP_ON_START: bool = False
    PI_WS_URL: str = ""
    PI_WS_ENCOUNTER_ID: str = ""
    PI_WS_AUTO_START: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
