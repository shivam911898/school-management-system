# Public Website + Admin Content Management

This project now includes a no-login public website and admin-controlled content APIs.

## Public pages (no auth)

- `/` - Home
- `/announcements` - public notices only
- `/admissions` - admissions list
- `/fees` - class-wise fee structure
- `/about` - school profile

## Admin content APIs (auth + admin role required)

### Admissions

- `GET /admin/admissions`
- `POST /admin/admissions`
- `PUT /admin/admissions/:id`
- `DELETE /admin/admissions/:id`

Payload:

```json
{
  "title": "Admissions Open 2026",
  "description": "Admissions open for Nursery to 10.",
  "startDate": "2026-04-20",
  "requirements": ["Birth Certificate", "Transfer Certificate"]
}
```

### Fees

- `GET /admin/fees`
- `POST /admin/fees`
- `PUT /admin/fees/:id`
- `DELETE /admin/fees/:id`

Payload:

```json
{
  "className": "Class 6",
  "amount": 1600,
  "details": "Monthly tuition"
}
```

### About

- `GET /admin/about`
- `PUT /admin/about`

Payload:

```json
{
  "description": "School overview",
  "vision": "Our vision",
  "mission": "Our mission",
  "schoolName": "J.C. Memorial School, Nagra, Ballia",
  "heroImage": "/images/school-banner.png"
}
```

### Notice public visibility

- `PUT /admin/notices/:id/public`

Payload:

```json
{
  "isPublic": true
}
```

## Public APIs (no auth)

- `GET /public/notices` (only `isPublic=true`)
- `GET /public/admissions`
- `GET /public/fees`
- `GET /public/about`

## Admin UI

- `GET /admin/public-content` - admissions/fees/about CRUD dashboard
- `GET /notices` - includes `isPublic` controls for notices

## Assets

- School banner: `public/images/school-banner.png`

## Notes

- Existing RBAC/dashboard workflows remain intact.
- Admin routes are protected by role checks.
- Public pages are fully separated and no-login accessible.
