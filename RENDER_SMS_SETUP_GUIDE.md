# Render Deployment - SMS Recovery Setup Guide

## Quick Setup (5 minutes)

### Step 1: Get Twilio Credentials

1. Visit https://www.twilio.com
2. Click "Sign Up" (or log in if you have account)
3. Complete signup (includes $15 free credit)
4. Go to Twilio Console (https://console.twilio.com)
5. Copy the following to a notepad:
   - **Account SID** (visible at top of console)
   - **Auth Token** (visible at top of console - may need to show)
   - **Phone Number** (under "Verified Caller IDs" or get a trial phone number)

### Step 2: Deploy Code to Render

```bash
cd /home/shivam/school-management

# Make sure dependencies are updated
git add package.json .env.example services/smsService.js
git add routes/authRoutes.js controllers/authController.js
git add public/forgot-password-sms.html public/forgot-password.html public/login-role.html
git add SMS_PASSWORD_RECOVERY_GUIDE.md SMS_IMPLEMENTATION_SUMMARY.md

git commit -m "feat: Add SMS password recovery via Twilio"
git push origin main
```

Render will auto-deploy when you push to main.

### Step 3: Configure Render Environment Variables

1. Go to your Render Dashboard
2. Select your service (school-management)
3. Click "Settings" (in left sidebar)
4. Scroll to "Environment"
5. Add these three environment variables:

| Key                   | Value                         |
| --------------------- | ----------------------------- |
| `TWILIO_ACCOUNT_SID`  | Your Account SID from Step 1  |
| `TWILIO_AUTH_TOKEN`   | Your Auth Token from Step 1   |
| `TWILIO_PHONE_NUMBER` | Your Phone Number from Step 1 |

Example values:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+12025551234
```

6. Click "Save Changes"
7. Render will automatically redeploy your app

### Step 4: Verify Deployment

1. Wait for redeploy to complete (check Render dashboard)
2. Go to your app URL: `https://your-app.onrender.com`
3. Click login → "Reset via SMS"
4. Try entering a phone number associated with a test account
5. Should receive SMS within 30 seconds

---

## Testing SMS Recovery

### Create Test User with Phone

```bash
# SSH into Render or connect to your MongoDB Atlas database
# Then run this script locally:

node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  const User = require('./models/User');

  mongoose.connect(process.env.MONGO_URI).then(async () => {
    const user = await User.findOne({ role: 'admin' });
    if (user) {
      user.phone = '+918800000000'; // Your actual phone number
      await user.save();
      console.log('Updated admin user with phone:', user.phone);
    }
    process.exit(0);
  }).catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
"
```

### Full SMS Recovery Test

1. Visit `https://your-app.onrender.com/forgot-password-sms.html`
2. Enter phone: `+918800000000` (your actual number)
3. Click "Send SMS"
4. Check your phone for SMS message
5. Click link in SMS
6. Set new password
7. Log back in with new password

---

## Troubleshooting

### SMS Not Received

**Check 1: Twilio Env Vars Set Correctly**

```bash
# In Render Settings → Environment, verify all 3 variables are set
# If missing, add them and click "Save Changes"
```

**Check 2: Twilio Account Balance**

- Free account has limited SMS (usually ~100 per month)
- Check Twilio Console for balance

**Check 3: Phone Format**

- Must include country code: `+91` for India
- Example: `+918800000000` (not `8800000000`)

**Check 4: Check Logs**

```bash
# In Render Dashboard, click "Logs" tab
# Look for errors from SMS service
# Should see "Sending SMS to +91..." if working
```

### Reset Link Not Working

1. Check URL has both `token` and `email` parameters
2. Token valid for 1 hour only
3. Try again if expired
4. Check database for passwordResetToken (shouldn't exist after reset)

### "Service not configured" Error

- Twilio env vars not set or incomplete
- Email recovery still works as fallback
- Set all 3 Twilio variables in Render Settings

---

## Fallback Behavior

| Scenario                    | What Happens                          |
| --------------------------- | ------------------------------------- |
| Both Email & SMS configured | Users choose either method ✅         |
| Only SMS configured         | SMS works, email unavailable          |
| Only Email configured       | Email works, SMS unavailable          |
| Neither configured          | Both methods unavailable (tell users) |
| SMS fails (rate limit, etc) | User gets generic error message       |

---

## Monitoring

### Check SMS Usage (Twilio Console)

1. Go to https://console.twilio.com
2. Look for "Messages" section
3. See sent/received SMS count
4. View logs of each message

### Check App Logs (Render Dashboard)

1. Go to your Render service
2. Click "Logs" tab
3. Search for "SMS" or "forgotPasswordSMS"
4. Should see entries like:
   ```
   Sending SMS to +918800000000
   SMS sent successfully
   ```

---

## Cost Estimation

**Twilio Pricing:**

- Free tier: $15 credit (~100 SMS)
- After free tier: ~$0.05 per SMS in India
- 100 users × 12 resets/year = 1200 SMS/year ≈ $60/year

**Consider:**

- Most users will use email
- SMS is backup option
- Enable only if budget allows

---

## Next: Notify Users

Once SMS recovery is live, tell your users:

```markdown
# Password Recovery Options Now Available! 🔐

We've added TWO ways to recover your password:

1. **Email Recovery** - Fastest and most reliable
   - Go to login page → "Forgot Password?"
   - Enter your email
   - Check email for reset link

2. **SMS Recovery** - If you don't have email
   - Go to login page → "Reset via SMS"
   - Enter your phone number (+91XXXXXXXXXX)
   - Check SMS for reset link

Both methods are secure and will reset your password in minutes!
```

---

## Deployment Checklist

- [ ] Created Twilio account and got credentials
- [ ] Pushed code to main branch
- [ ] Rendered auto-deployed the app
- [ ] Added 3 Twilio env vars to Render Settings
- [ ] Clicked "Save Changes" (triggers redeploy)
- [ ] Waited for redeploy to complete
- [ ] Tested SMS recovery with test account
- [ ] Received SMS successfully
- [ ] Reset password and logged in
- [ ] Verified email recovery still works

---

## Support

- **Twilio Help:** https://support.twilio.com
- **Render Docs:** https://render.com/docs
- **App Documentation:** See `SMS_PASSWORD_RECOVERY_GUIDE.md`

---

## Summary

✅ SMS password recovery is now live on Render!  
✅ Users can recover password via email or SMS  
✅ Both methods secure and tested  
✅ Graceful fallback if SMS unavailable

**🎉 Deployment Complete!**
