# Geeks Bunker — Dark Liquid Glass edition

The Minecraft interface has been replaced by a modern console dashboard with
horizontal navigation, a game row, quick-access tiles, and your supplied artwork.
The current finish uses dark translucent materials, backdrop blur and saturation,
very low surface tint, lighter blur, soft edge highlights, inset glass cover labels, rounded navigation, and system
typography inspired by iOS/macOS. Custom accent colors and wallpapers are retained.

## The file to upload

`index.svg` is the main app file, approximately 16 MB. It embeds:

- The complete dashboard HTML, stylesheet, application code, GN Math adapter,
  and Lumin adapter.
- Optimized copies of all three supplied wallpapers: Windows 11, PlayStation,
  and macOS. The original files in Downloads were not modified.
- The exact supplied PS4 background theme and select sound, embedded as MP3.
- The original 72,000-website collection, compressed inside the SVG. The app
  decompresses it when Websites is opened.

The dashboard needs no neighboring images, fonts, or audio. Geekfox additionally
requires `geekfox-worker.js` beside `index.svg` on the same origin. Push both files.
The worker handles only Geekfox browsing URLs and leaves dashboard/game requests alone.
G8mes, covers, catalogs, and the official Lumin SDK still load from their online
providers. This is an interactive SVG document with an embedded HTML application;
open it directly in a browser or in an iframe/object, not an img element.

After committing and pushing index.svg and geekfox-worker.js, the existing deployment target remains:
https://cdn.jsdelivr.net/gh/idontknow73671/Geeks-bunker@main/index.svg

For an immutable release, replace main with the commit SHA. No commit, push, or
live deployment was performed as part of this redesign.

## Personalization

A visit notice displays the supplied October 22, 2026 Terms of Service once per tab
session, before first-time setup. Reopen it from Settings > Terms of Service.
The notice preserves the supplied legal text, with the requested g8mes spelling.

First-time setup opens a screen with a display name, six accent colors, and the
three supplied wallpapers. The selections preview immediately and persist in the
browser. Reopen setup from the profile button, Home > Make it yours, or Settings.
The setup screen also accepts separate custom images for the dashboard and
Geekfox new-tab page. PNG, JPEG, WebP, and AVIF files up to 20 MB are resized to
a maximum 2560-pixel edge and stored as image blobs in browser IndexedDB.
Uploads preview immediately; Save changes keeps them, Cancel restores saved
images, and Use default removes a custom image on the next save. Selecting a
built-in wallpaper replaces the dashboard upload. Loaded websites keep their
own appearance. Geekfox > Customize opens the same controls. Clearing site data
removes personal backgrounds; uploads are never sent to a server.
Cancel restores the saved profile; Use defaults completes first-time setup.
Settings also provides separate background-music and PS4-select-sound switches,
a music volume slider, reduced motion,
custom tab title/icon, and the existing about:blank launcher.

There is no active Minecraft artwork, pixel font, textured button treatment, or
Minecraft soundtrack. Legacy assets remain in the source checkout so existing
files are not destroyed, but the dashboard does not reference them.

Existing saved website slots and browser-tab preferences are retained under the
same localStorage keys. Website search, custom links/deletion, the full collection,
Feeling lucky, credits, GitHub, and Discord links remain available. Storage is
per browser origin; changing hostnames does not transfer browser settings.

## Supplied PS4 audio

The supplied ten-minute PS4 theme loops quietly at 18% volume. It starts after a
click, tap, or keyboard interaction; the browser never needs autoplay permissions
to be changed. The speaker button in the header turns music on/off immediately.
Settings provides a second switch and a volume slider; these preferences persist.
Menu music pauses during a game and resumes when returning to the dashboard.

The supplied PS4 select MP3 replaces the synthesized tick on interface actions.
Select sounds have their own switch and remain independent of the music setting.
Duplicate calls during the same selection are suppressed to avoid doubled sounds.

The source audio copies are audio/ps4-menu.mp3 and audio/ps4-select.mp3. The files
in Downloads are untouched. Both are included in index.svg, keeping the app a
single SVG for dashboard media. The approximately 16 MB output remains below the 20 MB GitHub-file
limit used by jsDelivr. Existing interface settings and game integrations remain.

## Both game libraries

