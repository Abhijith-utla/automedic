"""
Seed the database with mock patients (realistic portrait photos and rich data) and past encounters.
Run from backend directory: python -m scripts.seed_patients [--force]
Requires at least one registered user; patients are assigned to the first user (doctor).
Use --force to clear existing patients (and their encounters) for that doctor and re-seed.
"""

import argparse
import random
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import SessionLocal, init_db
from app.models.patient import Patient
from app.models.encounter import Encounter
from app.models.user import User


# Realistic portrait photos (randomuser.me — consistent per index)
def portrait_url(gender: str, index: int) -> str:
    return f"https://randomuser.me/api/portraits/{gender}/{index}.jpg"


# 12 diverse mock patients: name, DOB, MRN, email, phone, notes, portrait (gender, index)
MOCK_PATIENTS = [
    {
        "name": "Emma Richardson",
        "date_of_birth": "1985-03-12",
        "mrn": "MRN-1001",
        "email": "emma.richardson@email.com",
        "phone": "(555) 201-1001",
        "notes": "HTN, well controlled on lisinopril. Allergic to penicillin. Last HbA1c 5.8.",
        "portrait": ("women", 44),
    },
    {
        "name": "James Chen",
        "date_of_birth": "1972-07-28",
        "mrn": "MRN-1002",
        "email": "james.chen@email.com",
        "phone": "(555) 201-1002",
        "notes": "Type 2 DM, metformin. Annual eye exam due next month.",
        "portrait": ("men", 32),
    },
    {
        "name": "Sofia Martinez",
        "date_of_birth": "1991-11-05",
        "mrn": "MRN-1003",
        "email": "sofia.martinez@email.com",
        "phone": "(555) 201-1003",
        "notes": "Asthma, uses albuterol PRN. No recent exacerbations.",
        "portrait": ("women", 65),
    },
    {
        "name": "Oliver Wright",
        "date_of_birth": "1968-01-19",
        "mrn": "MRN-1004",
        "email": "oliver.wright@email.com",
        "phone": "(555) 201-1004",
        "notes": "CAD s/p stent 2022. On aspirin, statin. Cardiac rehab completed.",
        "portrait": ("men", 22),
    },
    {
        "name": "Ava Thompson",
        "date_of_birth": "1995-09-22",
        "mrn": "MRN-1005",
        "email": "ava.thompson@email.com",
        "phone": "(555) 201-1005",
        "notes": "Anxiety, stable on SSRI. Prefers morning appointments.",
        "portrait": ("women", 68),
    },
    {
        "name": "Liam O'Brien",
        "date_of_birth": "1980-12-08",
        "mrn": "MRN-1006",
        "email": "liam.obrien@email.com",
        "phone": "(555) 201-1006",
        "notes": "GERD, PPI daily. No Barrett's on last EGD.",
        "portrait": ("men", 47),
    },
    {
        "name": "Isabella Kim",
        "date_of_birth": "1988-04-30",
        "mrn": "MRN-1007",
        "email": "isabella.kim@email.com",
        "phone": "(555) 201-1007",
        "notes": "Hypothyroidism, levothyroxine 75 mcg. TSH checked q6mo.",
        "portrait": ("women", 52),
    },
    {
        "name": "Noah Patel",
        "date_of_birth": "1975-06-14",
        "mrn": "MRN-1008",
        "email": "noah.patel@email.com",
        "phone": "(555) 201-1008",
        "notes": "Hyperlipidemia, atorvastatin 20 mg. Last LDL 95.",
        "portrait": ("men", 18),
    },
    {
        "name": "Mia Johnson",
        "date_of_birth": "1993-02-17",
        "mrn": "MRN-1009",
        "email": "mia.johnson@email.com",
        "phone": "(555) 201-1009",
        "notes": "Migraines, topiramate 50 mg. Trigger: stress, lack of sleep.",
        "portrait": ("women", 33),
    },
    {
        "name": "Ethan Davis",
        "date_of_birth": "1982-08-25",
        "mrn": "MRN-1010",
        "email": "ethan.davis@email.com",
        "phone": "(555) 201-1010",
        "notes": "Low back pain, PT completed. NSAIDs PRN.",
        "portrait": ("men", 56),
    },
    {
        "name": "Charlotte Wilson",
        "date_of_birth": "1978-05-11",
        "mrn": "MRN-1011",
        "email": "charlotte.wilson@email.com",
        "phone": "(555) 201-1011",
        "notes": "Osteoarthritis knees. Tylenol and topical NSAID. Considering PT.",
        "portrait": ("women", 71),
    },
    {
        "name": "Benjamin Brown",
        "date_of_birth": "1965-10-03",
        "mrn": "MRN-1012",
        "email": "benjamin.brown@email.com",
        "phone": "(555) 201-1012",
        "notes": "COPD, LABA/ICS. Flu and pneumonia vaccines up to date.",
        "portrait": ("men", 29),
    },
]

