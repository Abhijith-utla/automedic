"""Auth API: register, login, logout, me."""

import uuid
from fastapi import APIRouter, Cookie, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, UserResponse
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token

router = APIRouter()

COOKIE_NAME = "automedic_token"
COOKIE_MAX_AGE = 7 * 24 * 3600  # 7 days
COOKIE_HTTP_ONLY = True
COOKIE_SAMESITE = "lax"
COOKIE_PATH = "/"  # Required so cookie is sent for all /api/* when using Vite proxy


def get_token(automedic_token: str | None = Cookie(None, alias=COOKIE_NAME)) -> str | None:
    return automedic_token


def get_current_user_id(
    token: str | None = Depends(get_token),
    db: Session = Depends(get_db),
) -> str:
    """Dependency: require valid token and return user id."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user_id


@router.post("/auth/register", response_model=UserResponse)
def register(body: UserRegister, db: Session = Depends(get_db)):
    """Register a new doctor user."""
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/login", response_model=UserResponse)
def login(
    body: UserLogin,
    db: Session = Depends(get_db),
):
    """Login; sets HTTPOnly cookie with JWT."""
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(subject=user.id)
    response = JSONResponse(content={"id": user.id, "email": user.email, "full_name": user.full_name})
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=COOKIE_HTTP_ONLY,
        samesite=COOKIE_SAMESITE,
        secure=False,
        path=COOKIE_PATH,
    )
    return response


@router.post("/auth/logout")
def logout():
    """Clear auth cookie."""
    response = JSONResponse(content={"ok": True})
    response.delete_cookie(COOKIE_NAME, path=COOKIE_PATH)
    return response


@router.get("/auth/me", response_model=UserResponse)
def me(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Current user. 401 if not logged in."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
