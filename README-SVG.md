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

## Geekfox connections

Geekfox now uses ten free WISP connections: DayDream X and Mercury, followed by
eight connections from the Achroma service pool:
Krem, Planta, Foto, Shor, Tenspot, RYM, BSFA, and Jure. The old ping-only relay
selection has been removed. Each candidate must fetch an HTTPS connectivity
check through its actual transport before it is selected. All eight also fetched
Wikipedia successfully during the October 24, 2026 local verification.

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
a separate Geekfox media connection with the ten-connection fallback pool above;
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
media transport has the same ten-connection fallback pool and is kept separate
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

Filtering is limited to Geekfox pages and subrequests; it does not cover YourGeek,
media, g8me players, other browser tabs, or the whole device. It does not execute
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
