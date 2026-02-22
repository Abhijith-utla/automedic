"""
Send custom patient emails with visit summary, diagnosis, and analysis.
Uses SendGrid when SENDGRID_API_KEY is set, else SMTP (Gmail or other) when configured, else logs (mock).
SMTP path uses EmailMessage + TLS for UTF-8 safe sending (Gmail-style).
"""

import json
import logging
import ssl
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


def _send_via_sendgrid(to_email: str, subject: str, html: str) -> tuple[bool, str]:
    """Send via SendGrid API v3. Returns (success, message)."""
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=(settings.EMAIL_FROM, settings.EMAIL_FROM_NAME),
            to_emails=to_email,
            subject=subject,
            html_content=html,
        )
        api_key = (settings.SENDGRID_API_KEY or "").strip()
        if not api_key:
            return False, "SENDGRID_API_KEY is empty (check .env)"
        sg = SendGridAPIClient(api_key)
        sg.send(message)
        return True, "Email sent"
    except Exception as e:
        # SendGrid uses python_http_client which raises HTTPError with .body
        err_msg = str(e)
        try:
            if hasattr(e, "body") and e.body:
                body = e.body.decode("utf-8") if isinstance(e.body, bytes) else e.body
                try:
                    data = json.loads(body)
                    if isinstance(data.get("errors"), list) and data["errors"]:
                        err_msg = " ".join(
                            err.get("message", str(err)) for err in data["errors"]
                        )
                    else:
                        err_msg = body[:500] if len(body) > 500 else body
                except json.JSONDecodeError:
                    err_msg = body[:500] if len(body) > 500 else body
        except Exception:
            pass
        logger.warning("SendGrid send failed: %s", err_msg, exc_info=True)
        return False, err_msg


def build_report_email_html(
    patient_name: str,
    chief_complaint: str,
    patient_headline: str,
    patient_summary: str,
    steps: list,
    doctor_note: str = "",
) -> str:
    """Build HTML body for the report email."""
    steps_html = "".join(f"<li>{s}</li>" for s in steps) if steps else ""
    note_section = f'<p><strong>Message from your care team:</strong><br/>{doctor_note}</p>' if doctor_note else ""
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Visit Summary</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #0f766e;">Your Visit Summary</h2>
  <p>Dear {patient_name},</p>
  <p>Here is a summary of your recent visit and the analysis discussed with your care team.</p>

  <h3 style="color: #334155;">Reason for visit</h3>
  <p>{chief_complaint}</p>

  <h3 style="color: #334155;">Summary</h3>
  <p><strong>{patient_headline}</strong></p>
  <p>{patient_summary}</p>

  <h3 style="color: #334155;">Next steps</h3>
  <ul>{steps_html}</ul>

  {note_section}

  <p style="margin-top: 24px; color: #64748b; font-size: 14px;">
    This is an automated summary. If you have questions about your condition or treatment, please contact your care team or schedule a follow-up.
  </p>
</body>
</html>
"""


def send_patient_report_email(
    to_email: str,
    patient_name: str,
    chief_complaint: str,
    patient_headline: str,
    patient_summary: str,
    steps: list,
    doctor_note: str = "",
) -> tuple[bool, str]:
    """
    Send the report email. Returns (success, message).
    Uses SendGrid if SENDGRID_API_KEY is set, else SMTP if configured, else mock.
    """
    subject = "Your Visit Summary – Automedic"
    html = build_report_email_html(
        patient_name=patient_name,
        chief_complaint=chief_complaint,
        patient_headline=patient_headline,
        patient_summary=patient_summary,
        steps=steps,
        doctor_note=doctor_note,
    )

    if not settings.EMAIL_ENABLED:
        # Mock when email not enabled
        print(f"[MOCK EMAIL] To: {to_email}\nSubject: {subject}\n---\n{html[:500]}...")
        return True, "Email prepared (set EMAIL_ENABLED and SendGrid or SMTP in .env to send)"

    # Prefer SendGrid
    if settings.SENDGRID_API_KEY:
        return _send_via_sendgrid(to_email, subject, html)

    # Fallback: SMTP (Gmail or other) — EmailMessage + TLS, UTF-8 safe
    if settings.SMTP_HOST:
        return _send_via_smtp(to_email, subject, html)


def _send_via_smtp(to_email: str, subject: str, html: str) -> tuple[bool, str]:
    """
    Send via SMTP using EmailMessage and TLS (Gmail-style).
    Uses UTF-8 safe encoding; optional unverified SSL context if SMTP_SSL_VERIFY is False.
    """
    from_addr = (settings.SMTP_FROM or settings.EMAIL_FROM or "").strip() or settings.SMTP_USER
    if not from_addr:
        return False, "SMTP_FROM or SMTP_USER must be set for SMTP"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content("Please view this email in HTML format.", charset="utf-8")
    msg.add_alternative(html, subtype="html", charset="utf-8")

    if getattr(settings, "SMTP_SSL_VERIFY", True):
        context = ssl.create_default_context()
    else:
        context = ssl._create_unverified_context()

    server = None
    try:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        if (settings.SMTP_USER or "").strip() and (settings.SMTP_PASSWORD or "").strip():
            server.login(settings.SMTP_USER.strip(), settings.SMTP_PASSWORD.strip())
        server.sendmail(from_addr, [to_email], msg.as_string())
        return True, "Email sent"
    except smtplib.SMTPAuthenticationError as e:
        logger.warning("SMTP authentication failed: %s", e)
        return False, "SMTP login failed. For Gmail use an App Password (not your normal password)."
    except Exception as e:
        logger.warning("SMTP send failed: %s", e, exc_info=True)
        return False, str(e)
    finally:
        if server:
            try:
                server.quit()
            except smtplib.SMTPServerDisconnected:
                pass
            except Exception as e:
                logger.debug("SMTP quit error: %s", e)

    # No provider configured
    print(f"[MOCK EMAIL] To: {to_email}\nSubject: {subject}\n---\n{html[:500]}...")
    return True, "Email prepared (add SENDGRID_API_KEY or SMTP_* in .env to send)"
