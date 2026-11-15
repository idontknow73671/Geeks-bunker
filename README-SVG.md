# Geeks Bunker — Dark Liquid Glass edition

Current build: publish `index.svg` and generated `geekfox-worker-corp-v2.js`.
`build-svg.py` generates that worker from `geekfox-worker.js`. Keep the unversioned
worker for older cached builds. The versioned filename avoids stale CDN copies.


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

## Geekfox connections

Geekfox uses the shared fallback pool listed in `geekfox-engine.js`. The November
12 update adds five backends published in Achroma's deployment: Aude, Bike, Idea,
Shred, and ALCRB. Each passed an actual HTTPS fetch of example.org through the
bundled transport, not just a WebSocket handshake. The Mercury demo endpoint
was removed: its operator requests no public-site usage and caps bandwidth.
Connectivity selection tries both Google's generate_204 endpoint and example.org;
one blocked connectivity hostname no longer rejects an otherwise working relay.

Automatic is the default. If a connection fails, GET/HEAD requests try the other
available connections; recently failed connections get a short cooldown. Ordinary
HTTP errors do not rotate servers, and form submissions are never automatically
sent twice. Existing WebSocket sessions and interrupted response bodies are not
replayed; use Reconnect to reload the open Geekfox tabs if needed.

The P8y connection picker lets you prefer a specific connection, with fallback
still enabled. The preference survives reloads. Reconnect checks the connections
again and reloads open tabs. YourGeek shares the browser connection pool; movie
connections keep separate transport instances. These are third-party public
services, so availability can change, and multiple domains may share infrastructure.

Rebuild with `python3 build-svg.py`, push `index.svg` and `geekfox-worker.js`, and
purge the corresponding jsDelivr URLs. Source edits alone do not update the SVG.

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
lumin.js, g8me-saves.js, media.js, geekfox.js, geekfox-engine.js, geekfox-worker.js, build-svg.py, links.js,
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

Compatibility profile offers Automatic (the real browser identity), Firefox / Gecko,
and Chrome / Chromium. The latter two change outgoing User-Agent headers and the
page-visible navigator identity; they do not install or switch rendering engines.
Changing profiles reloads open Geekfox tabs, and the selection persists under
gbGeekfoxProfile. YourGeek retains the default browser identity independently.
Validated both outgoing headers and page-visible identity, plus reload persistence.

The browser controller runs in the outer SVG document, registers the companion
worker, and uses the reference's client-side rewriting engine with the connection pool described above.
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

Geometry Dash (GN Math ID 868) requests native saves every three seconds and
before leaving. This port writes AppData/CCGameManager.dat and AppData/CCLocalLevels.dat
to IndexedDB but reads them directly from /Resources on startup; the adapter
corrects those two restore paths without clearing existing records.
Its WASM save hook queues work on the game loop: the player now
waits for that work, delayed database opens, and subsequent write transactions
before destroying the frame. Pending writes keep the player open for retry.
This preserves the title's native records and settings, not an in-progress jump.
Verified October 23, 2026 in the built SVG: played Stereo Madness to 1%, closed
the player, reloaded the entire site, reopened the title, and confirmed 1% restored.
Regression checks cover delayed native saves, database-open/write timing, corrected
restore paths, title isolation, legacy storage, and filesystem flush.

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


## AudibleGeek and GeekMovie

The October 24, 2026 update replaces the previous media backend with the services
used by https://cdn.jsdelivr.net/gh/achroma-ubg/svg@latest/index.svg.
The interface remains native to Geeks Bunker with its glass styling, saved accents,
backgrounds and reduced-motion controls. The reference's app bundles, analytics,
account features and advertising are not copied.

AudibleGeek uses /api/music/ytm/home and /api/music/ytm/search, decoding the streamed
SSE data records, and plays /api/sp/audio/{id} directly. It uses the first three
public API hosts listed by the reference, with failover on catalog/search errors.
The active host is stored under gbMediaAPI. It sends no account credentials or
third-party session identifiers. Music search, discovery, liked tracks, queue,
previous/next, shuffle, repeat, seeking and volume remain. Local audio files are
also supported. Unsupported MP3/lossless quality choices were removed because
the replacement endpoint supplies its own audio format. Playback controls stay
visible while browsing long lists. The PS4 menu theme pauses during media use.