GN Math is retained as its own tab, using the catalog/player approach from the
previously supplied Opium reference. Game HTML is fetched and run in an iframe,
with its asset base preserved or supplied. Fallback sources and retry remain.

Lumin uses the official SDK as in the supplied Nocturne reference:

- SDK: https://cdn.jsdelivr.net/gh/luminsdk/script@main/lumin.min.js
- Lumin.init({headless:true})
- Lumin.getGames({page,limit:100}), including paginated results
- Lumin.getImageUrl(image_token) for visible game covers
- Lumin.getGameUrl(id) to launch a game in the shared player

The adapters keep provider catalogs separate. Each has search, game counts, lazy
covers, 60-game batches, and Load more. Home shows featured GN Math g8mes and the
most recently played game. Recent-game metadata persists across reloads.

The shared player provides Reload, Fullscreen, and Back to library. Fullscreen
hides the complete toolbar; Escape restores it. Closing the player removes the
iframe to stop the game's scripts/audio. The search and page behind it are kept.
Provider availability, host permissions, and game-specific browser requirements
remain controlled by the upstream services; an error in one provider leaves the
other provider accessible.

Reference: https://cdn.jsdelivr.net/gh/dorianhagar506-coder/nocturne-ud77zk@main/Nocturne-1-1-2tai.svg
Only the Lumin SDK integration is used; the reference's advertising scripts and
application branding are not included.

## Source and rebuilding

Keep these source files for editing: index.html, style.css, script.js, gn-math.js,
lumin.js, g8me-saves.js, geekfox.js, geekfox-engine.js, geekfox-worker.js, build-svg.py, links.js,
images/wallpapers/, images/geekfox.png, and the two audio/ps4-*.mp3 files.

```
python3 build-svg.py
python3 -m http.server 8766 --bind 127.0.0.1
```

Open http://127.0.0.1:8766/index.svg. The builder uses only Python's standard
library. index.html remains an editable HTML entry point using the source modules
and wallpaper files; the generated SVG embeds dashboard sources and media, plus the Geekfox UI and
controller bootstrap. Its worker remains a companion file because browsers require
a real same-origin worker script URL.

## Verification

- Verified actual browser music playback after interaction, mute/unmute, saved
  mute across reloads, the volume slider, independent select-sound preference, and
  resuming music after gameplay. The audio files embedded in the SVG exactly match
  the supplied originals.
- Tested audio logic for looping, first-interaction startup, soft gain, saved music
  preferences, select-sound deduplication, independent mute, and game pause/resume.
- Validated SVG XML, generated JavaScript syntax, all 72,000 embedded links,
  all three embedded wallpapers, and the absence of active Minecraft styling.
- Tested setup selections, live preview, saving, reopening, and reload persistence.
- Browser checked desktop 1280x720 and mobile 390x844 layouts, including the
  dark glass dashboard, setup dialog, library controls, and text readability.
- Both live catalogs connected: 839 GN Math entries and 795 Lumin entries during
  verification. Counts and third-party availability can change.
- Launched 2048 through Lumin and verified keyboard play increased its score.
  Launched GN Math's 2048 and verified gameplay, toolbar-free fullscreen, Escape,
  and returning to the dashboard. The full catalogs were not individually tested.
- Verified the 72,000-link collection, saved-link creation/deletion, and existing
  settings controls. Checked the SVG from a directory containing only index.svg,
  proving the dashboard and collection do not depend on neighboring assets.
- Tested adapter helpers for asset bases, wrapped HTML, invalid-source rejection,
  canceled requests, Lumin pagination/deduplication, cover tokens, and game URLs.
- The existing about:blank popup mechanism is retained; a complete interaction
  check inside that separate popup remains a manual browser check.

Interaction motion uses short eased button presses, sliding navigation and provider indicators, and soft page and dialog entrances. Customization choices keep keyboard focus as their selection changes. Both the system reduced-motion preference and the dashboard Reduce motion setting disable these effects.

## Geekfox

Geekfox replaces the old p8y service-homepage embeds. It has its own Firefox-inspired
horizontal tabs, address/search bar, back/forward history, reload, bookmarks,
new-tab shortcuts, close-tab controls, and fullscreen. Bookmarks stay in localStorage;
open tabs are deliberately ephemeral. Switching tabs retains the loaded pages.

