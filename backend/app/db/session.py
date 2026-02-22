"""Database session and engine."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db.base import Base

# SQLite: use three slashes for relative path so file is created in cwd
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency: yield a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Call on startup."""
    Base.metadata.create_all(bind=engine)
    if "sqlite" in settings.DATABASE_URL:
        _sqlite_migrate_add_report_columns(engine)
        _sqlite_migrate_patient_contact(engine)


def _sqlite_migrate_add_report_columns(eng):
    """Add report_accepted_at and follow_up_json to encounters if missing."""
    from sqlalchemy import text
    with eng.connect() as c:
        r = c.execute(text("PRAGMA table_info(encounters)"))
        cols = [row[1] for row in r.fetchall()]
        if "report_accepted_at" not in cols:
            c.execute(text("ALTER TABLE encounters ADD COLUMN report_accepted_at DATETIME"))
        if "follow_up_json" not in cols:
            c.execute(text("ALTER TABLE encounters ADD COLUMN follow_up_json JSON"))
        if "agent_report_json" not in cols:
            c.execute(text("ALTER TABLE encounters ADD COLUMN agent_report_json JSON"))
        c.commit()


def _sqlite_migrate_patient_contact(eng):
    """Add email and phone to patients if missing."""
    from sqlalchemy import text
    with eng.connect() as c:
        r = c.execute(text("PRAGMA table_info(patients)"))
        cols = [row[1] for row in r.fetchall()]
        if "email" not in cols:
            c.execute(text("ALTER TABLE patients ADD COLUMN email VARCHAR(255)"))
        if "phone" not in cols:
            c.execute(text("ALTER TABLE patients ADD COLUMN phone VARCHAR(50)"))
        if "photo_url" not in cols:
            c.execute(text("ALTER TABLE patients ADD COLUMN photo_url VARCHAR(512)"))
        c.commit()