GeekMovie uses /api/movies/home?type=movie and /api/movies/search, with the reference's
image endpoint and normalized title fields. Popular, Top rated, Discover, the
combined collection, search and the saved watchlist remain. The source menu uses
the reference's VidZee, vidsrc.su and CineSrc player URLs directly, without the
previous source-list API or shortened links. Source choice persists. Movies use
a separate Geekfox media connection with the shared fallback pool above;
regular Geekfox browsing and YourGeek retain their own connection instance.
The two required publication files remain index.svg and geekfox-worker.js.

Live validation on October 24, 2026 in the built SVG: music discovery returned
98 tracks, Daft Punk search returned playable results, and Instant Crush streamed
with its timeline advancing beyond 20 seconds. Pause, seeking and liked-track persistence after a full SVG reload were verified.
Inception loaded on VidZee, reported its 2:28:07 duration, rendered movie frames
and advanced beyond two minutes; pause/resume and toolbar-free fullscreen worked.
These checks confirm the tested streams worked at that time, not that every
provider/title will always be available. No paid access or API keys were added.

## Media requests on Chromebook

AudibleGeek and GeekMovie send catalog and search requests through Geekfox's
WISP transport, rather than direct browser fetch calls to the API domains. The
media transport has the same shared fallback pool and is kept separate
from open browser tabs. API redirects are followed through the transport too.

Posters, covers, and online audio use same-origin geekfox-content URLs served by
the companion worker. Audio stays streamed, with Range requests and seeking;
tracks are not downloaded into large JavaScript blobs. Movie player documents
and their resources continue through the rewritten Geekfox player. Local music
files stay local. This requires HTTPS and geekfox-worker.js beside index.svg.

Verification used a local Content Security Policy that blocks direct connections
to the media API hosts, direct external artwork, and direct external audio. Music
and movie catalogs, both searches, artwork, music playback/seeking, and movie
playback worked through p8y under that policy. This reproduces blocked direct
media requests, not a particular Chromebook's network configuration. A network
that blocks every WISP endpoint can still prevent the connection itself.

## Additional jsDelivr p8y projects

The DayDream X static deployment is available at
https://cdn.jsdelivr.net/gh/NightProxy/DD-Static/dist/index.svg . Its published
connection generator uses a 16–32 character subdomain beneath
nightwisp.me.cdn.cloudflare.net, with /wisp/ as the WebSocket path. Geekfox uses
one stable subdomain in that format, geeksbunkerconnect, rather than generating
new addresses on each request. Mercury's wisp.mercurywork.shop/wisp/ endpoint
is documented by the independent vi SVG project's README. Both fetched
Wikipedia successfully during local testing. They are tried before the previous
pool and also serve the media transport.

The independent vi SVG front end was also inspected with Mercury configured:
https://cdn.jsdelivr.net/gh/zaka13alt/svgembeds@main/uvv.svg?wisp=wss%3A%2F%2Fwisp.mercurywork.shop%2Fwisp%2F

That vi front end failed its own navigation test and is not linked from the app;
Mercury worked through Geekfox's transport. Both front-end URLs contain
cdn.jsdelivr.net. Their relay hostnames are separate;
these links do not make the relay traffic travel through jsDelivr itself. The
PeteZah static deployment was also inspected, but its advertised fallback relay
failed a real fetch and was not added. Mirrors of Lucide were not counted as
independent providers. No guarantee is made about reachability on a school network.

## YourGeek chat history

YourGeek now has a Chat history button with local title search and conversation
shortcuts. Opening or using a Duck.ai conversation records its canonical chatID
and title under gbYourGeekHistoryV1. Reopening a shortcut navigates to Duck.ai's
saved conversation, including its existing messages and reply composer. Existing
Duck.ai chats can be reached through Open Duck.ai history and are added to the
YourGeek list when opened. Chat transcripts stay in Duck.ai's browser storage;
YourGeek does not upload a second copy. Removing a shortcut does not delete the
provider conversation. Clearing browser/site data can remove both kinds of local
history. The list keeps at most 100 conversations and reports storage failures.

## Geekfox add-ons

Open Geekfox → Add-ons to enable Larger text, Reduce motion, or Hide images and
video. Changes apply immediately to open Geekfox pages and on subsequent page
loads. Preferences and imported add-ons stay in local browser storage. The VPN
setup cards have been removed from Settings.

