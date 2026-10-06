"""M6 — Email tool: send plain emails and emails with attachments via Gmail SMTP."""
from __future__ import annotations

import mimetypes
import os
import smtplib
from email.message import EmailMessage
from typing import Callable

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


class EmailError(Exception):
    """Raised when an email cannot be built or sent."""


def _guess_mime_type(path: str) -> tuple[str, str]:
    """Return (maintype, subtype) for a file, defaulting to application/octet-stream."""
    guessed, _ = mimetypes.guess_type(path)
    if not guessed or "/" not in guessed:
        return ("application", "octet-stream")
    maintype, _, subtype = guessed.partition("/")
    return (maintype, subtype or "octet-stream")


def _build_message(
    to: str, subject: str, body: str, attachment_path: str | None, max_mb: int
) -> EmailMessage:
    """Build the MIME message; validates the attachment before any network use."""
    msg = EmailMessage()
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    if attachment_path is not None:
        if not os.path.isfile(attachment_path):
            raise EmailError(f"attachment not found: {attachment_path}")
        size = os.path.getsize(attachment_path)
        if size > max_mb * 1024 * 1024:
            raise EmailError(
                f"attachment {os.path.basename(attachment_path)} is "
                f"{size / (1024 * 1024):.1f} MB, over the {max_mb} MB limit"
            )
        maintype, subtype = _guess_mime_type(attachment_path)
        with open(attachment_path, "rb") as fh:
            msg.add_attachment(
                fh.read(),
                maintype=maintype,
                subtype=subtype,
                filename=os.path.basename(attachment_path),
            )
    return msg


def send_email(
    to: str,
    subject: str,
    body: str,
    attachment_path: str | None = None,
    *,
    gmail_user: str,
    gmail_app_password: str,
    max_mb: int = 20,
    smtp_class: Callable[..., smtplib.SMTP] = smtplib.SMTP,
) -> dict:
    """Send an email via Gmail SMTP; returns {"ok": True}, raises EmailError on failure."""
    if not to:
        raise EmailError("recipient address is empty")
    msg = _build_message(to, subject, body, attachment_path, max_mb)
    msg["From"] = gmail_user
    smtp: smtplib.SMTP | None = None
    try:
        smtp = smtp_class(SMTP_HOST, SMTP_PORT)
        smtp.starttls()
        smtp.login(gmail_user, gmail_app_password)
        smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise EmailError(f"failed to send email to {to}: {exc}") from exc
    finally:
        if smtp is not None:
            try:
                smtp.quit()
            except Exception:
                pass
    return {"ok": True}
