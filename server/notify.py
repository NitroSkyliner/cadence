import os
import ssl
import smtplib
from email.message import EmailMessage


def email_enabled() -> bool:
    return all(os.environ.get(k) for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS", "NOTIFY_TO"))


def send_email(subject: str, body: str):
    if not email_enabled():
        return
    try:
        msg = EmailMessage()
        msg["From"] = os.environ.get("SMTP_FROM", os.environ["SMTP_USER"])
        msg["To"] = os.environ["NOTIFY_TO"]
        msg["Subject"] = f"[Cadence] {subject}"
        msg.set_content(body)
        host, port = os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "587"))
        with smtplib.SMTP(host, port, timeout=15) as s:
            s.starttls(context=ssl.create_default_context())
            s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
            s.send_message(msg)
    except Exception as e:
        print(f"[notify] email failed: {e}")