Import a Geekfox style add-on as JSON with `format: "geekfox-style-v1"`, a `name`,
optional `description`, `hosts` (exact hostnames, `*.example.com`, or `*`), and
`css`. Download example in the manager supplies an editable working file. Imports
start disabled. Enable one to apply it; disable or remove it to undo its styles.
Limit: 20 imported add-ons, 64 KiB per file, 40,000 CSS characters. External CSS
imports and URL resources are rejected. Scripts are handled separately by the Firefox package importer below. Only the main
Geekfox page is styled, not nested site frames or other dashboard sections.

## G8me launch compatibility

The normal launch and existing per-title saves remain the default. Large GN Math
document downloads now get up to 60 seconds instead of 20. The player ignores its
initial blank iframe load, reports document/connection errors, and offers retry
when loading exceeds a minute. Pointer interactions focus the active g8me frame.

Launch through p8y offers an alternate route for blocked assets or titles that
need a real page URL rather than srcdoc. A dedicated g8me controller/transport is
kept separate from AI, browser, and media connections. Its HTTP session is refreshed
between alternate launches. The selected GN Math document is unwrapped and given
its correct asset base before rewriting; its CDN text/plain/download headers are
normalized to HTML. Other fetched resources are not forced to HTML. Direct launch
can be selected again. Reload retries the current launch mode.

P8y mode uses separate, provider-managed browser saves; direct-mode save adapters
and existing direct saves are not copied to it. Use direct launch to return to an
existing direct save. Lumin retains its SDK/provider-managed save behavior.

Verified: saved YourGeek chat survives SVG reload, reopens with messages and reply
composer, search has an empty state; Quake III renders its menus with keyboard
navigation in direct and p8y launch; 2048 responds to keyboard input through p8y and switching back to direct restores
its earlier score/board. Lumin loads its catalog.
The entire third-party catalog and a physical Chromebook have not been certified.


## Firefox package compatibility

Geekfox → Add-ons → Import Firefox package accepts actual `.xpi` and ZIP
WebExtension archives. Importing only inspects the package. Review its name,
version and matching sites, check the trust/access checkbox, then choose Install
and enable. Packages and enabled state are stored locally in IndexedDB, not
embedded in the SVG or uploaded to a server. Limit: ten installed packages,
10 MiB compressed per package, 30 MiB expanded, 8 MiB per file, 1,500 entries.
The reader validates ZIP structure, decompressed lengths and CRC32; it rejects
encryption, ZIP64, directory traversal, duplicate files and missing scripts.
It does not verify Mozilla package signatures.

Supported compatibility surface:

- Manifest V2 and V3 declarative `content_scripts`, top Geekfox document only,
  at `document_idle`. HTTP/HTTPS match patterns and `exclude_matches` use the
  original website URL. Scripts run once per document, in declared order with
  a shared per-extension lexical scope. SPA URL changes do not rerun scripts.
- Packaged JavaScript and CSS, plus packaged images/fonts through
  `runtime.getURL()` or relative CSS URLs. Resources use local data URLs.
  CSS imports/external resources are not supported.
- `browser` and `chrome` aliases; `runtime.id`, `runtime.getManifest`,
  `runtime.getURL`, `runtime.getBrowserInfo`, `extension.getURL`;
  `i18n.getMessage`, `getUILanguage`, `getAcceptLanguages` (default locale).
- With declared `storage` permission: per-extension `storage.local.get`, `set`,
  `remove`, `clear`, `getKeys`, `getBytesInUse` and change listeners. Promise and
  callback forms are supported. Storage is capped at 2 MiB per extension.
- Enable, disable and remove, with reloads of Geekfox tabs to reset running
  scripts. Removing a package retains its local settings until site data is
  cleared. Runtime errors appear beside the package when identifiable.

This is a compatibility layer for trusted page extensions, not Firefox itself.
Background scripts/workers, toolbar popups, options pages, subframe injection,
`document_start`/`document_end`, request interception/blocking, native messaging,
Firefox preferences and VPN APIs are unavailable. Required unsupported manifest
features/permissions are rejected with their names. Optional permissions are not
granted. Scripts can also depend on undeclared APIs; these may fail at runtime.
Content scripts execute in the page context, without Firefox's isolated worlds,
and may access other Geeks Bunker site data. Only install packages you trust.
Firefox/Chrome stores are not installed into the host browser by this feature.

