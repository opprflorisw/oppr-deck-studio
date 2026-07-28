# artifact storage and serving

`wayfinder:grilling` · child of `../MAP.md` · unassigned

**Blocked by:** `001`

## Question

Where do built artifacts live, and how are they served to a browser?

PDFs, generated images (`brand/img/gen/`, roughly 300-600 KB each), product
screenshots, and the assembled `index.html` the app renders in live iframes. Today
all are files under the repo, served read-only through `/repo/...`.

Decide: GCS bucket, database blobs, or repo-in-container; how the app previews an
assembled deck without shipping the whole repo to the browser; and whether artifact
URLs are signed. Note the app currently renders **live iframes** of `index.html`
per page to build filmstrips, which assumes cheap local file access.
