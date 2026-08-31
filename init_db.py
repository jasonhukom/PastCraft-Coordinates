"""
init_db.py  –  Run once to create the SQLite database, tables, admin account,
               and seed the preset PastCraft nation data.

Usage:
    python database/init_db.py
"""

import sqlite3, hashlib, hmac, secrets, os, sys

DB_PATH   = os.path.join(os.path.dirname(__file__), "pastcraft.db")
SCHEMA    = os.path.join(os.path.dirname(__file__), "schema.sql")
HMAC_KEY  = b"pastcraft-static-hmac-key-2024"   # kept in backend config too

ADMIN_USER = "admin"
ADMIN_PASS = "pastcraftadmin2024"

# ── Preset data (preserves exact spelling / order from spec) ─────────────────

SPAWN = "0 63 0"

PRESET_NATIONS = [
    {
        "name": "United Bavariad Empire",
        "locations": [
            ("Cobblestone Keep", "35 71 -138"),
            ("Ultrixity", "-172 63 -258"),
            ("Plainville", "217 69 -309"),
            ("Ivory Fort", "204 70 -531"),
            ("First Village", "-503 84 -694"),
            ("Graveyard", "-60 69 -516"),
            ("Wither Island", "299 9 -109"),
            ("Prison (WIP)", "-245 50 -723"),
        ],
    },
    {
        "name": "Deshert",
        "locations": [
            ("The Great Pyramid", "2455 213 2232"),
        ],
    },
    {
        "name": "Nipaliterra Republic",
        "locations": [
            ("Nipaliterra City", "3289 65 3064"),
            ("Kota Tua", "3722 63 2701"),
        ],
    },
    {
        "name": "Skyler Nation",
        "locations": [
            ("Main Village", "901 70 -130"),
            ("Watch Tower", "767 117 54"),
        ],
    },
    {
        "name": "Additonal Nations",
        "locations": [
            ("Banical Tropical", "142 69 -847"),
            ("Pirates", "176 69 -166"),
            ("The Robbers", "162 68 -406"),
            ("Graveyard", "-9 69 -197"),
            ("Breeze empire", "-4280 ~ -3440"),
        ],
    },
]

# ─────────────────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return hmac.new(HMAC_KEY, password.encode(), hashlib.sha256).hexdigest()


def main():
    if os.path.exists(DB_PATH):
        print(f"Database already exists at {DB_PATH}. Delete it first to re-seed.")
        sys.exit(0)

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    with open(SCHEMA) as f:
        cur.executescript(f.read())

    # Admin account
    cur.execute(
        "INSERT INTO admins (username, pw_hash) VALUES (?, ?)",
        (ADMIN_USER, hash_password(ADMIN_PASS)),
    )

    # Spawn setting
    cur.execute("INSERT INTO settings (key, value) VALUES ('spawn', ?)", (SPAWN,))

    # Nations and locations
    for nation_order, nation in enumerate(PRESET_NATIONS):
        cur.execute(
            "INSERT INTO nations (name, display_order) VALUES (?, ?)",
            (nation["name"], nation_order),
        )
        nation_id = cur.lastrowid
        for loc_order, (loc_name, coords) in enumerate(nation["locations"]):
            cur.execute(
                "INSERT INTO locations (nation_id, name, coordinates, display_order) VALUES (?, ?, ?, ?)",
                (nation_id, loc_name, coords, loc_order),
            )

    con.commit()
    con.close()
    print(f"Database created at: {DB_PATH}")
    print(f"Admin:    {ADMIN_USER}")
    print(f"Password: {ADMIN_PASS}")


if __name__ == "__main__":
    main()
