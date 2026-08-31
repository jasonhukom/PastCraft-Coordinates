"""
PastCraft Coordinates formatter (standalone Python version)
-----------------------------------------------------------
Stores nations and locations in a nested dict structure so that
X, Y, Z are always together per location. Supports any number of
nations and locations. Generates the exact same Markdown output as
the website.

Usage:
    python pastcraft_coordinates.py
"""

LINE = "=" * 64

# ── Preset data (exact preset from the PastCraft server) ─────────────────────
# Structure: { "Nation Name": { "Location Name": "coord string", … }, … }
# Coordinates are kept as a single string; special values like "~ " are valid.

SPAWN = "0 63 0"

nations: dict[str, dict[str, str]] = {
    "United Bavariad Empire": {
        "Cobblestone Keep": "35 71 -138",
        "Ultrixity":        "-172 63 -258",
        "Plainville":       "217 69 -309",
        "Ivory Fort":       "204 70 -531",
        "First Village":    "-503 84 -694",
        "Graveyard":        "-60 69 -516",
        "Wither Island":    "299 9 -109",
        "Prison (WIP)":     "-245 50 -723",
    },
    "Deshert": {
        "The Great Pyramid": "2455 213 2232",
    },
    "Nipaliterra Republic": {
        "Nipaliterra City": "3289 65 3064",
        "Kota Tua":         "3722 63 2701",
    },
    "Skyler Nation": {
        "Main Village": "901 70 -130",
        "Watch Tower":  "767 117 54",
    },
    "Additonal Nations": {
        "Banical Tropical": "142 69 -847",
        "Pirates":          "176 69 -166",
        "The Robbers":      "162 68 -406",
        "Graveyard":        "-9 69 -197",
        "Breeze empire":    "-4280 ~ -3440",
    },
}

spawn_coords: str = SPAWN

# ─────────────────────────────────────────────────────────────────────────────


def build_output() -> str:
    """Generate the Markdown coordinate list in the PastCraft format."""
    lines: list[str] = []

    if spawn_coords.strip():
        lines.append(f"# Spawn: {spawn_coords}")

    for nation_name, locations in nations.items():
        lines.append(f"## {LINE}")
        lines.append(f"# {nation_name}")
        for location_name, coordinates in locations.items():
            lines.append(f"### {location_name}: {coordinates}")

    lines.append(f"## {LINE}")
    return "\n".join(lines)


# ── Interactive CLI ───────────────────────────────────────────────────────────


def choose_nation() -> str | None:
    if not nations:
        print("No nations yet — add one first.")
        return None
    print("\nExisting nations:")
    for name in nations:
        print(f"  - {name}")
    chosen = input("Which nation? ").strip()
    if chosen not in nations:
        print(f'Nation "{chosen}" not found.')
        return None
    return chosen


def cmd_add_nation() -> None:
    name = input("Nation name: ").strip()
    if not name:
        print("Cancelled — name cannot be empty.")
        return
    if name in nations:
        print(f'Nation "{name}" already exists.')
        return
    nations[name] = {}
    print(f'Nation "{name}" added.')
    cmd_add_locations(name)


def cmd_add_locations(nation_name: str | None = None) -> None:
    if nation_name is None:
        nation_name = choose_nation()
    if nation_name is None:
        return
    print(f'Adding locations to "{nation_name}" (leave name blank to stop).')
    while True:
        loc_name = input("  Location name: ").strip()
        if not loc_name:
            break
        coords = input("  Coordinates:   ").strip()
        nations[nation_name][loc_name] = coords
        print(f'  → "{loc_name}: {coords}" added.')


def cmd_remove_nation() -> None:
    name = choose_nation()
    if name is None:
        return
    confirm = input(f'Remove "{name}" and all its locations? [y/N] ').strip().lower()
    if confirm == "y":
        del nations[name]
        print(f'Nation "{name}" removed.')


def cmd_show_output() -> None:
    print()
    print(build_output())
    print()


MENU = """\
─────────────────────────────────────
PastCraft Coordinates
─────────────────────────────────────
  1  Add a nation
  2  Add locations to an existing nation
  3  Remove a nation
  4  Generate output
  5  Quit
─────────────────────────────────────"""


def main() -> None:
    global spawn_coords
    print(MENU)
    while True:
        choice = input("Choice > ").strip()
        if choice == "1":
            cmd_add_nation()
        elif choice == "2":
            cmd_add_locations()
        elif choice == "3":
            cmd_remove_nation()
        elif choice == "4":
            cmd_show_output()
        elif choice == "5":
            break
        else:
            print("Please enter 1–5.")
        print(MENU)


if __name__ == "__main__":
    main()
