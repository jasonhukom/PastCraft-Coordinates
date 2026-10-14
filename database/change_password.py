"""
change_password.py – Helper script to update admin username and/or password in pastcraft.db
Usage:
    python database/change_password.py
    or
    python database/change_password.py <username> <new_password>
"""

import sqlite3, hashlib, hmac, os, sys

DB_PATH  = os.path.join(os.path.dirname(__file__), "pastcraft.db")
HMAC_KEY = b"pastcraft-static-hmac-key-2024"

def hash_password(password: str) -> str:
    return hmac.new(HMAC_KEY, password.encode(), hashlib.sha256).hexdigest()

def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: {DB_PATH} not found. Run init_db.py first.")
        sys.exit(1)

    if len(sys.argv) >= 3:
        username = sys.argv[1].strip()
        password = sys.argv[2].strip()
    else:
        username = input("Enter admin username (e.g. admin): ").strip()
        password = input("Enter new password: ").strip()

    if not username or not password:
        print("Error: Username and password cannot be empty.")
        sys.exit(1)

    pw_hash = hash_password(password)
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("SELECT id FROM admins LIMIT 1")
    row = cur.fetchone()

    if row:
        cur.execute("UPDATE admins SET username = ?, pw_hash = ? WHERE id = ?", (username, pw_hash, row[0]))
    else:
        cur.execute("INSERT INTO admins (username, pw_hash) VALUES (?, ?)", (username, pw_hash))

    # Invalidate any old login sessions
    cur.execute("DELETE FROM sessions")

    con.commit()
    con.close()
    print(f"Success! Admin account updated to '{username}'.")

if __name__ == "__main__":
    main()