Verification: an XPI built from Mozilla's unmodified Borderify example ran on
mozilla.org and drew its red border. A separate local fixture verified ordered
multi-file JavaScript, CSS, packaged images, runtime metadata, extension storage
and a visit counter persisting after a full SVG reload. Disabling the fixture
reloaded the page without its injected content. A background-dependent fixture
was rejected before installation. Run package parser/manifest tests with
`node --test tests/geekfox-webextensions.test.mjs`.

Mozilla sample: https://github.com/mdn/webextensions-examples/tree/main/borderify
API reference: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions


## Native blocker and YouTube dislike counts

Geekfox → Add-ons → Built-in browsing tools has two independent, optional tools:

- **Geekfox ad & tracker blocker** uses the bundled Ghostery filtering engine
  2.20.1 with EasyList and EasyPrivacy. Matching network requests receive a local
  empty response before reaching a relay. Basic cosmetic rules hide matching
  page elements. Allow the current site to pause its filtering; Resume blocking
  restores it. Both the switches and site allowlist survive reloads.
- **YouTube dislike counts** reads the Return YouTube Dislike `/votes` endpoint
  through Geekfox's existing relay transport. It shows estimated dislikes beside
  the video's like/dislike group, or a small page badge when the native group is
  unavailable. Counts cache for ten minutes (up to 100 videos), update on YouTube
  page navigation, and have timeout/error/retry handling. It does not register an
  RYD account, submit votes, or change YouTube's voting behavior.

These features are native integrations. They do not make the full uBlock Origin
or Return YouTube Dislike Firefox packages compatible with the XPI importer.
uBlock needs a background page and privileged blocking APIs; the current RYD
package also needs a background script. Imported packages retain the documented
compatibility checks.

The Geekfox switch controls browsing tabs. The g8me player now has its own
independent blocker switch using the same bundled filter engine (see below).
Neither switch filters unrelated browser tabs or the whole device. It does not execute
uBlock scriptlets, perform dynamic filtering, or reliably remove YouTube video
ads. One YouTube video ad remained visible during testing. Filter lists are a
bundled snapshot, not an automatic update subscription. The snapshot's provenance
and licenses are in `vendor/FILTER-SOURCES.md`, `BLOCKER-NOTICES.txt`, and the
accompanying source/license files. Both the filtering engine and compressed lists
are embedded in the SVG; only the RYD data service needs an additional online
request, routed through Geekfox.

Verification: a live YouTube page reported 25 matched requests blocked and
521,713 estimated dislikes from the live RYD API. Counts can change over time.
An integration probe received HTTP 204 for a blocked analytics script; allowing
the current site made the same request return HTTP 200. Unit tests cover real
filter matches, exceptions, cosmetic rules, site allowlisting, video URL checks,
relay-only RYD fetches, rate limits and invalid API data. Run:
`node --test tests/geekfox-features.test.mjs tests/geekfox-webextensions.test.mjs`.
For the manual integration fixture, copy `tests/geekfox-features-harness.html`
to the root as `geekfox-features-check.html` while testing, serve the checkout,
and remove that temporary copy when finished (the worker must be beside it).


## P8y g8me loading and display fitting

P8y requests now cancel their header deadline once headers arrive, so the same
deadline cannot cut off a still-streaming WASM or data download. G8me requests
allow 60 seconds for response headers; caller cancellation remains connected.
P8y navigates the g8me iframe to its original URL through Geekfox. It no longer
prefetches the document or assigns its HTML to srcdoc. GN CDN responses still
have their document content type normalized inside the rewriter. Try again
rotates GN document mirrors after a failed p8y launch.

Fixed-size canvas g8mes scale up or down to fit the player while preserving the
canvas aspect ratio. The whole frame scales together, keeping HTML overlays and
pointer coordinates aligned; the native rendering buffer is unchanged. Small,
stretched, and oversized/cropped canvases are handled, including player resizing
and fullscreen. Unused space stays black. Already responsive canvases are left
alone. Cross-origin direct provider frames retain their own sizing behavior
because the parent cannot inspect their canvas.

Verification includes a regression that fails against the previous transport,
mirror fallback and cancellation checks, and viewport geometry tests. Browser
checks covered a 640-by-480 fixture in landscape, portrait, and fullscreen, with
a round test pattern and correctly mapped center click. Half-Life reached its
menu through p8y; a separate fixed-resolution Half-Life check displayed its full
4:3 menu without cropping. Full Half-Life gameplay and the entire catalog have
not been certified. Run all tests with `node --test tests/*.test.mjs`.