The browser controller runs in the outer SVG document, registers the companion
worker, and uses the reference's client-side rewriting engine and shared relay pool.
A content iframe still renders each rewritten website, as in the reference; it is
not an embedded third-party browsing homepage. Address and title changes follow
in-page navigation. The engine loads only on the first website visit.

Runtime assets are pinned to reference commit
8b35ef07ef9788b060a78fbb504112e28e134b1d. The CDN provides the upstream rewriter,
controller, injected client, WASM, and relay transport. Our companion worker does
not include the reference's release updater, ads, tracking scripts, or account UI.
Geekfox uses the public basic relay connections without payment keys or accounts.
Shared service availability and future pricing are controlled by their operators;
there is no paid fallback or billing integration in this project.

Publish `index.svg` AND `geekfox-worker.js` in the same repository directory.
The address you open and the worker must use the same host and revision segment;
for example both should be under the same jsDelivr @main path. Purge both URLs
after publishing updates. HTTPS is required, with localhost allowed for development.
Do not rename external runtime paths: they are part of the pinned service protocol.
User-facing branding is Geekfox; internal feature routing retains p8y.

Reference: https://cdn.jsdelivr.net/gh/lucideproxy/svg@HEAD/index.svg

Verified actual SVG browsing through the shared relay, live document titles,
rewritten links, navigation from example.com to IANA, and back/forward between
those pages. Verified independent tabs and bookmark visibility on a new tab.

## Local g8me progress

GN Math titles receive a stable localStorage namespace based on provider and catalog
ID. Reloading, changing mirrors, and changing the repository revision do not change
that namespace when the site origin stays the same. Requested legacy keys are
imported without deleting the original shared data. A title's clear/reset cannot
clear another title's new saves or dashboard settings. Native IndexedDB remains
intact to preserve existing saves. Completed write transactions update save status;
closing/reloading a title waits briefly for pending writes and supported FS/IDBFS
sync. Save status reports unavailable/full storage rather than claiming success.

The GN Math 2048 AI entry lacks native persistence, so it additionally stores and
restores its board, score, turn, and win/loss flags after every move. Its existing
restart action still starts a fresh board. Actual close/reopen and full site reload
checks restored a 16-point board and identical tiles.

Lumin stays on its provider origin and keeps provider-managed save behavior.
Not every title exposes a save feature; this does not create universal emulator
snapshots or cloud saves. Use the same browser/site origin; private browsing or
clearing site data can remove progress.

The supplied images/geekfox.png is copied unchanged and embedded in the SVG for
the browser toolbar and new-tab logo. The site's labels use g8mes; external SDK
field/method names and third-party URLs remain intact for compatibility.

## YourGeek — powered by Duck.ai

YourGeek in the top navigation opens a custom glass chat workspace using the existing
Geekfox engine and companion worker. Chat requests still run through this p8y
connection to Duck.ai; this is not a direct iframe embed. Geekfox's new-tab shortcuts also include
Duck.ai. The provider's live model picker exposes its currently available models;
there is no frozen or invented model list in the source. Free chat does not need
a Geeks Bunker account or an API key. DuckDuckGo's free limits still apply, and
premium entries keep their subscription requirements. The room does not accept
terms, solve challenges, or purchase access automatically.

Reload reconnects to Duck.ai; fullscreen gives its conversation the entire
screen, and Escape/Exit fullscreen restores the dashboard. Chat state stays in
the mounted provider view when navigating around the dashboard. A connection
error provides Retry and a direct Duck.ai link; relay failure is never shown as
an AI-generated answer. Duck.ai's privacy and terms disclosures remain visible.
No backend keys, scraped chat endpoints, or fake AI responses are included.

Validation on October 22, 2026: the built SVG loaded Duck.ai through Geekfox;
its live picker showed six free models and four locked subscription models.
Switching to Claude Haiku 4.5, fullscreen/exit, and a 390-pixel mobile layout
were checked. After user-authorized acceptance of Duck.ai terms, the free
Claude model returned the requested live reply: "Duck.ai is connected".

YourGeek is implemented in yourgeek.js. Its compact header, Y monogram, chat
welcome area, and composer theme are scoped to the AI view. Powered by Duck.ai
attribution, provider terms, privacy controls, and the live model menu remain.
The provider theme attaches after its interface renders and follows navigation;
if the provider changes its markup, the underlying chat remains available.
