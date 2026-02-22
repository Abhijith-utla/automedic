"""
Automated agent call to patient: talks about conditions and answers questions about the report.
Uses Twilio when configured; otherwise builds context and logs (mock) for development.
"""

from app.config import settings


def build_agent_context(
    patient_name: str,
    chief_complaint: str,
    patient_headline: str,
    patient_summary: str,
    steps: list,
    doctor_note: str = "",
) -> str:
    """Build script/context for the voice agent to use when talking to the patient."""
    steps_text = "\n".join(f"- {s}" for s in steps) if steps else "None specified."
    note_line = f"\nMessage from your doctor: {doctor_note}" if doctor_note else ""
    return f"""You are an automated assistant calling the patient about their recent visit summary.

Patient name: {patient_name}

Reason for visit: {chief_complaint}

Summary for the patient: {patient_headline}. {patient_summary}

Next steps they should follow:
{steps_text}
{note_line}

Your role: Briefly explain the visit summary in plain language, then ask if they have any questions about their condition, medications, or next steps. Answer their questions based on this summary. Be supportive and recommend they contact their care team for anything beyond this summary."""


def initiate_automated_call(
    to_phone: str,
    patient_name: str,
    chief_complaint: str,
    patient_headline: str,
    patient_summary: str,
    steps: list,
    doctor_note: str = "",
    encounter_id: str | None = None,
) -> tuple[bool, str]:
    """
    Initiate an outbound call to the patient with an AI agent that has the report context.
    Returns (success, message).
    If CALL_ENABLED is False or Twilio not configured, logs context and returns (True, "Call logged (mock)").
    """
    context = build_agent_context(
        patient_name=patient_name,
        chief_complaint=chief_complaint,
        patient_headline=patient_headline,
        patient_summary=patient_summary,
        steps=steps,
        doctor_note=doctor_note,
    )

    if not settings.CALL_ENABLED or not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        # Mock: log context so you can plug into Twilio/Vapi later
        print(f"[MOCK CALL] To: {to_phone}\n--- Agent context ---\n{context}\n---")
        return True, "Call context prepared (Twilio not configured; set CALL_ENABLED and TWILIO_* in .env to place real calls)"

    # TwiML URL: use our endpoint if PUBLIC_BASE_URL and encounter_id are set
    twiml_url = "https://demo.twilio.com/docs/voice.xml"
    base = (settings.PUBLIC_BASE_URL or "").strip().rstrip("/")
    if base and encounter_id:
        from urllib.parse import quote
        twiml_url = f"{base}/api/voice/twiml?encounter_id={quote(encounter_id, safe='')}"

    try:
        from urllib.request import Request, urlopen
        from urllib.parse import urlencode
        from base64 import b64encode

        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Calls.json"
        data = urlencode({
            "To": to_phone,
            "From": settings.TWILIO_PHONE_NUMBER,
            "Url": twiml_url,
        }).encode()
        auth = b64encode(f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}".encode()).decode()
        req = Request(url, data=data, method="POST")
        req.add_header("Authorization", f"Basic {auth}")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urlopen(req, timeout=10) as r:
            if r.status in (200, 201):
                return True, "Call initiated"
        return False, "Twilio call failed"
    except Exception as e:
        return False, str(e)