### Player display controls

Open **Display** in the g8me toolbar to choose Automatic, 640×480, 1280×720,
1920×1080, or a custom viewport (320–7680 wide, 240–4320 high). Choose
**Stretch to fill screen** to use independent horizontal and vertical scaling;
leave it off to preserve the canvas proportions. Apply updates the running player
without reloading the g8me and saves the selection in this browser. These are
viewport dimensions, not a guarantee of a particular native rendering resolution.
Fixed canvases use contain/fill within the selected viewport; direct cross-origin
providers still control their own internal layout. Controls hide in fullscreen
along with the toolbar. Browser verification covered Half-Life at a 640×480
preset and custom 800×600, with stretch both enabled and disabled.


### Built-in auto-clicker

Open **Auto-clicker** in the g8me toolbar. It follows the live cursor inside
accessible g8me frames; no target selection is required. Move over the g8me and
press the configured hotkey, or press Start and then move into the g8me. Moving
into the toolbar or outside the g8me suspends input until the cursor returns.
Resizing clears stale coordinates until the next pointer movement.

Choose an interval from 10 to 60,000 milliseconds and an optional click limit
(0 means unlimited). The default hotkey is F8; click its button to record a
letter, digit, Space, or F1–F12, optionally with Ctrl, Alt, or Shift. Escape
stops clicking or cancels recording. Text fields ignore toggle hotkeys. The
interval, limit, and hotkey persist; cursor position and running state do not.
The fullscreen stop indicator remains available. Leaving the tab or changing
g8mes stops the loop. Direct cross-origin frames may require p8y.

Mouse events now use detail:1. Cookie Clicker treats detail:0 as keyboard
input and applies a much lower click-rate limit. For its bigCookie element,
the counter reads the change in Game.cookieClicks after normal event dispatch
and only counts accepted clicks; rejected clicks do not consume the limit.
No cookies or g8me state are written directly. In other g8mes the counter is
explicitly labelled clicks sent, since their internal input acceptance cannot
be inferred universally. Browser timing and native g8me rate limits still apply.

Verified at a requested 10 ms interval: 100 accepted auto-clicks increased
Cookie Clicker from 10 to 110 cookies, and the loop stopped at the limit.
Tests also cover idle/rejected ticks not consuming a finite limit.


### Portable progress files

The player toolbar provides **Export progress** and **Import progress**. Exports
are versioned `.json` data files, not copies of the g8me. A **Save progress file**
link remains available if automatic downloading is blocked. They include only
the current title's isolated localStorage and IndexedDB databases opened by its
save adapter. Typed arrays, ArrayBuffers, blobs and dates retain their types.
Cookie Clicker requests a native save before export; native filesystem and
Geometry Dash save flushing use the existing adapter. Save in the g8me first.

This version supports GN Math direct launch. P8y and cross-origin/provider-owned
saves are explicitly unsupported; use those titles' own export controls. Database
names must already have been opened by the current g8me, and store schemas must
match, so on a new browser play/save once before importing database-backed saves.
No export can capture unsaved RAM state or server-side accounts. Database records
may include cached data if a provider mixes it into its save database.

Imports check format/version, title/provider identity, storage entries, binary
records, database names and schemas. Files are limited to 50 MB. Confirming the
replace prompt stops the running title before restoring storage, then restarts
it to load the imported save. Transaction failure triggers rollback to the
pre-import snapshot. Keep an exported copy before replacing important progress.
Site profile settings, other g8mes' localStorage, and Geekfox state are excluded.

Verification: 30 unit tests passed; a separate fake-indexeddb integration check
round-tripped a JSON snapshot containing localStorage, binary filesystem records
and timestamps, preserved site settings, and rolled back a unique-index failure.
A real SVG-player import loaded a known 2048 board with score 1234. Cookie Clicker
export prepared a progress JSON download link. The in-app browser's download
testing API does not support blob downloads in embedded frames, so automatic
file delivery there could not be verified.


## URL-based web g8mes and November 12 connection fixes

