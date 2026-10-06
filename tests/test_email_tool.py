"""Tests for server.email_tool — mocked SMTP."""
import smtplib

import pytest

from server.email_tool import EmailError, send_email


class FakeSMTP:
    """Test double for smtplib.SMTP; records everything the tool does."""

    last: "FakeSMTP | None" = None
    raise_on_login: Exception | None = None

    def __init__(self, host: str, port: int = 0) -> None:
        self.host = host
        self.port = port
        self.starttls_called = False
        self.login_args: tuple | None = None
        self.sent_message = None
        self.quit_called = False
        FakeSMTP.last = self

    def starttls(self) -> None:
        self.starttls_called = True

    def login(self, user: str, password: str) -> None:
        if FakeSMTP.raise_on_login is not None:
            raise FakeSMTP.raise_on_login
        self.login_args = (user, password)

    def send_message(self, msg) -> None:
        self.sent_message = msg

    def quit(self) -> None:
        self.quit_called = True


@pytest.fixture(autouse=True)
def _reset_fake():
    FakeSMTP.last = None
    FakeSMTP.raise_on_login = None
    yield
    FakeSMTP.last = None
    FakeSMTP.raise_on_login = None


def _send(**kwargs):
    kwargs.setdefault("gmail_user", "me@gmail.com")
    kwargs.setdefault("gmail_app_password", "app-password-123")
    kwargs.setdefault("smtp_class", FakeSMTP)
    return send_email(**kwargs)


def test_plain_email():
    """Plain email: headers/body correct, TLS + login + quit happened."""
    result = _send(to="prasad@example.com", subject="Demo ready", body="hello there")
    assert result == {"ok": True}
    fake = FakeSMTP.last
    assert fake is not None
    assert (fake.host, fake.port) == ("smtp.gmail.com", 587)
    assert fake.starttls_called is True
    assert fake.login_args == ("me@gmail.com", "app-password-123")
    assert fake.quit_called is True
    msg = fake.sent_message
    assert msg["From"] == "me@gmail.com"
    assert msg["To"] == "prasad@example.com"
    assert msg["Subject"] == "Demo ready"
    assert "hello there" in msg.get_content()
    assert not msg.is_multipart()


def test_email_with_attachment(tmp_path):
    """Attachment present with original filename and correct MIME type."""
    pdf = tmp_path / "report.pdf"
    pdf.write_bytes(b"%PDF-1.4 fake-bytes")
    result = _send(
        to="me@gmail.com", subject="file", body="see attached", attachment_path=str(pdf)
    )
    assert result == {"ok": True}
    parts = list(FakeSMTP.last.sent_message.iter_attachments())
    assert len(parts) == 1
    part = parts[0]
    assert part.get_filename() == "report.pdf"
    assert part.get_content_type() == "application/pdf"
    assert part.get_content() == b"%PDF-1.4 fake-bytes"


def test_oversized_attachment_never_connects(tmp_path):
    """Oversized attachment raises EmailError before any SMTP connection."""
    big = tmp_path / "big.bin"
    big.write_bytes(b"x" * 2048)
    with pytest.raises(EmailError, match="over the 0 MB limit"):
        _send(to="me@gmail.com", subject="x", body="x", attachment_path=str(big), max_mb=0)
    assert FakeSMTP.last is None


def test_missing_attachment_file():
    """Missing attachment file raises EmailError without connecting."""
    with pytest.raises(EmailError, match="attachment not found"):
        _send(
            to="me@gmail.com",
            subject="x",
            body="x",
            attachment_path="/nonexistent/xyz.pdf",
        )
    assert FakeSMTP.last is None


def test_smtp_login_failure_wrapped():
    """SMTP auth failure is wrapped as EmailError, not leaked raw."""
    FakeSMTP.raise_on_login = smtplib.SMTPAuthenticationError(535, b"5.7.8 bad credentials")
    with pytest.raises(EmailError) as excinfo:
        _send(to="me@gmail.com", subject="x", body="x")
    assert "failed to send email" in str(excinfo.value)
    assert not isinstance(excinfo.value, smtplib.SMTPException)
