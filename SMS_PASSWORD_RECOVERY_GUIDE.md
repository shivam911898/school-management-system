# SMS-Based Password Recovery Implementation Guide

## Overview

In addition to email-based password recovery, the system now supports **SMS-based password recovery** for users who don't have access to email. This implementation uses **Twilio**, an industry-standard SMS service.

### Why SMS Recovery?

Many students and teachers in India and similar regions:

- Don't have personal email addresses
- May have limited email access
- Are more comfortable with phone-based verification
- Rely primarily on mobile phones

**Both email and SMS options are now available** to maximize accessibility.

---

## Architecture

### Services Layer

**`services/smsService.js`** - Twilio SMS Sender

- Initializes Twilio client from environment variables
- Sends SMS messages via Twilio API
- Gracefully degrades if credentials missing (logs warning, doesn't crash)

```javascript
const { sendSMS } = require("../services/smsService");

// Usage
await sendSMS({
  to: "+91XXXXXXXXXX",
  message: "Your password reset link: ...",
});
```

### Controller Layer

**`controllers/authController.js`** - `forgotPasswordSMS` Handler

- Accepts phone number from request
- Looks up user by phone in database
- Generates 1-hour reset token
- Sends SMS with reset link
- Returns generic message (prevents user enumeration attacks)

```javascript
POST /api/auth/forgot-password-sms
Body: { phone: "+91XXXXXXXXXX" }
Response: { success: true, message: "If phone found, SMS sent" }
```

### Routes

**`routes/authRoutes.js`**

- New endpoint: `POST /api/auth/forgot-password-sms`
- Uses existing `resetPassword` handler (shared with email flow)

### Frontend

**`public/forgot-password-sms.html`**

- User-friendly SMS recovery form
- Phone number input with placeholder
- Toggle to switch between email and SMS methods
- Matches design of forgot-password.html

**Updated Pages:**

- `/forgot-password.html` - Added SMS toggle button
- `/login-role.html` - Added "Reset via SMS" link

---

## Setup Instructions

### 1. Get Twilio Free Account

1. Sign up at https://www.twilio.com
2. Create free account (includes $15 trial credit)
3. From Twilio Console, get:
   - **Account SID** (top of console)
   - **Auth Token** (top of console)
   - **Phone Number** (Verified Sender Phone Number)

### 2. Set Environment Variables

**Local Development (.env):**

```bash
TWILIO_ACCOUNT_SID=AC...your-sid...
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

**Render Deployment:**

1. Go to your Render service dashboard
2. Settings → Environment
3. Add the three variables above
4. Redeploy the app

### 3. Install Dependencies

```bash
npm install
```

This installs both `nodemailer` and `twilio` packages (added to package.json).

---

## How It Works

### User Flow

1. User clicks **"Reset via SMS"** on login page
2. User enters phone number: `+91XXXXXXXXXX`
3. System sends SMS with reset link
4. User clicks link → redirected to password reset page
5. User enters new password → password updated
6. User logs in with new password

### Technical Flow

```
GET /forgot-password-sms
  ↓
User enters phone, submits
  ↓
POST /api/auth/forgot-password-sms
  ↓
Controller:
  - Looks up user by phone
  - Generates crypto token
  - Saves token + 1-hour expiry to DB
  - Calls smsService.sendSMS()
  ↓
Twilio:
  - Sends SMS to user's phone
  - User receives reset link
  ↓
User clicks link → /reset-password?token=xxx&email=yyy
  ↓
POST /api/auth/reset-password
  ↓
Controller:
  - Validates token (not expired, matches user)
  - Hashes new password
  - Clears token from DB
  - Returns success
  ↓
Login with new password
```

---

## Testing

### Local Testing (Without Twilio)

Even without Twilio credentials configured:

- Email recovery works fully
- SMS recovery endpoint returns generic error
- App doesn't crash

### With Twilio Credentials

1. **Test SMS Service:**

   ```bash
   node -e "
     const sms = require('./services/smsService');
     sms.sendSMS({
       to: '+your-test-phone',
       message: 'Test SMS from school system'
     }).then(() => console.log('SMS sent!')).catch(e => console.error(e));
   "
   ```

2. **Test Full Flow:**
   - Go to `/forgot-password-sms.html`
   - Enter a phone number linked to a user account
   - Check for SMS on your phone
   - Click reset link
   - Set new password
   - Login with new credentials

### Test Accounts

If you have test users in database:

```bash
# Show users with phone numbers
node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  const User = require('./models/User');

  mongoose.connect(process.env.MONGO_URI).then(async () => {
    const users = await User.find({ phone: { \$exists: true, \$ne: null } });
    console.log(users.map(u => ({ name: u.name, phone: u.phone, email: u.email })));
    process.exit(0);
  });
"
```

---

## Security Considerations

### Token Generation & Expiry

- Uses cryptographically secure `crypto.randomBytes()`
- 32-byte token (256-bit)
- 1-hour expiry time
- Single-use (cleared after password reset)
- Stored in database, not in URL

### User Enumeration Protection

- Returns generic message: "If phone found, SMS sent"
- Doesn't reveal whether phone exists in system
- Same message for valid/invalid phones

### SMS Delivery Limits

- Twilio free account: 100 outgoing SMS per month
- Production: Upgrade to paid plan as needed
- Rate limiting recommended on endpoint (already using helmet + express-rate-limit)

### Phone Number Storage

- Stored in User model (already present)
- Optional field (can be null)
- No phone number validation on storage (user-provided)
- Recommended: Add phone validation in future

---

## Environment Variables Reference

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# SMTP Configuration (Email Recovery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="School <no-reply@school.example>"
```

---

## Troubleshooting

### SMS Not Received

1. **Check credentials:** Verify TWILIO\_\* env vars are correct
2. **Check phone format:** Must include country code (+91 for India)
3. **Check Twilio balance:** Free account has limited SMS
4. **Check logs:** Look for errors in server logs

### Reset Link Not Working

1. **Check token expiry:** Token valid for 1 hour only
2. **Check database:** Verify passwordResetToken saved correctly
3. **Check email param:** Both phone AND email needed in reset URL

### "Service not configured" Error

- Twilio env vars not set → SMS gracefully disabled
- Email recovery still works
- Set Twilio credentials to enable SMS

---

## API Endpoints

### Request SMS Reset Link

**Endpoint:** `POST /api/auth/forgot-password-sms`

**Request:**

```json
{
  "phone": "+91XXXXXXXXXX"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "If an account with this phone number exists, an SMS with a password reset link has been sent."
}
```

**Response (Any Error - Same Message):**

```json
{
  "success": true,
  "message": "If an account with this phone number exists, an SMS with a password reset link has been sent."
}
```

Note: Always returns success for security (prevents user enumeration)

### Reset Password

**Endpoint:** `POST /api/auth/reset-password`

**Request:**

```json
{
  "email": "user@example.com",
  "token": "xxx...xxx",
  "newPassword": "newPassword123"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Response (Invalid Token):**

```json
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

---

## Frontend URLs

- **Email Recovery:** `/forgot-password.html`
- **SMS Recovery:** `/forgot-password-sms.html`
- **Password Reset:** `/reset-password.html?token=xxx&email=yyy`
- **Toggle Options:** Both pages have buttons to switch between email/SMS

---

## Future Enhancements

1. **Phone Validation:** Add phone format validation
2. **Internationalization:** Support different phone formats (US, UK, etc.)
3. **OTP Alternative:** Instead of reset link, send 6-digit OTP
4. **WhatsApp Integration:** Use WhatsApp Business API instead of SMS
5. **Rate Limiting:** Limit SMS sends per phone per hour
6. **Analytics:** Track SMS usage and delivery rates

---

## Support & Resources

- **Twilio Docs:** https://www.twilio.com/docs/sms
- **Twilio Console:** https://console.twilio.com
- **Node.js Twilio SDK:** https://www.twilio.com/docs/libraries/node
- **Security Best Practices:** https://www.twilio.com/docs/usage/security-best-practices

---

## Summary

✅ **SMS Recovery Now Available!**

Both email and SMS password recovery methods are now fully implemented. Users can:

1. Choose their preferred recovery method (email or SMS)
2. Receive password reset link via their chosen method
3. Reset password securely with token validation
4. Log in with new password

The system gracefully handles missing configurations and prioritizes user accessibility.
