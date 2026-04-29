# Fix: MODULE_NOT_FOUND Error for nodemailer

## Problem Reported

You received a MODULE_NOT_FOUND error:

```
MODULE_NOT_FOUND: Cannot find module 'nodemailer'
requireStack: [
  '/services/mailerService.js',
  '/controllers/authController.js',
  '/routes/authRoutes.js',
  '/server.js'
]
```

---

## Root Cause

The **npm packages were not installed**. The `package.json` file correctly lists `nodemailer` and `twilio` as dependencies, but `node_modules` folder wasn't created yet.

This happens when:

- Project is first cloned/downloaded
- `npm install` hasn't been run
- Dependencies from package.json haven't been installed

---

## Solution

Run this command in your project directory:

```bash
npm install
```

This will:

1. Read `package.json`
2. Download all dependencies to `node_modules/`
3. Create `package-lock.json` for consistency
4. Install both `nodemailer` and `twilio` packages

---

## What This Installs

**Core Dependencies:**

- `express` - Web framework
- `mongoose` - MongoDB ODM
- `jsonwebtoken` - JWT authentication
- `bcrypt` - Password hashing
- `nodemailer` - Email sending ✅ (was missing)
- `twilio` - SMS sending ✅ (was missing)
- And 10+ more packages

**Dev Dependencies:**

- `nodemon` - Auto-reload on file changes

---

## Verification

After running `npm install`, verify packages are installed:

```bash
npm list nodemailer twilio
```

You should see:

```
school-management-system@1.0.0
├── nodemailer@6.10.1
└── twilio@4.23.0
```

---

## Now Start the Server

```bash
npm start
```

Expected output:

```
✓ MongoDB connected successfully
✓ Server running on port 5000
```

**No more MODULE_NOT_FOUND errors!** ✅

---

## Quick Reference

| Command       | Purpose                                     |
| ------------- | ------------------------------------------- |
| `npm install` | Install all dependencies                    |
| `npm start`   | Start production server                     |
| `npm run dev` | Start development server (with auto-reload) |
| `npm list`    | Show installed packages                     |

---

## What Gets Installed

After `npm install`:

- ✅ `node_modules/` folder created
- ✅ `package-lock.json` file created
- ✅ All 355 packages installed
- ✅ Ready to run the server

---

## If You Still Get Errors

Try clearing and reinstalling:

```bash
# Remove node_modules and package-lock
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Start server
npm start
```

---

## Summary

✅ **Error:** MODULE_NOT_FOUND for nodemailer  
✅ **Cause:** npm packages not installed  
✅ **Fix:** Run `npm install`  
✅ **Result:** All dependencies installed, server starts correctly

**You're all set!** Start the server with `npm start` 🎉
