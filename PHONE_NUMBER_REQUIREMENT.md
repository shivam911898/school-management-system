# Phone Number Requirement - SMS Password Recovery

## Overview

Phone numbers are now **REQUIRED** for all users (admin, teacher, student) because they are essential for SMS-based password recovery.

---

## Why Phone Numbers Are Required

### Password Recovery Methods

Users can now reset their passwords in **two ways**:

1. **Email Recovery** (requires email address)
   - Go to `/forgot-password`
   - Enter email address
   - Receive reset link via email
   - Update password

2. **SMS Recovery** (requires phone number) ← **Now mandatory**
   - Go to `/forgot-password-sms`
   - Enter phone number
   - Receive reset link via SMS
   - Update password

### Problem Without Phone Numbers

- Users can't use SMS recovery method
- If email is unavailable/forgotten, user is locked out
- Rural/low-bandwidth areas may not have reliable email
- Students may not have personal email addresses

### Solution: Make Phone Numbers Mandatory

- Ensures all users can use SMS recovery
- Provides backup to email recovery
- More inclusive for Indian users
- Aligns with accessibility goals

---

## What Changed

### 1. Validator (Backend)

**File:** `validators/authValidators.js`

**Before:**

```javascript
body("phone")
  .optional() // ← Optional
  .isMobilePhone()
  .withMessage("Please provide a valid phone number");
```

**After:**

```javascript
body("phone")
  .trim()
  .notEmpty() // ← Now required
  .withMessage("Phone number is required for password recovery")
  .isMobilePhone()
  .withMessage("Please provide a valid phone number (e.g., +91XXXXXXXXXX)");
```

**Effect:** Server will reject registration without phone number

### 2. Admin Creation Form

**File:** `public/login-role.html`

**Added field:**

```html
<div class="field">
  <label for="register-phone">Phone Number</label>
  <input
    id="register-phone"
    name="phone"
    type="tel"
    placeholder="+91XXXXXXXXXX"
    required
  />
</div>
```

**Effect:** First admin must provide phone number during account creation

### 3. User Management - Create User Form

**File:** `public/user-management.html`

**Before:**

```html
<label for="userPhone">Phone</label>
<input id="userPhone" name="phone" type="tel" />
<!-- Optional -->
```

**After:**

```html
<label for="userPhone">Phone Number *</label>
<input
  id="userPhone"
  name="phone"
  type="tel"
  placeholder="+91XXXXXXXXXX"
  required
/>
<!-- Required -->
```

**Effect:** Admins must provide phone when creating new users

### 4. User Management - Edit User Form

**File:** `public/user-management.html`

**Before:**

```html
<label for="editUserPhone">Phone</label>
<input id="editUserPhone" name="phone" type="tel" />
<!-- Optional -->
```

**After:**

```html
<label for="editUserPhone">Phone Number *</label>
<input
  id="editUserPhone"
  name="phone"
  type="tel"
  placeholder="+91XXXXXXXXXX"
  required
/>
<!-- Required -->
```

**Effect:** Phone must be provided when editing users

---

## User Workflows

### Creating First Admin

```
1. Go to /login
2. See "Create First Admin" form
3. Fill in:
   ✓ Name: Admin Name
   ✓ Email: admin@school.com
   ✓ Phone: +919999999999  ← NEW (REQUIRED)
   ✓ Password: SecurePass123
4. Click "Create Admin Account"
5. Account created and logged in
```

### Admin Creating New User

```
1. Admin logs in
2. Goes to "User Management"
3. Clicks "Create User"
4. Modal appears with form
5. Fills in:
   ✓ Name: John Doe
   ✓ Email: john@example.com
   ✓ Phone: +919876543210  ← REQUIRED
   ✓ Password: Password123
   ✓ Role: Student/Teacher
   ✓ Other role-specific fields
6. Clicks "Create User"
7. User created successfully
```

### Admin Editing Existing User

```
1. Admin logs in
2. Goes to "User Management"
3. Finds user in list
4. Clicks "Edit"
5. Modal opens with current data
6. Can update phone number ← Now required
7. Clicks "Update"
8. Changes saved
```

---

## Phone Number Format

### Valid Examples

**India (+91):**

- +919999999999
- +91-9999999999
- +91 9999 999999

**Other Countries:**

- +1234567890 (US/Canada)
- +441234567890 (UK)
- +33123456789 (France)

### Validation Rules

- Must include country code (e.g., +91)
- Can include spaces, hyphens
- Must be in valid international format
- express-validator's `isMobilePhone()` validates

---

## Password Recovery Flow

### Email Recovery Path