FivePlay (`https://fiveplay.lol/`) and Half-Life 2
(`https://alexboops.github.io/half-life-2-port/`) appear in the GN library and
home catalog. Both use Geekfox URL-based iframes by default. No third-party
g8me HTML, WASM, archives or artwork is packaged into the repository or SVG.
Their browser runtime will naturally request its resources when played. The
extra entries remain available while the GN catalog loads or is unreachable.
Existing direct GN Math and Lumin behavior is preserved.

All p8y g8me launches navigate a Geekfox frame rather than prefetching HTML.
A healthy g8me connection is reused instead of resetting the connection on
every title. Connection status and worker-registration failures are visible;
a failed top-level page keeps the error overlay instead of a load event hiding
it. GET/HEAD relay fallback, streaming-body support and non-replayed POSTs remain.

The two external ports require cross-origin isolation for shared-memory WASM.
Their first launch registers the companion worker and reloads the dashboard
with an internal `gb-threaded=1` flag, then resumes the selected iframe. The
worker supplies COOP/COEP policies for that dashboard navigation and rewritten
content; iframe permissions allow isolation. Closing the player removes this
mode and reloads the normal dashboard, so ordinary provider embeds keep their
usual environment. A session guard prevents reload loops on unsupported browsers.
Keep/purge **both** index.svg and geekfox-worker.js when deploying this change.

Verification: 33 tests passed. The five new relays each fetched example.org
successfully through the real transport. A GN 2048 p8y iframe loaded directly
from its URL and responded to arrow keys (score increased). Half-Life 2 loaded
its start screen and began fetching runtime modules. FivePlay loaded its page
and archives after isolation was enabled, but its WASM engine then reported
`RuntimeError: unreachable`; full gameplay of either large port is not certified.
School Chromebook policy, blocked relay hosts/WebSockets, browser memory and
GPU/engine requirements can still prevent these externally hosted titles from
running. No school device or network was available for verification.

Backend provenance: Achroma's published app code at
`https://cdn.jsdelivr.net/gh/achroma-ubg/svg@latest/achroma.js` (checked November 12,
2026); the removed demo's restrictions are at `https://wisp.mercurywork.shop/`.
Third-party availability can change and these hosts may share infrastructure.


## G8me ad and popup protection

**Ad blocker: On** is the player default, independent of the Geekfox browsing
setting. Its preference persists; changing it reloads the active title. P8y
requests use the shared bundled Ghostery engine and EasyList/EasyPrivacy snapshot
before the relay fetch. Top-level game documents remain allowed. Direct GN
launches filter listed script/frame/image/style resources before startup and
intercept common fetch/XHR and Node insertion paths. The existing bundled
engine is parsed once and shared rather than downloaded or embedded twice.

Enabled g8me iframes disallow popups, popup escapes and top-page navigation.
Direct GN documents also replace window.open and intercept new-window links
before title scripts run. Scripts, same-origin storage, forms, pointer lock,
fullscreen and downloads remain available. The parent site's export/import
controls are outside these restrictions. Turn blocking off for a title that
requires an external login window.

Direct cross-origin providers such as Lumin get popup restrictions; full network
filtering requires p8y. Direct filtering cannot intercept every possible browser
resource path or nested third-party request. No scriptlet or universal video-ad
blocking claim is made. Filter snapshot provenance/licenses remain in vendor.

Verification: 35 tests passed. A browser fixture removed an analytics script,
reported Popup blocked after a user-initiated window.open attempt, and still
responded to normal scoring controls. GN 2048 loaded its saved board in direct
mode with the blocker on. P8y 2048 loaded with a blocked-request count, and DOM
inspection confirmed that its sandbox popup restrictions remained in place.


### FivePlay archive-mount compatibility

FivePlay now defaults to its published low-memory profile (`low=1`, two cores,
910×570 rendering, 30 fps). This reduces thread/graphics pressure but does not
by itself solve the archive failure.

The confirmed failure was its main engine's synchronous XMLHttpRequest for
`/data/manifest.json`. The bundled Geekfox runtime defaults to disabling sync
XHR, so the engine reported the existing `x64/audio/audio.rpf` archive missing
and trapped in `CFileMgr::MountAudioPacks`. A narrowly matched worker-response
adapter now preloads the manifest with asynchronous fetch before starting the
engine. It populates FivePlay's existing `__httpfsManifest` cache; its IO workers
still stream the archives normally. Neither archives nor g8me code are bundled
locally. No global sync-XHR flag or game-progress modification is involved.