CHIEF_COMPLAINTS = [
    "Annual physical exam",
    "Chest pain and shortness of breath — evaluation",
    "Persistent headache, 3 days",
    "Follow-up for hypertension",
    "Upper respiratory infection",
    "Knee pain after fall",
    "Routine diabetes check",
    "Fatigue and dizziness",
    "Chronic low back pain",
    "Allergy follow-up",
    "Medication refill",
    "Pre-op clearance",
    "Asthma exacerbation",
    "GERD symptoms",
    "Thyroid follow-up",
    "Migraine follow-up",
    "Lipid panel review",
    "Wellness visit",
]


def main():
    parser = argparse.ArgumentParser(description="Seed mock patients and encounters.")
    parser.add_argument("--force", action="store_true", help="Clear existing patients for this doctor and re-seed")
    args = parser.parse_args()

    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("No user found. Register a user first (e.g. via the app), then run this script again.")
            return 1
        doctor_id = user.id
        print(f"Seeding patients for doctor: {user.email} ({doctor_id})")

        existing = db.query(Patient).filter(Patient.doctor_id == doctor_id).count()
        if existing > 0:
            if args.force:
                patient_ids = [p.id for p in db.query(Patient).filter(Patient.doctor_id == doctor_id).all()]
                deleted_encounters = db.query(Encounter).filter(Encounter.patient_id.in_(patient_ids)).delete(synchronize_session=False)
                deleted_patients = db.query(Patient).filter(Patient.doctor_id == doctor_id).delete()
                db.commit()
                print(f"Cleared {deleted_patients} patient(s) and {deleted_encounters} encounter(s). Re-seeding…")
            else:
                print(f"You already have {existing} patient(s). Skipping seed to avoid duplicates.")
                print("To re-seed, run: python -m scripts.seed_patients --force")
                return 0

        now = datetime.utcnow()
        created_patients = []

        for m in MOCK_PATIENTS:
            patient_id = str(uuid.uuid4())
            gender, idx = m["portrait"]
            photo_url = portrait_url(gender, idx)
            p = Patient(
                id=patient_id,
                doctor_id=doctor_id,
                name=m["name"],
                date_of_birth=m["date_of_birth"],
                mrn=m["mrn"],
                email=m["email"],
                phone=m["phone"],
                notes=m["notes"],
                photo_url=photo_url,
            )
            db.add(p)
            created_patients.append((p, 3 + random.randint(0, 3)))  # 3–6 encounters each

        db.commit()

        for patient, num_encounters in created_patients:
            for _ in range(num_encounters):
                started = now - timedelta(days=random.randint(14, 220))
                ended = started + timedelta(minutes=random.randint(20, 50))
                e = Encounter(
                    id=str(uuid.uuid4()),
                    patient_id=patient.id,
                    doctor_id=doctor_id,
                    status="ended",
                    started_at=started,
                    ended_at=ended,
                    chief_complaint=random.choice(CHIEF_COMPLAINTS),
                )
                db.add(e)
        db.commit()
        print(f"Created {len(created_patients)} patients with past encounter records.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
