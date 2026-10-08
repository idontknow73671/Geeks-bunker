with open("links.txt", "r", encoding="utf-8") as f:
    links = [line.strip() for line in f if line.strip()]

print(f"Found {len(links)} links.")

with open("links.js", "w", encoding="utf-8") as f:
    f.write("export const links = [\n")

    for i, url in enumerate(links):
        f.write(f"    {url!r}")

        if i < len(links) - 1:
            f.write(",")

        f.write("\n")

    f.write("];\n")

print("Done! links.js has been generated.")

# run with:
# python3 generate-links-js.py