Confirmed crashes now produce a retry message rather than leaving only the
stale mounting screen. Slow transfers and mode-selection prompts are not treated
as crashes. Isolation resume markers are cleared on close and only resume a
title on the threaded dashboard URL, preventing stale markers from reopening
it on the normal dashboard.

Verification: the original low-memory site reached its mode-selection stage;
the unpatched Geekfox frame crashed mounting audio packs. Crash diagnostics
identified the missing manifest. With the adapter, Geekfox passed archive
mounting, loaded Story Mode and rendered the playable 3D scene with ad blocking
enabled. The original mounting failure is fixed in the local browser test. Unit tests check preload order,
manifest validation, URL scoping, idempotence and changed-loader failure.

### GN source updates and Geometry Dash uploaded levels

GN catalogs and wrappers now prefer the official repository and revalidate HTTP
caches; the CDN mirror remains a fallback. Catalog Retry also discards the
in-memory catalog. Entries continue to use their provider and numeric ID, never
a source URL or revision, as their save identity. P8y keeps its previous mirror
order and virtual origins because its browser storage belongs to those origins;
changing the direct source priority must not move existing P8y saves.

Geometry Dash's public wrapper is the same in the official repository and the
mirror. Its first online-level bridge returned HTTP 429; other early bridges
returned 403, which the upstream fallback logic can treat as a final response.
The WASM runtime emits `/__proxy?url=...` relative URLs. The port resolves those
against `location.href`, which is `about:srcdoc` in the embedded player, so its
normal route parser fails and the request reaches the wrong host. The ID 868
adapter now unwraps that actual runtime URL and tries the working published
IXL/SNG level routes first,
preserving POST bytes. If direct access fails it can use Geekfox's existing
transport, then fall back to the port's own networking. Each attempt has a
bounded timeout, and HTML error pages are rejected. Level bodies stream as soon
as the first chunk arrives, so the native inactivity timer sees download progress.
Custom song/SFX hosts keep their published n/c media routes. Both launch modes receive
the adapter; other titles and asset requests are untouched.

This is a network update, not a new WASM payload. It keeps `gn:868`, the
`gbG8meSave:gn:868:` storage prefix, `gdwasm_saves` and its existing version,
and the AppData/Resources path compatibility hook. It does not clear, replace,
rename or migrate any player's database. Existing progress export/import stays
available. As before, storage belongs to the browser and site origin: use the
same site URL/launch mode, and do not clear site data when refreshing.

Use `gd-network-check.html` on the same server for a public level-list and
level-download check without touching any saves. Automated tests exercise route
fallback, POST forwarding, unrelated-title isolation and reopening existing
progress through the updated wrapper. Live service availability remains external.

Verified in the rebuilt SVG: Featured populated with real player-created levels;
Flatline downloaded (1,217,922 bytes), launched, and reached 5%. After closing
the player and reopening Geometry Dash, Saved Levels retained Flatline at 5%
and 20/500 orbs. Custom music was skipped for this gameplay test. 51 automated
tests passed, including relative-runtime URLs, streamed downloads and stable
local/native save identity.

### G8me developer menu

Open Developer in the g8me toolbar and enable Capture logs. Capture defaults off;
changing it reloads the title through the existing save-flush path. The panel
provides console levels, uncaught errors, rejected promises, fetch/XHR status and
timing, launch mode/viewport and p8y relay startup messages. Filter by level or
text, pause the display, clear entries, export a text log, or reload the title.
Only the latest 300 entries remain in this tab, with bounded object formatting
and message rate. Existing console methods still run. Network diagnostics omit
query strings, request bodies and headers; title-authored console messages may
contain their own data, so review exports before sharing.

Direct GN and selected p8y documents receive capture before title scripts.
Accessible frames reconnect to a host callback on load. External cross-origin
frames may prevent capture; workers and nested frames are not instrumented. The
panel reports whether capture connected rather than promising full DevTools.
No save keys, database names or restore logic change.

Verified developer capture with GN 2048 in direct and p8y mode. A browser fixture
produced console log/warn/error messages, a rejected promise and a 404 fetch;
text filtering isolated the requested entry. P8y relay startup and capture
connection appeared in the real SVG player. 58 automated tests passed.

### Half-Life 2 transfer recovery