```
User needs password reset
         ↓
Visit /forgot-password
         ↓
Enter email address
         ↓
POST /api/auth/forgot-password
         ↓
Server sends email with reset link
         ↓
User clicks link in email
         ↓
Redirected to /reset-password?token=xxx&email=yyy
         ↓
Enter new password
         ↓
POST /api/auth/reset-password
         ↓
Password updated ✓
         ↓
Log in with new password
```

### SMS Recovery Path

```
User needs password reset
         ↓
Visit /forgot-password-sms
         ↓
Enter phone number (NOW REQUIRED FOR ALL USERS)
         ↓
POST /api/auth/forgot-password-sms
         ↓
Server sends SMS with reset link (via Twilio)
         ↓
User clicks link in SMS
         ↓
Redirected to /reset-password?token=xxx&email=yyy
         ↓
Enter new password
         ↓
POST /api/auth/reset-password
         ↓
Password updated ✓
         ↓
Log in with new password
```

---

## Benefits

✅ **Accessibility:** All users can recover their password  
✅ **Redundancy:** Two recovery methods (email + SMS)  
✅ **Inclusivity:** Supports users without email access  
✅ **Security:** Phone backup for authentication  
✅ **Mobile-friendly:** SMS more accessible on mobile

---

## Database Impact

### User Model

Phone field already exists:

```javascript
phone: {
  type: String,
  trim: true,
}
```

**No database migration needed** - existing users keep their phone numbers.

### For Existing Users

If existing users don't have phone numbers, they can:

1. Edit their profile (admin edits for them)
2. Add phone number via user management
3. Then use SMS password recovery

---

## Configuration

### Environment Variables

For SMS to work, configure Twilio:

```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

For email to work, configure SMTP:

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
```

---

## Testing

### Test First Admin Creation

1. Clear database: `db.dropDatabase()`
2. Start server: `npm start`
3. Visit: `http://localhost:5000/login`
4. See "Create First Admin" form
5. **Phone field should be visible and required** ✓
6. Try submitting without phone → Error
7. Enter phone → Works

### Test User Creation

1. Log in as admin
2. Go to User Management
3. Click "Create User"
4. **Phone field should be required** ✓
5. Try submitting without phone → Error
6. Enter phone → Works

### Test SMS Recovery

1. Create user with phone: +919999999999
2. Go to `/forgot-password-sms`
3. Enter phone number
4. Click "Send SMS"
5. Should send SMS with reset link (if Twilio configured)
6. Click link in SMS
7. Should open reset password page
8. Enter new password
9. Password updated ✓

---

## Error Messages

### During Registration

If user doesn't provide phone:

```
"Phone number is required for password recovery"
```

If phone format invalid:

```
"Please provide a valid phone number (e.g., +91XXXXXXXXXX)"
```

---

## Migration Guide for Existing Users

### For Admins

**Update existing users with phone numbers:**

1. Go to User Management
2. For each user, click "Edit"
3. Add phone number
4. Click "Update"
5. User now has SMS recovery available

### For Users

**If a user doesn't have a phone number:**

1. Contact admin
2. Admin goes to User Management
3. Admin finds your user account
4. Admin clicks "Edit"
5. Admin adds your phone number
6. Admin clicks "Update"
7. Now you can use SMS password recovery

---

## Summary

| Aspect                                 | Status            |
| -------------------------------------- | ----------------- |
| Phone field required in registration   | ✅ Yes            |
| Phone field in admin creation form     | ✅ Yes            |
| Phone field in user creation form      | ✅ Yes (required) |
| Phone field in user edit form          | ✅ Yes (required) |
| SMS password recovery available        | ✅ Yes            |
| Email password recovery available      | ✅ Yes            |
| Both methods accessible simultaneously | ✅ Yes            |

---

## Next Steps

1. **Test Locally**
   - Create admin with phone
   - Create users with phone
   - Test SMS password reset

2. **Update Existing Users**
   - Add phone numbers to admin, teacher, student accounts
   - Or use edit feature to add later

3. **Deploy to Render**
   - Code changes already committed
   - Render will auto-deploy
   - SMS recovery available after Twilio config

4. **Notify Users**
   - Inform users about phone requirement
   - Provide instructions for SMS recovery
   - Update help documentation

---

## Support

For questions about:

- **Phone validation:** See `validators/authValidators.js`
- **SMS sending:** See `services/smsService.js`
- **Forms:** See `public/login-role.html` and `public/user-management.html`
- **Password reset:** See `FIX_PASSWORD_RESET_ROUTES.md`

---

**All users now have secure SMS-based password recovery!** 🎉
