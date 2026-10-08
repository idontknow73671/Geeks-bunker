with open("links.txt", "r", encoding="utf-8") as f:
    links = [line.strip() for line in f if line.strip()]

with open("buttons.html", "w", encoding="utf-8") as f:
    for i, url in enumerate(links, 1):
        f.write(
            f'<a href="{url}" class="custom-button target-portal-link">'
            f'Unnamed Link {i}</a>\n'
        )

print(f"Generated {len(links)} buttons!")

# run with: python3 generate-buttons.py