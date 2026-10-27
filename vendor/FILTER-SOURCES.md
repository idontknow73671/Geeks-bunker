Geekfox blocker uses @ghostery/adblocker 2.20.1 (MPL-2.0), bundled for browser use.

EasyList and EasyPrivacy source snapshot: c18718adc33e82a086d996d0b0f75deb3d01745a

https://raw.githubusercontent.com/ghostery/adblocker/c18718adc33e82a086d996d0b0f75deb3d01745a/packages/adblocker/assets/easylist/easylist.txt
https://raw.githubusercontent.com/ghostery/adblocker/c18718adc33e82a086d996d0b0f75deb3d01745a/packages/adblocker/assets/easylist/easyprivacy.txt

Filter licenses and authors are preserved in geekfox-filters.txt.
The source text and compressed copy are both supplied.

Ghostery source: https://github.com/ghostery/adblocker/tree/v2.20.1
Package: https://www.npmjs.com/package/@ghostery/adblocker/v/2.20.1

The generated ES module is self-contained. The compressed `.js.gz` copy is
embedded by build-svg.py and inflated only when the blocker is enabled. Filter
lists are similarly bundled; no filter-list server is contacted during browsing.
The pinned snapshot's list headers contain their own publication dates.

To regenerate the browser bundle in a separate temporary npm directory:

1. Install `@ghostery/adblocker@2.20.1`, `rollup@2.79.2` and
   `@rollup/plugin-node-resolve@15.3.0` in that directory.
2. Create an entry module exporting `FiltersEngine` and `Request` from
   `@ghostery/adblocker`.
3. Bundle it with Rollup, `nodeResolve({browser:true})`, `format: "es"`, to
   `vendor/geekfox-blocker.js`.
4. Gzip the module and concatenated plaintext filter sources with mtime 0 to
   create `geekfox-blocker.js.gz` and `geekfox-filters.txt.gz`.
5. Preserve notices and run `python3 build-svg.py` and the feature tests.

Full engine source is available from the exact npm package version linked above;
its upstream repository tag may use a package-prefixed release name. Notices for
bundled dependencies and their versions are in BLOCKER-NOTICES.txt.
