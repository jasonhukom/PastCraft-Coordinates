# PastCraft Coordinates

A web application for managing and displaying Minecraft server coordinate lists.

## Architecture

```
Browser
  │
  ├── GET  /                → index.html (served by Flask)
  ├── GET  /api/data        → public JSON — nations and locations from DB
  ├── POST /api/auth/login  → validates credentials, issues session token
  ├── POST /api/auth/logout → revokes session token
  ├── GET  /api/auth/status → checks whether current session is valid
  └── POST /api/data        → (admin only) replaces DB contents
        │
        └── SQLite database  (database/pastcraft.db)
```

Flask serves both the API endpoints and the frontend static files, so there is no separate frontend server to run — just one Python process.

```
PastCraft/
├── frontend/
│   ├── index.html          Single-page app (Homepage + Console)
│   ├── style.css           Dark server-management theme
│   ├── script.js           All app logic (auth, editor, parser, API calls)
│   └── assets/
│       ├── logo_square.png Header logo (square-cropped)
│       └── favicon.png     Browser tab icon (circular)
├── backend/
│   └── app.py              Flask application + all API endpoints
├── database/
│   ├── schema.sql          SQL table definitions
│   ├── init_db.py          One-time setup: creates DB, seeds data, creates admin
│   └── pastcraft.db        Created at runtime by init_db.py
├── pastcraft_coordinates.py  Standalone Python CLI version
└── README.md               This file
```

---

## Requirements

- Python 3.10+
- Flask (`pip install flask`)

No other third-party packages are required. The app uses:
- SQLite (built into Python's standard library)
- `hashlib`, `hmac`, `secrets` (standard library) for password hashing / tokens

---

## Setup (first time)

### 1. Install Flask

```bash
pip install flask
```

### 2. Initialise the database

```bash
python database/init_db.py
```

This creates `database/pastcraft.db` with:
- The admin account (`admin` / `pastcraftadmin2024`)
- All preset nation/location data
- The spawn coordinate (0 63 0)

Run this **once**. If you need to reset, delete `database/pastcraft.db` and run it again.

### 3. Run the backend

```bash
python backend/app.py
```

The server starts on **http://localhost:5000**

Open that URL in your browser.

---

## How the SQL database works

Three main tables:

| Table       | Purpose                                         |
|-------------|------------------------------------------------|
| `admins`    | Admin accounts (username + HMAC-hashed password) |
| `settings`  | Key-value pairs — currently stores `spawn`     |
| `nations`   | Nation names with a `display_order` column      |
| `locations` | Locations linked to a nation via `nation_id`   |
| `sessions`  | Active login tokens with expiry timestamps      |

When the admin clicks **ENTER** in the Console:
1. The frontend calls `POST /api/data` with the full editor state.
2. Flask deletes all existing nations (cascading to locations) and re-inserts them in the provided order.
3. The transaction is atomic — if anything fails the database is unchanged.

When anyone visits the Homepage:
1. The frontend calls `GET /api/data`.
2. Flask reads nations and locations in display_order from the database.
3. The frontend generates the Markdown output client-side.

---

## Admin login

- Navigate to the site.
- Click **Admin** in the top-right header.
- Enter credentials:
  - Username: `admin`
  - Password: `pastcraftadmin2024`
- The Console tab becomes visible.
- Sessions last 8 hours. Refreshing the page does not log you out.

Authentication is handled entirely by the Flask backend. The plaintext password is **never** stored — only an HMAC-SHA256 hash.

---

## Admin Console

Once logged in, click **Console** in the header.

### Manual editing

- **Spawn field** — edit the world spawn coordinate (any string, e.g. `0 63 0`).
- **+ Add Nation** — creates a new nation card with one empty location row.
- Each nation card has:
  - A nation name field.
  - Location rows with name + coordinate string fields.
  - **+ Add Location** to add more locations.
  - **×** buttons to remove individual locations or the entire nation.
- **Reset to DB** — discards unsaved edits and reloads from the database.

### Import Finished Output

At the bottom of the Console there is an **Import Output** section.

1. Paste a complete PastCraft Markdown output into the textarea.
2. Click **IMPORT OUTPUT**.
3. The parser reads the Markdown and populates the editor.
4. Review and edit anything needed.
5. Click **ENTER** to save to the database.

**Important:** Importing does NOT write to the database. Only clicking ENTER does.

### Saving

Click **ENTER — Save to Database** at the bottom-right.

On success you are redirected to the Homepage which shows the updated data.
On failure the error is displayed and you stay on the Console.

### Unsaved changes

If you navigate away (Homepage, logout, browser close) while there are unsaved edits, the app shows a warning dialog. Confirming discards your edits; cancelling keeps you on the Console.

---

## Adding / removing / editing nations

### Via the Console (recommended)

Use the manual editor described above.

### Via the API directly

```bash
# Read current data
curl http://localhost:5000/api/data

# Save new data (requires a valid session token)
curl -X POST http://localhost:5000/api/data \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: YOUR_TOKEN_HERE" \
  -d '{
    "spawn": "0 63 0",
    "nations": [
      {
        "name": "Example Nation",
        "locations": [
          { "name": "Example City", "coordinates": "100 64 -200" }
        ]
      }
    ]
  }'
```

---

## Output format

The generated Markdown is identical to the original Python program:

```
# Spawn: 0 63 0
## ================================================================
# United Bavariad Empire
### Cobblestone Keep: 35 71 -138
### Ultrixity: -172 63 -258
…
## ================================================================
```

This format is also what the **Import** parser reads back in, making the cycle lossless:
`Markdown → Import → Edit → ENTER → Database → Homepage → same Markdown`

---

## Preset data

The preset data is loaded by `database/init_db.py`. It includes all five original nations:

1. United Bavariad Empire (8 locations)
2. Deshert (1 location)
3. Nipaliterra Republic (2 locations)
4. Skyler Nation (2 locations)
5. Additonal Nations (5 locations, including `Breeze empire: -4280 ~ -3440`)

Coordinate strings are stored verbatim — no parsing or validation.

---

## Deployment

For a production server (e.g. a VPS):

1. Use a production WSGI server instead of Flask's development server:
   ```bash
   pip install gunicorn
   gunicorn -w 2 -b 0.0.0.0:5000 backend.app:app
   ```

2. Put Nginx in front of Gunicorn:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
       }
   }
   ```

3. Change `HMAC_KEY` in `backend/app.py` and `database/init_db.py` to a unique secret.

4. Change the admin password via the database:
   ```python
   # Run this once, then store the output hash in the DB
   import hmac, hashlib
   key  = b"your-new-hmac-key"
   pw   = "your-new-password"
   hash = hmac.new(key, pw.encode(), hashlib.sha256).hexdigest()
   print(hash)
   ```

5. SQLite is fine for a single-server deployment. For multiple servers, migrate to PostgreSQL (swap `sqlite3` for `psycopg2`; the SQL is otherwise compatible).

---

## Python standalone version

```bash
python pastcraft_coordinates.py
```

Presents a CLI menu:
1. Add a nation
2. Add locations to a nation
3. Remove a nation
4. Generate output (prints to terminal)
5. Quit

The output format is identical to the website.
