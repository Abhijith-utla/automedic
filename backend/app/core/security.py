"""Password hashing and JWT."""

import bcrypt
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# bcrypt only accepts up to 72 bytes
BCRYPT_MAX_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    b = password.encode("utf-8")
    return b[:BCRYPT_MAX_BYTES] if len(b) > BCRYPT_MAX_BYTES else b


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to_bcrypt_bytes(plain), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
