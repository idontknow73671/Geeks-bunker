# rename this to .py

import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

GAMES_DIR = os.path.join(BASE_DIR, "g8mes")
OUTPUT_FILE = os.path.join(BASE_DIR, "g8mes.json")

g8mes = []

for filename in os.listdir(GAMES_DIR):
    if filename.lower().endswith(".html"):
        name = os.path.splitext(filename)[0]

        g8mes.append({
            "name": name,
            "url": f"./g8mes/{filename}"
        })

g8mes.sort(key=lambda game: game["name"].lower())

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(g8mes, f, indent=2, ensure_ascii=False)

print(f"Generated {len(g8mes)} g8mes.")

# run with: python3 generate-g8mes.py