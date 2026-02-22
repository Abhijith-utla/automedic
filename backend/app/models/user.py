"""User (doctor) model."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    patients = relationship("Patient", back_populates="doctor")
    encounters = relationship("Encounter", back_populates="doctor")
