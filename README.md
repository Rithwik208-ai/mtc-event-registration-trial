# MTC Event Registration (Trial)

This trial app stores event registrations in MongoDB Atlas. Use dummy data
during testing; do not enter sensitive personal information.

## Run locally

Install Node.js, then run these commands from the project folder:

```sh
npm ci
npm start
```

The server loads configuration from the private `.env` file in the project
root. It must connect to MongoDB before listening. Open
<http://localhost:3000> for registration, <http://localhost:3000/admin> for the
admin terminal, or <http://localhost:3000/api/health> for the health check.

## Configure MongoDB Atlas

1. In Atlas **Database Access**, use the `mtc_app` database user with
   `readWrite` access to `mtc_registration`.
2. In **Network Access**, allow the addresses that need to connect. For local
   testing, allow your current IP; avoid opening access to every IP address.
3. Select **Connect → Drivers**, choose **Node.js**, and copy the connection
   string.
4. Copy `.env.example` to `.env` if `.env` does not already exist. Set
   `MONGODB_URI` to the Atlas connection string with `/mtc_registration` as the
   database path. URL-encode special characters in the database password.
5. Set `ADMIN_API_KEY` to a long, random administrator access key and
   `SESSION_SECRET` to a different long, random value. Keep all three values
   private. The admin login uses the access key; the MongoDB password is never
   used for administrator access.
6. Restart the server. It creates the required unique student ID index before
   listening. `/api/health` should return
   `{"status":"ok","database":"connected"}`.

The `.env` file and other environment-specific `.env.*` files are ignored by
Git. `.env.example` contains placeholders only. Never commit actual credentials.

## Registration and administration

- `POST /api/registrations` is the public registration endpoint. It validates
  input, normalizes email and student ID, rejects duplicates, and returns a
  reference ID.
- `GET /api/registrations` and `GET /api/registrations/:id` require an
  authenticated administrator session.
- `PUT /api/registrations/:id` and `DELETE /api/registrations/:id` require an
  authenticated session and CSRF token. The dashboard asks for confirmation
  before deleting a record.
- `GET /api/registrations/export.json` and
  `GET /api/registrations/export.xlsx` export database records for an
  authenticated administrator. Excel output is generated with SheetJS and
  excludes MongoDB internal fields.
- Admin login is at `/admin`. Enter the `ADMIN_API_KEY` from the private `.env`
  as the administrator access key. Sessions are stored in MongoDB and use
  HTTP-only, same-site cookies; cookies are secure in production.

The existing public form stays in the cyber-terminal style. Event/Round is an
optional field in the registration model and export; it can be set by
administrators. No event-specific choices are assumed by the trial form.

The npm registry only offers the unpatched `xlsx` 0.18.5 package, which is
affected by high-severity advisories
[GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) and
[GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9).
The project instead installs patched `xlsx` 0.20.3 from the SheetJS
maintainer's official CDN tarball, as documented in the
[SheetJS Node.js installation guide](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
This application only generates spreadsheets and does not parse uploaded
workbooks. `npm audit` reports no vulnerabilities for the installed version.

## API behavior

The API returns JSON errors and appropriate HTTP status codes. Student ID
uniqueness is enforced by a MongoDB unique index, including concurrent
submissions. Admin routes do not accept the administrator key directly after
login; they require the server-side session.

## Deployment on Render

The included `render.yaml` defines the Node web service, `npm ci` build, and
`npm start` command. Before creating a deployment:

1. Push the project to the intended GitHub repository.
2. Create a Render Blueprint and connect that repository. If asked for the
   Blueprint path, use `render.yaml` at the repository root.
3. Add `MONGODB_URI`, `ADMIN_API_KEY`, and `SESSION_SECRET` as private Render
   environment variables. Do not commit secrets or set the laptop as a
   production host.
4. Ensure Atlas Network Access permits the deployed service to connect. Use a
   suitable restricted network policy for production.
5. After deployment, visit the assigned HTTPS URL and check `/api/health`.

The admin session cookie is configured for HTTPS in production and sessions
persist in Atlas. Review privacy, access control, backups, and retention before
using real student information or presenting this trial as production-ready.
