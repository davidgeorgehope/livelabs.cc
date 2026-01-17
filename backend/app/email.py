"""
Email notifications via Gmail SMTP.

Setup:
1. Enable 2-Step Verification on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Create an App Password for "Mail"
4. Add to .env:
   SMTP_EMAIL=email.djhope@gmail.com
   SMTP_PASSWORD=your_16_char_app_password
   ADMIN_EMAIL=email.djhope@gmail.com
"""

import os
import smtplib
import threading
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", SMTP_EMAIL)


def _send_email(to_email: str, subject: str, body: str) -> bool:
    """Internal function to send an email via Gmail SMTP."""
    if not SMTP_PASSWORD or not SMTP_EMAIL:
        logger.warning("SMTP not configured - skipping email")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_EMAIL
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())

        logger.info(f"Email sent to {to_email}: {subject}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def _send_email_async(to_email: str, subject: str, body: str):
    """Send email in a background thread to avoid blocking."""
    thread = threading.Thread(target=_send_email, args=(to_email, subject, body))
    thread.daemon = True
    thread.start()


def send_signup_notification(user_email: str, user_name: str):
    """Notify admin of a new signup that needs approval."""
    if not ADMIN_EMAIL:
        return

    subject = f"[LiveLabs] New Signup Awaiting Approval: {user_name}"
    body = f"""A new user has signed up for LiveLabs and is awaiting approval.

Name: {user_name}
Email: {user_email}

Please log in to the admin dashboard to approve or reject this user:
https://livelabs.cc/admin

---
LiveLabs Admin Notifications
"""
    _send_email_async(ADMIN_EMAIL, subject, body)


def send_approval_email(user_email: str, user_name: str):
    """Notify user that their account has been approved."""
    subject = "Welcome to LiveLabs - Your Account is Approved!"
    body = f"""Hi {user_name},

Great news! Your LiveLabs account has been approved. You can now log in and start learning.

Log in at: https://livelabs.cc/login

Happy learning!

---
The LiveLabs Team
"""
    _send_email_async(user_email, subject, body)


def send_rejection_email(user_email: str, user_name: str, reason: str = None):
    """Notify user that their account has been rejected."""
    subject = "LiveLabs Account Update"

    reason_text = ""
    if reason:
        reason_text = f"\nReason: {reason}\n"

    body = f"""Hi {user_name},

Thank you for your interest in LiveLabs. Unfortunately, we are unable to approve your account at this time.
{reason_text}
If you believe this was a mistake or have questions, please contact us.

---
The LiveLabs Team
"""
    _send_email_async(user_email, subject, body)
