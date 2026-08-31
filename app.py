"""
PastCraft Coordinates – Flask Backend
-------------------------------------
Endpoints:
  POST  /api/auth/login
  POST  /api/auth/logout
  GET   /api/auth/status
  GET   /api/data            (public)
  POST  /api/data            (admin only – full replace)
"""

import sqlite3, hashlib, hmac as _hmac, secrets, time, os, json
from functools import wraps
from flask import Flask, request, jsonify, g, send_from_directory

# ── Config ────────────────────────────────────────────────────────────────────

BASE      = os.path.dirname(os.path.abspath(__file__))
DB_PATH   = os.path.join(BASE, "..", "database", "pastcraft.db")
FRONTEND  = os.path.join(BASE, "..", "frontend")
HMAC_KEY  = b"pastcraft-static-hmac-key-2024"
SESSION_TTL = 8 * 3600  # 8 hours in seconds

app = Flask(__name__, static_folder=FRONTEND, static_url_path="")

# ── CORS (manual, avoids flask-cors dependency) ───────────────────────────────

ALLOWED_ORIGINS = {"http://localhost:5000", "http://127.0.0.1:5000"}

@app.after_request
def add_cors(response):
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS or True:   # allow all origins for local dev
        response.headers["Access-Control-Allow-Origin"]  = origin or "*"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,X-Session-Token"
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.route("/api/<path:p>", methods=["OPTIONS"])
def options_handler(p):
    return "", 204

# ── DB helpers ────────────────────────────────────────────────────────────────

def get_db():
    if "db" not in g:
        con = sqlite3.connect(DB_PATH)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys=ON")
        g.db = con
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db:
        db.close()

# ── Auth helpers ──────────────────────────────────────────────────────────────

def hash_password(pw: str) -> str:
    return _hmac.new(HMAC_KEY, pw.encode(), hashlib.sha256).hexdigest()


def get_session_token():
    """Pull token from header or cookie."""
    return request.headers.get("X-Session-Token") or request.cookies.get("session_token")


def resolve_admin():
    """Return admin row if token is valid, else None."""
    token = get_session_token()
    if not token:
        return None
    db  = get_db()
    now = int(time.time())
    row = db.execute(
        "SELECT a.id, a.username FROM sessions s JOIN admins a ON a.id=s.admin_id "
        "WHERE s.token=? AND s.expires_at>?",
        (token, now),
    ).fetchone()
    return row


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        admin = resolve_admin()
        if not admin:
            return jsonify({"error": "Unauthorized"}), 401
        g.admin = admin
        return f(*args, **kwargs)
    return wrapper

# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.route("/api/auth/login", methods=["POST"])
def login():
    body = request.get_json(force=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "")
    if not username or not password:
        return jsonify({"error": "Missing credentials"}), 400

    db  = get_db()
    row = db.execute(
        "SELECT id, pw_hash FROM admins WHERE username=?", (username,)
    ).fetchone()

    if not row or row["pw_hash"] != hash_password(password):
        return jsonify({"error": "Invalid username or password"}), 401

    token      = secrets.token_hex(32)
    expires_at = int(time.time()) + SESSION_TTL
    db.execute(
        "INSERT INTO sessions (token, admin_id, expires_at) VALUES (?,?,?)",
        (token, row["id"], expires_at),
    )
    db.commit()

    resp = jsonify({"ok": True, "token": token, "username": username})
    resp.set_cookie(
        "session_token", token,
        max_age=SESSION_TTL, httponly=True, samesite="Lax"
    )
    return resp


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = get_session_token()
    if token:
        db = get_db()
        db.execute("DELETE FROM sessions WHERE token=?", (token,))
        db.commit()
    resp = jsonify({"ok": True})
    resp.set_cookie("session_token", "", max_age=0)
    return resp


@app.route("/api/auth/status", methods=["GET"])
def auth_status():
    admin = resolve_admin()
    if admin:
        return jsonify({"loggedIn": True, "username": admin["username"]})
    return jsonify({"loggedIn": False})

# ── Data endpoint: public read ────────────────────────────────────────────────

@app.route("/api/data", methods=["GET"])
def get_data():
    db = get_db()

    spawn_row = db.execute("SELECT value FROM settings WHERE key='spawn'").fetchone()
    spawn     = spawn_row["value"] if spawn_row else ""

    nations_rows = db.execute(
        "SELECT id, name FROM nations ORDER BY display_order, id"
    ).fetchall()

    nations = []
    for n in nations_rows:
        locs_rows = db.execute(
            "SELECT name, coordinates FROM locations WHERE nation_id=? ORDER BY display_order, id",
            (n["id"],),
        ).fetchall()
        nations.append({
            "name":      n["name"],
            "locations": [{"name": l["name"], "coordinates": l["coordinates"]} for l in locs_rows],
        })

    return jsonify({"spawn": spawn, "nations": nations})

# ── Data endpoint: admin write (full replace) ─────────────────────────────────

@app.route("/api/data", methods=["POST"])
@admin_required
def save_data():
    body = request.get_json(force=True) or {}

    spawn   = str(body.get("spawn", "")).strip()
    nations = body.get("nations", [])

    if not isinstance(nations, list):
        return jsonify({"error": "nations must be a list"}), 400

    db = get_db()
    try:
        db.execute("BEGIN")

        # Update spawn
        db.execute(
            "INSERT INTO settings (key, value) VALUES ('spawn', ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (spawn,),
        )

        # Drop all existing nations (CASCADE removes locations too)
        db.execute("DELETE FROM nations")

        # Re-insert in provided order
        for n_order, nation in enumerate(nations):
            name = str(nation.get("name", "")).strip()
            locs = nation.get("locations", [])
            if not isinstance(locs, list):
                locs = []

            db.execute(
                "INSERT INTO nations (name, display_order) VALUES (?, ?)",
                (name, n_order),
            )
            nation_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]

            for l_order, loc in enumerate(locs):
                loc_name = str(loc.get("name", "")).strip()
                coords   = str(loc.get("coordinates", "")).strip()
                db.execute(
                    "INSERT INTO locations (nation_id, name, coordinates, display_order) "
                    "VALUES (?, ?, ?, ?)",
                    (nation_id, loc_name, coords, l_order),
                )

        db.execute("COMMIT")
    except Exception as e:
        db.execute("ROLLBACK")
        return jsonify({"error": f"Database error: {e}"}), 500

    return jsonify({"ok": True})

# ── Serve frontend ────────────────────────────────────────────────────────────

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path and os.path.exists(os.path.join(FRONTEND, path)):
        return send_from_directory(FRONTEND, path)
    return send_from_directory(FRONTEND, "index.html")

# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("ERROR: database not found. Run:  python database/init_db.py")
    else:
        app.run(host="0.0.0.0", port=5000, debug=True)
