# Patient Email and Automated Call

## Email: SendGrid (recommended)

When the doctor chooses **"Email report to patient"**, the backend sends a **custom HTML email** (visit summary, diagnosis, next steps, optional doctor message).

### SendGrid setup

1. **SendGrid account:** [sendgrid.com](https://sendgrid.com) → create API key with **Mail Send > Full Access**.
2. **Sender identity:** In SendGrid you **must** verify the "From" address (Single Sender Verification or Domain Authentication). Using a generic address like `noreply@gmail.com` will not work—SendGrid will reject it. Use a domain you control (e.g. `noreply@yourdomain.com`) and verify it in SendGrid.
3. **Backend `.env`:**
   ```env
   EMAIL_ENABLED=true
   SENDGRID_API_KEY=SG.xxxxxxxxxxxx
   EMAIL_FROM=noreply@yourdomain.com
   EMAIL_FROM_NAME=Automedic
   ```
4. Restart the backend.

If `SENDGRID_API_KEY` is set, the app uses **SendGrid** only. If you prefer SMTP instead, leave `SENDGRID_API_KEY` empty and set `SMTP_*` (see below). The patient must have an **email** on file.

### SMTP fallback (Gmail or other)

If `SENDGRID_API_KEY` is not set but `SMTP_HOST` is set, the app uses **SMTP** with the same approach as Gmail: `EmailMessage`, TLS on port 587, and UTF-8–safe encoding.

**Gmail setup:**

1. Use a Gmail address as the sender. In Google Account → Security, enable **2-Step Verification**, then create an **App Password** for “Mail” (use that as `SMTP_PASSWORD`, not your normal password).
2. In backend `.env`:
   ```env
   EMAIL_ENABLED=true
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your.email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   SMTP_FROM=your.email@gmail.com
   EMAIL_FROM=your.email@gmail.com
   EMAIL_FROM_NAME=Automedic
   ```
   Leave `SENDGRID_API_KEY` empty so the app uses SMTP.
3. If you see SSL certificate errors in development, you can set `SMTP_SSL_VERIFY=false` (not recommended for production).
4. Restart the backend.

Other SMTP providers work the same way: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` to match your provider.

### Mock (no provider)

If neither SendGrid nor SMTP is configured, the app logs the email and returns success so you can test without sending.

---

## Voice: Phone call agent (Twilio)

When the doctor chooses **"Automated call to patient"**, the backend starts a **Twilio voice call**. When the patient answers, Twilio requests a **TwiML** URL from your backend; the response tells Twilio to **speak the visit summary** to the patient (reason for visit, summary, next steps). The patient must have a **phone number** on file.

### Step 1: Twilio account and number

1. Sign up at [twilio.com](https://www.twilio.com).
2. In the Twilio Console:
   - **Account SID** and **Auth Token** are on the dashboard (Account Info).
   - Buy or get a **phone number** for voice: Console → Phone Numbers → Manage → Buy a number (or use a trial number). Note the number in E.164 form (e.g. `+15551234567`).

### Step 2: Backend `.env`

Add or set:

```env
CALL_ENABLED=true
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token-from-console
TWILIO_PHONE_NUMBER=+15551234567
```

Use your real Account SID, Auth Token, and Twilio phone number.

### Step 3: Public URL for TwiML (so Twilio can reach your backend)

When the call connects, Twilio does an HTTP GET to your backend to get the “script” (TwiML) for the call. So your backend must be reachable at a **public URL** (Twilio’s servers cannot use `localhost`).

- **Local development:** use a tunnel, e.g. [ngrok](https://ngrok.com):
  ```bash
  ngrok http 8000
  ```
  Copy the HTTPS URL (e.g. `https://abc123.ngrok.io`) and set it in `.env` as `PUBLIC_BASE_URL` (no trailing slash).

- **Production:** use your real API base URL (e.g. `https://api.yourdomain.com`).

In `.env`:

```env
PUBLIC_BASE_URL=https://abc123.ngrok.io
```

Restart the backend after changing `.env`.

### Step 4: How it works

1. Doctor clicks **“Automated call to patient”** and submits (optional note).
2. Backend calls Twilio to place an outbound call to the patient’s phone.
3. When the patient answers, Twilio GETs:
   `https://<PUBLIC_BASE_URL>/api/voice/twiml?encounter_id=<id>`
4. Your backend returns **TwiML** that tells Twilio to **Say** the visit summary (reason for visit, summary, next steps). Twilio uses text-to-speech to read it, then says goodbye.

No extra “agent” server is required: the built-in **TwiML endpoint** (`/api/voice/twiml`) serves the script for each encounter.

### Optional: Richer voice AI

The default flow is **one-way**: the system speaks the summary and hangs up. To add **two-way conversation** (patient asks questions, AI answers):

- Use Twilio’s [Conversational AI](https://www.twilio.com/docs/voice/ai) or another voice AI product, or
- Implement your own TwiML webhook that uses `<Gather>` for speech input and your own LLM to generate answers, then return TwiML with `<Say>` for the reply (and loop until hangup).

If `CALL_ENABLED` or Twilio credentials are not set, the app logs the call context (mock) and does not place a real call.

---

## Patient contact info

- **Email** and **phone** are optional on the Patient model.
- Add them when creating a patient or in patient info.
- **Email patient** requires an email; **Call patient** requires a phone. Otherwise the API returns a clear error.
