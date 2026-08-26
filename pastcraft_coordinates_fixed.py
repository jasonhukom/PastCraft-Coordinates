# PastCraft Coordinates formatter
#
# Stores each nation as a dictionary of locations, where every location
# keeps its name and coordinate text together (no more separate X/Y/Z lists).
# Supports any number of nations and any number of locations per nation.

LINE = "=" * 64

# Starting data — feel free to edit, clear, or add to this.
# Structure: { "Nation Name": { "Location Name": "coordinate text", ... }, ... }
nations = {
    "United Bavariad Empire": {
        "Cobblestone Keep": "35 71 -138",
        "Ultrixity": "-172 63 -258",
        "Plainville": "217 69 -309",
        "Ivory Fort": "204 70 -531",
        "First Village": "-503 84 -694",
        "Graveyard": "-60 69 -516",
        "Wither Island": "299 9 -109",
        "Prison (WIP)": "-245 50 -723",
    },
    "Deshert": {
        "The Great Pyramid": "2455 213 2232",
    },
    "Nipaliterra Republic": {
        "Nipaliterra City": "3289 65 3064",
        "Kota Tua": "3722 63 2701",
    },
}

# Optional world spawn coordinate line, shown at the very top of the output.
# Leave as an empty string to omit the "# Spawn: ..." line entirely.
spawn_coordinates = "0 63 0"


def add_nation():
    """Ask for a new nation name and let the user add locations to it."""
    name = input("Nation name: ").strip()
    if not name:
        print("Nation name can't be empty — cancelled.")
        return
    nations.setdefault(name, {})
    add_locations(name)


def add_locations(nation_name):
    """Ask for locations (name + one coordinate string) until left blank."""
    print(f'Adding locations to "{nation_name}" (leave the name blank to stop).')
    while True:
        location_name = input("Location name: ").strip()
        if location_name == "":
            break
        # Coordinates are taken as one free-form value, e.g. "35 71 -138"
        # or "-4280 ~ -3440", exactly as typed — nothing is reformatted.
        coordinates = input("Coordinates: ").strip()
        nations[nation_name][location_name] = coordinates


def choose_existing_nation():
    if not nations:
        print("No nations yet — add one first.")
        return None
    print("Existing nations:")
    for name in nations:
        print(f"  - {name}")
    chosen = input("Which nation? ").strip()
    if chosen not in nations:
        print("That nation doesn't exist.")
        return None
    return chosen


def build_output():
    """Build the Markdown-style coordinate list in the required format."""
    output_lines = []

    if spawn_coordinates:
        output_lines.append(f"# Spawn: {spawn_coordinates}")

    for nation_name, locations in nations.items():
        output_lines.append(f"## {LINE}")
        output_lines.append(f"# {nation_name}")
        for location_name, coordinates in locations.items():
            output_lines.append(f"### {location_name}: {coordinates}")

    output_lines.append(f"## {LINE}")
    return "\n".join(output_lines)


def main():
    while True:
        print(
            "\nWhat would you like to do?\n"
            "  1. Add a nation\n"
            "  2. Add a location to an existing nation\n"
            "  3. Generate output\n"
            "  4. Quit"
        )
        choice = input("> ").strip()

        if choice == "1":
            add_nation()
        elif choice == "2":
            nation_name = choose_existing_nation()
            if nation_name:
                add_locations(nation_name)
        elif choice == "3":
            print()
            print(build_output())
        elif choice == "4":
            break
        else:
            print("Please enter 1, 2, 3, or 4.")


if __name__ == "__main__":
    main()