HL2 still launches its original site through Geekfox; no WASM, archives or map
files are bundled. Its scoped launcher adapter retries split-file transfers,
checks empty/truncated/HTML responses, reports the active part in an overlay,
and removes failed assembly promises so a retry can actually fetch again.
A failed transfer now returns HTTP 502 and the real error rather than a zero-byte
HTTP 200. Transfers have a 90-second per-attempt deadline. The native runtime script is left unchanged. Native crash-overlay messages
are surfaced in the g8me player with Retry. None of these patches change the
original URL, virtual origin or save filesystem.

Automated recovery checks simulate disconnected relays, 404 fallbacks,
truncation, error pages, exhausted retries and recovery on a later attempt.
The adapters are restricted to this HL2 entry and its original asset origin; a
changed upstream loader reports an adapter-update error instead of silently
applying an unverified rewrite.

A browser run also reproduced an `index.wasm` bootstrap `TypeError: Failed to
fetch` in the rewritten fetch layer. The HL2 frame now receives a narrowly scoped
host callback that fetches only its original `index.wasm` through Geekfox's
transport. The launcher retries bootstrap downloads and validates the WASM magic
before compilation. Its ordinary resource requests remain in the original
Geekfox iframe. No origins, databases or save-file formats are changed.

The small original runtime script is prepared before archive transfers start,
then supplied as a response to its original URL through the existing Geekfox
request pipeline. It still receives normal JavaScript rewriting. The response is
kept in memory for that launch only; nothing is downloaded into the repository.

Verification: reproduced the rewritten-fetch bootstrap failure, verified the
repaired engine download and runtime preparation, reached the HL2 menu, and
started Chapter 1 through the normal chapter selection. Its three-part map
loaded, rendered the G-Man introduction, and reached the playable train scene
inside the Geekfox iframe. This is
startup/initial chapter verification, not a complete campaign test. 68 automated
tests passed, including request-pipeline response delivery and recovery cases.

November 14 follow-up: a user screenshot located the next failure in `loadMap`.
The same host transport bridge now handles both ordinary `.data` maps and split
parts, preserving their original URLs. Previously only bootstrap WASM used that
bridge. Map HTTP failures, empty responses and HTML error pages now include a
specific message. Error rendering also includes `Error.message` when a Safari-style
stack contains only the function location. 70 automated tests pass, including
both map paths and the Safari-style stack case. Save storage is unchanged.

### Threaded isolation compatibility

The companion worker now uses COEP `require-corp` with COOP `same-origin`, matching
the original HL2 port's isolation worker. Threaded navigation revalidates the
SVG/HTML response. Worker registration has a policy-version query so the older
credentialless worker is replaced, and reload waits for that specific worker to
control the page. A versioned automatic navigation also avoids cached policies.
Failed attempts from the old version receive one new attempt; a repeated failure
under the new version stops without looping. Neither worker replacement nor
navigation clears site data or changes the g8me save origin.

Tests cover worker policy headers, uncached navigation, stale failure markers,
controller-change ordering and cleanup when worker control is blocked.

Verified in browser: an ordinary dashboard launch installed the versioned worker,
automatically navigated to threaded mode, reported Threaded mode ready, and ran
HL2 to its menu under `require-corp`. 74 automated tests passed. Browser or
embedding restrictions can still deny the capability; the final error remains
bounded and descriptive instead of looping or pretending threads are available.

### HL2 animation rollback and audio recovery (November 14, 2026)

The experimental eye-renderer and facial-client binary patches were removed
following reports of worse rendering and intermittent sound. Native function
counts and changing weights were insufficient evidence of correct visuals.
HL2 now uses the upstream renderer/client unchanged. Eye/lip animation remains
unresolved; do not describe this rollback as an animation fix.

The launcher audio adapter now resumes the existing `Module.SDL2.audioContext`
as well as OpenAL after interaction or a visible-tab/focus return. It handles
`suspended` and `interrupted`, avoids duplicate pending resume calls, and retries
on later interaction if the browser rejects a resume. It does not recreate audio
devices or change mixer buffers, binaries, asset URLs, or save storage.

Verified with the actual upstream engine in a local browser: SDL output had
nonzero samples (peak 0.0984); deliberately suspending its audio context stopped
it; the next interaction restored `running`, its audio clock advanced, and the
processing callback count advanced from 125 to 162. This verifies suspended
context recovery, not every possible cause of missing sound. 79 automated tests
passed, including rejection/retry, hidden-tab behavior, and OpenAL support.
