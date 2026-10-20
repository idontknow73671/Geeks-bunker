# Geeks Bunker SVG + GN Math

Open `index.svg` directly in a browser. It runs the existing website inside an SVG
document, keeping the Minecraft console interface, artwork, and other menus.
Play G8mes now uses GN Math instead of the old local g8mes.json list.

## GN Math

The implementation follows the supplied Opium reference's GN Math integration:

- Fetch its GN Math catalog mirror at
  https://cdn.jsdelivr.net/gh/freebuisness/assets@main/zones.json
- Resolve game HTML from `freebuisness/html` and covers from `freebuisness/covers`.
- Fetch each game's HTML as text, retain its existing asset base (or add one),
  and run the document inside an in-page iframe. This lets games execute even
  though jsDelivr serves raw .html URLs as plain text.
- Fall back to the upstream `gn-math` GitHub catalog and raw game sources if the
  primary catalog/game source is unavailable.

The gallery has searchable covers, alphabetical ordering, 60-game batches, a game
count, and Load More. Community announcement/comment entries are excluded.
The player has Reload, Fullscreen, Back, and loading/error/retry controls.
Fullscreen hides the entire player toolbar. Press Escape to exit fullscreen and
restore the toolbar.
Menu music pauses while playing and resumes when returning. Back removes the
iframe to stop the game's scripts and audio, and preserves the search/results.

There were 839 playable catalog entries during verification. The catalog is live;
its count and third-party game availability can change. Game saves use whatever
storage each game implements, under the browser origin hosting the site.

Reference supplied by the user:
https://cdn.jsdelivr.net/gh/Mtreasur0133-bit/Shenplslike-1@main/assets/v0001/opium.svg?id=1

Only its GN Math catalog/player approach is used. The other Geeks Bunker menus
keep their existing behavior. `g8mes.json` and its generator are retained for your
files, but Play G8mes no longer depends on the missing local Eaglercraft file.

## jsDelivr deployment

Upload/commit the generated `index.svg` beside these existing assets:

```
index.svg
links.js
mojangles.otf
images/
audio/
```

After pushing the files to main, use:
https://cdn.jsdelivr.net/gh/idontknow73671/Geeks-bunker@main/index.svg

This is a deployment target; no commit, push, or live deployment was performed.
For a stable release, replace main with the full commit SHA containing the files.
The SVG bundles the page, CSS, application module, and GN Math module. The large
website-link catalog, music, images, and font remain separate, so the generated
file stays well below jsDelivr's 20 MB GitHub file limit.

Open the SVG directly or embed it in an iframe/object. An img element disables
SVG scripting and cannot run the interactive website. Avoid automatic .min.svg
conversion for this entry point.

jsDelivr documentation: https://github.com/jsdelivr/jsdelivr#github

## Rebuild and local preview

Edit `index.html`, `style.css`, `script.js`, or `gn-math.js`, then run:

```
python3 build-svg.py
```

No third-party Python packages are needed. Keep the source files, including
`gn-math.js`, for rebuilding and for running the original HTML entry point.
Changes to links.js, images, fonts, and audio do not need an SVG rebuild.

Preview using HTTP rather than double-clicking the file:

```
python3 -m http.server 8766 --bind 127.0.0.1
```

Open http://127.0.0.1:8766/index.svg or index.html.

Saved slots, mute state, and tab settings still use localStorage. Settings from
one hostname do not automatically transfer to a different browser origin.

## Verification

- Validated XML and JavaScript syntax, generated CSS/source inclusion, relative
  asset bases, existing bases, wrapped HTML documents, invalid-source rejection,
  and canceled requests.
- Browser checked the live 839-game catalog, loading another 60 games, case
  insensitive search, empty results, covers, and responsive gallery/player layout
  at 390x844 and 1280x720.
- Ran 2048 inside index.svg, verified its score changed, reloaded it, entered and
  exited fullscreen, and returned to the same search results. OvO also reached
  its rendered game menu, though its upstream unlockalllevels.js emitted errors.
  Checked the HTML entry point's catalog as well.
- The full external catalog was not individually playtested. Game-specific
  browser/WebGL requirements and upstream outages still apply.
- Earlier SVG conversion checks covered menu navigation, saved slots, credits,
  mute, and tab title/icon options. The about:blank launcher created its popup
  and redirected the original tab, but the in-app browser did not expose that
  popup for further inspection; interaction inside it remains a manual check.
