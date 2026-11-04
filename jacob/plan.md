# Project Plan: Jacob — Local-First Personal Library Manager (v3)

> Progress log: see [lab-notes.md](lab-notes.md). Update it at the end of every work session, since work switches between machines.

## 0. Decisions (2026-11-04)

| # | Topic | Decision |
|---|---|---|
| 1 | Scope | Two rounds. **Round 1:** library, barcode, "Do I own this?", backup/import/export, share links. **Round 2:** shelf photo, lending, friends' shelves, stats, print. |
| 2 | Shelf-photo risk | Build a standalone OCR prototype **first** and test it on the user's real shelf photos in `jacob/test-photos/`. |
| 3 | Hosting | In this repo as `jacob/`, deployed via GitHub Pages next to `goban/` and `kanshu/`. |
| 4 | License | MIT (`jacob/LICENSE`). |
| 5 | UI languages | English + German. |
| 6 | Google Books | **Off by default.** Open Library only, with an opt-in toggle in settings. |
| 7 | Borrower names | Free text typed by the user. **Never** access the Contacts app or any address book. Names are never included in shares. |
| 8 | Device sync | Kept simple: a shared sync file in iCloud/Dropbox (see 5.H). Automatic on desktop Chrome/Edge, two taps elsewhere. |
| 9 | Merge conflicts | Merge **field by field** (per-field timestamps), so edits to different fields on two devices are both kept. |
| 10 | P2P live lookup | Postponed (maybe never). |
| 11 | Public shelf directory | Postponed (maybe never). |
| 12 | Name | `jacob`. Home-screen name "Jacob", tagline "your pocket librarian". Files use `.jacob.json`. |

## 1. Vision & Core Philosophy

A free, simple and useful library manager for everyone. It runs in any browser on any phone or computer: nothing to install, no account, no server.

- **Local-first: my data is my data.** All books, covers, notes and loans live on the user's device. Nothing is uploaded anywhere. The only outgoing requests are book lookups (an ISBN or spine words sent to Open Library, and to Google Books only if the user turns it on) and cover downloads. The app says so plainly on an "About & Privacy" screen.
- **No server, ever.** Static files only, hosted on GitHub Pages (or anywhere, or opened locally). Sync and sharing go through files and links the user controls.
- **Zero install, optionally installable.** Works as a normal web page. It can also be added to the home screen (PWA) for an app-like feel and better storage protection, but that's never required.
- **Works offline.** After the first visit, everything except online lookups works without a network.
- **Fast to fill.** Adding a whole shelf should take minutes: photograph the shelf, then scan barcodes for the books the photo missed.

## 2. Files & Architecture (no build step)

Several plain static files are fine; there's still no bundler and no `npm install`. Serve the folder with any static file server, or deploy it as-is.

```
jacob/
  index.html              app shell + Alpine templates
  style.css               hand-written CSS, light/dark via custom properties
  js/                     ES modules (loaded with <script type="module">)
    app.js                Alpine store, routing, views
    db.js                 IndexedDB wrapper
    lookup.js             Open Library / Google Books, ISBN utils
    scan.js               barcode scanning
    shelf.js              shelf-photo segmentation + OCR
    importexport.js       CSV/JSON/ZIP, Goodreads/StoryGraph/LibraryThing, merge
    share.js              share links, QR, #db= subscriptions
    i18n.js + i18n/{en,de}.json
  sw.js                   service worker (offline cache)
  manifest.webmanifest    PWA manifest + icons/
  vendor/                 vendored copies of all third-party libraries
```

- **Vendored dependencies, no CDN at runtime.** All libraries are copied into `vendor/` (pinned versions, with license files), so the app works offline and doesn't ping third-party CDNs (privacy). Large assets (Tesseract core + language data) are loaded lazily the first time the shelf-photo feature is used, then cached by the service worker.
- **Service worker (`sw.js`):** precaches the app shell. Uses runtime caching for vendor assets and Tesseract data, and stale-while-revalidate for cover images. Versioned cache names, plus an "Update available, reload" banner when a new version is deployed.
- **Deployment:** add `jacob/` to the "Assemble site" step of `.github/workflows/deploy-pages.yml` and link it from the root landing page.

## 3. Tech Stack

- **Core:** HTML5, vanilla JS (ES modules), hand-written CSS with custom properties. No Tailwind, because the Play CDN isn't meant for production and is heavy on phones.
- **UI state:** Alpine.js (vendored).
- **Barcode scanning:** the native `BarcodeDetector` API where available (Chrome/Android), falling back to `zxing-wasm` (vendored) elsewhere, notably iOS Safari.
- **Shelf-photo OCR:** `Tesseract.js` in Web Workers (vendored, lazy-loaded), with `eng` + `deu` language data. Image pre-processing uses plain `<canvas>`.
- **CSV:** PapaParse (vendored).
- **ZIP (backup with covers):** `fflate` (vendored, small).
- **Compression for share links:** native `CompressionStream('deflate-raw')` + base64url, with no library.
- **QR codes:** `qrcode` generator (vendored) for showing share links.
- **Storage:** `IndexedDB` for libraries, books, cover blobs, the lookup cache and the offline queue. `localStorage` holds small settings only (theme, language, active library, last backup date).

## 4. Data Model

```
Library  { id (uuid), name, kind: "owned" | "wishlist" | "subscribed",
           source?: { url, lastFetched },  createdAt, updatedAt }
Book     { id (uuid), libraryId,
           isbn13?, isbn10?, title, subtitle?, authors[], publisher?, year?,
           language?, format? (hardcover/paperback/ebook/audio), pages?,
           cover?: { blobKey?, url?, ownPhoto? },
           status: "unread" | "reading" | "read" | "abandoned",
           rating? (0–5, halves allowed), dateRead?, notes?, tags[],
           location?: { shelf, row, position },
           loans: [ { borrower, lentAt, dueAt?, returnedAt? } ],
           source: "barcode" | "shelf-photo" | "manual" | "import" | "shared",
           addedAt, updatedAt, fieldUpdatedAt: { <field>: timestamp },
           deleted? (tombstone for sync) }
```
- A stable `id`, plus a timestamp **per field** (`fieldUpdatedAt`), makes field-level merging possible (see 5.H). `updatedAt` is the latest of them.
- `borrower` is free text the user types. The app never reads contacts or an address book.
- ISBN utilities: validate checksums, convert ISBN-10 ↔ ISBN-13, normalise hyphens/spaces, and accept 978/979 EAN-13 codes (ignore 5-digit price add-ons).
- Books **without an ISBN** (most books before ~1970) are first-class citizens: the full manual form, an optional photo of the cover taken as the cover image, and matching by title + author.

## 5. Feature Requirements

### A. Libraries

- Switcher in the header: `[ Main Shelf v ]` with Create / Rename / Delete / Duplicate.
- Library kinds:
  - **owned** (default, "Main Shelf" on first start)
  - **wishlist**
  - **subscribed**, a read-only copy of someone else's shared library (see 5.I)
- "Move/copy to library…", e.g. wishlist → owned when you buy a book (a "Got it!" button on wishlist items).

### B. Browse, Search & Book Details

- Grid of covers (desktop) and a compact list (phone), with a toggle.
- Search across title, author, ISBN, publisher, tags and notes. Make it typo-tolerant and ignore accents/umlauts.
- Filters: status, tag, language, format, location, lent out, no ISBN, and "added in last N days".
- Sort: title, author (by surname), date added, year, rating, location (shelf order).
- Detail view: every field editable, "re-fetch metadata", "change cover" (choose from lookup results or take a photo), loan history, delete (with undo).
- Bulk edit: select several books, then set tag / status / location / library, or delete.
- Duplicate detection: warn when the same ISBN, or the same title + author, is added twice.

### C. Adding Books: Barcode

- **Single scan:** camera view, scan an ISBN, look it up, show a preview card, then "Add".
- **Fast scan mode:** continuous scanning without leaving the camera. Each hit gives a beep/vibration and a toast ("Added: *Title*"), with an Undo for the last scan and a running counter. Lookups happen in the background. If a lookup fails, the book is added as "ISBN only, fix later".
- **Manual entry:** a form with ISBN lookup and a no-ISBN path.
- **Metadata lookup order:**
  1. Open Library `https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data`
  2. Google Books `https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}` (no key needed at low volume). **Off by default.** It's only used if the user enables "Also search Google Books" in settings.
  3. Otherwise, manual entry.
- Cache every lookup result in IndexedDB. Throttle requests.

### D. "Do I Own This?" (Bookshop Mode)

- A prominent button that opens the scanner in check mode. A scan searches **all owned libraries** (matching by ISBN-13/10, then fuzzily by title + author) and shows a big ✅ "You own this (Main Shelf, shelf 3)" or ❌ "Not in your library", plus "on your wishlist" if it is.
- Works fully offline, since it only searches local data.
- From the ❌ screen, one tap adds the book to the wishlist or to owned books.

### E. Adding Books: Photograph the Shelf (Primary Bulk Input)

The easiest way to add many books is to photograph a bookshelf and let the app work out the books from their spines, so a whole row is added at once.
1. **Capture:** "Photograph Shelf" opens the camera (`<input type="file" accept="image/*" capture="environment">`) or accepts existing photos. Several photos are allowed per session (one per row, or one photo showing several rows). Downscale on the device (longest side ~2000 px). Photos stay on the device.
2. **Split into spines** (plain canvas code, no OpenCV):
   - *Rows:* if a photo shows several rows, find the shelf boards with a horizontal edge/brightness profile and suggest split lines. The user can drag them to adjust (recommended path: one photo per row).
   - *Spines:* within a row, compute a column-wise vertical-edge profile (Sobel-x summed per column). Its peaks are the gaps between books, and the row is cut into one strip per spine. The user can add, move or delete split lines on an overlay before OCR runs.
3. **Read each spine (rotate both ways):** rotate each strip 90° clockwise **and** 90° counter-clockwise, because English spines usually read top-to-bottom and German ones bottom-to-top. Also try 0° for wide spines with horizontal text. Pre-process before OCR:
   - upscale narrow strips
   - convert to grayscale and stretch the contrast
   - also try an inverted version for light-on-dark spines

   Keep the orientation with the higher mean word confidence and more dictionary-like words, and drop low-confidence words. Spines without usable text still appear in the list as ❌ unreadable.
   - Run a `Tesseract.createScheduler()` pool of 2–4 workers with a progress bar. Expect roughly 1–2 s per spine on a phone.
4. **Resolve ISBNs:** OCR returns a bag of words without knowing which are title, author or publisher, so use free-text search and let the catalogue sort it out:
   - Open Library: `https://openlibrary.org/search.json?q=<spine words>&fields=title,author_name,publisher,isbn,cover_i,first_publish_year&limit=10`
   - Google Books fallback (only if enabled in settings): `https://www.googleapis.com/books/v1/volumes?q=<spine words>`
   - Rank candidates by fuzzy token overlap (edit-distance tolerant of OCR typos) between the OCR text and the candidate's title + author + publisher. Publisher names on the spine help pick the edition.
   - Mark each book as **matched** (one clear winner), **ambiguous** (several plausible editions, so the user picks one) or **not found**.
5. **Review list:** one long list in shelf order with a status per book:
   - ✅ matched: cover thumbnail + ISBN
   - ⚠️ ambiguous: pick an edition
   - ❌ not found / unreadable

   Every row is editable inline (fix title/author, then re-search) and can be deselected. Already-owned books are flagged.
6. **Fill the gaps by barcode:** each ❌/⚠️ row has a "Scan barcode" button that attaches the scanned ISBN to *that* row. "Scan all missing" steps through the unresolved rows in shelf order.
7. **Commit:** "Add N books" saves the selected rows into the active library and skips duplicates. Unresolved rows can be added as manual no-ISBN entries or dropped. The shelf/row/position from the photo is stored as `location`.
- **Offline:** OCR works offline once Tesseract is cached. Lookups for spines read while offline are queued in IndexedDB and run once the connection is back.
- **Expectations:** plain OCR won't read every spine (decorative fonts, glare, very thin books). That's by design: whatever OCR resolves saves typing, and the barcode pass picks up the rest.
- **Later upgrade (still keyless, optional):** an in-browser vision model via Transformers.js/WebGPU (e.g. Florence-2) reads stylised spines better. It's a several-hundred-MB one-time download, so it should be an opt-in setting.

### F. Lending Tracker

- On any book: "Lend to…" (the borrower is whatever name the user types, with autocomplete only from names previously typed in Jacob; the device's contacts are never accessed), an optional due date, then "Returned".
- "Lent out" view: who has what and for how long. Overdue loans are highlighted, and the start screen shows a badge.
- Per-borrower view: everything a person currently has, and their loan history.
- Optional "Remind" button that opens a prefilled message via the Web Share API / `mailto:`. No push notifications and no server.

### G. Reading Tracking & Stats

- Status, rating, date read and notes per book (see data model). "Currently reading" strip on the start screen.
- Stats page:
  - total books, read / unread
  - books read per year
  - top authors, tags, languages and publishers
  - pages read
  - books added per month
  - total books lent out

  Simple bar charts drawn in plain SVG.

### H. Backup, Sync & Data Safety

- **Protect against silent data loss:**
  - Call `navigator.storage.persist()` on first use, and show the storage status in settings (`navigator.storage.estimate()`).
  - Safari deletes site data after 7 days without a visit unless the site is installed. Explain this, and show "Add to Home Screen" instructions on iOS (and the install prompt on Android/desktop).
  - **Backup reminder:** "Last backup: 23 days ago — back up now?", shown after N changes or N days (configurable).
- **Export:**
  - **JSON** (complete: all libraries, loans, notes, tombstones), the canonical backup format: `jacob-backup-YYYY-MM-DD.json`.
  - **ZIP** = JSON + cover images (fflate) for a full offline backup.
  - **CSV**: a simple per-library spreadsheet, plus a Goodreads-compatible CSV option.
  - Save with `showSaveFilePicker()` where supported, otherwise a normal download. Users can save into iCloud Drive / Dropbox / Google Drive folders via the OS file picker, with no SDKs.
- **Import with merge, not overwrite:**
  - Records are matched by `id`, then by ISBN, then by title + author. Merging is **field by field**: for each field, the value with the newer `fieldUpdatedAt` wins, so changing the rating on the phone and the notes on the laptop keeps both. Loans are merged as a set (by `lentAt` + borrower). Tombstones propagate deletions.
  - A summary is shown before applying: "12 new, 3 updated, 1 deleted, 2 conflicts". Conflicts show both versions so the user can pick one.
  - Options: "Merge into current library" / "Import as new library" / "Replace (advanced)".
- **Shared sync file (`my-library.jacob.json` in iCloud Drive / Dropbox / Google Drive):** phone and laptop point at the **same file**. The cloud app moves the file between devices; Jacob only reads and merges it.
  - **Desktop Chrome/Edge:** "Link sync file" stores a File System Access handle in IndexedDB. The app merges the file on start and on focus, and writes it back (debounced) after changes. Permission is re-confirmed once per session.
  - **Phone (iOS Safari, Android Chrome) and desktop Safari/Firefox:** browsers there can't keep a link to a file, so it's two taps:
    - **"Sync ↓"** opens the file picker; pick the file, and it gets merged in.
    - **"Sync ↑"** saves the merged state back through the share sheet / Files ("Save to Files → iCloud Drive/Dropbox → replace").
    - The app remembers the file name and the last sync time, and nudges the user ("Not synced for 5 days").
  - **Copies created by cloud apps:** iOS may save `my-library (1).jacob.json`, and Dropbox may create "conflicted copy" files. Merging is safe with any number of copies, so "Sync ↓" accepts **several files at once** and merges them all. The user can delete the extras afterwards.
- **Import from other services:**
  - **Goodreads CSV:** unwrap `="..."` ISBN cells, and map `Exclusive Shelf` → status, `Bookshelves` → tags, `My Rating`, `Date Read` and `My Review` → notes.
  - **StoryGraph CSV:** `Read Status`, `Star Rating`, `Tags`, `Review`.
  - **LibraryThing:** CSV/TSV/JSON export.
  - **Generic CSV:** a column-mapping dialog with a preview.
  - After import, fetch missing covers and metadata in the background.

### I. Sharing a Library (Still No Server)

Shared data is always a **copy** the recipient controls. Nothing is published unless the user explicitly creates the link or file.
1. **Share link:** the selected library, or a filtered view such as "my wishlist" or "sci-fi", is encoded into the URL **fragment**: `#share=<deflate-raw + base64url JSON>`.
   - The fragment is never sent to any server, not even GitHub Pages. Only the minimal fields (ISBN, title, authors, year, optionally status/rating/tags) go in, without notes or loans unless explicitly ticked. The recipient's app fetches covers by ISBN itself.
   - Show the resulting link size. If it's too long for messengers (more than ~8 KB, roughly a few hundred books), suggest sharing a file instead.
   - Shown as a QR code too (when it fits), so a friend can scan it from your screen.
2. **Share file:** export a `.jacob.json` for the selection and hand it over with the Web Share API (`navigator.share({ files })`, i.e. directly to messenger/email/AirDrop) or as a download.
3. **Subscribe by URL (`#db=<url>`):** load a library JSON/CSV from a public URL.
   - Works with CORS-friendly hosts: a GitHub Gist "raw" URL, GitHub Pages, any static host. Many cloud-drive links won't work because of CORS; the app explains this when a fetch fails.
   - Stored as a **subscribed** library (read-only) with a "Refresh" button. Useful for a family library, a club, or a classroom shelf.
- **What the recipient can do:** browse read-only, "Import as new library", "Merge into my library", and see an overlap marker ("you own 14 of these"). A shared wishlist doubles as a gift list.

### I2. Searching Other People's Bookshelves

The goal: "Who do I know that has this book?", and later "Who out there has it?", without a server. The trick is that searching happens **locally** on the user's device, over copies of other people's shelves they've been given. There are three stages, from simplest to most ambitious:

1. **Friends' shelves (v1, fully serverless).** Every share link, share file or `#db=` subscription from 5.I lands in a **Friends** section, one entry per person (name + their shared libraries). Then:
   - The normal search box has a scope toggle: *My books · Friends · Everything*. Results show whose shelf a book is on ("Anna (Sci-Fi), Tom").
   - "Do I own this?" (5.D) gains a third answer: "❌ You don't, but **Anna has it**", with a one-tap "Ask to borrow" message via the Web Share API.
   - The book detail view shows "Also on: Anna's shelf, Tom's wishlist". The wishlist part is handy for gift ideas.
   - Friends who publish via `#db=<url>` stay current with "Refresh all". Friends who sent a link or file simply send a new one.
   - Each person decides what they share (whole library, one library, or a filtered view) and whether notes, ratings or loans are included. Nothing is shared by default.
2. **Live peer-to-peer lookup (postponed, maybe never).** Ask a friend's device directly over WebRTC (like `goban/`, via PeerJS), e.g. for a book club or family that wants always-current shelves without re-sharing. Two caveats:
   - Both devices must be online with the app open.
   - PeerJS's public broker is a third-party server, but only for connection setup; the book data flows directly between the peers. This is the one exception to "no server", so it must be opt-in.
3. **Public discovery (postponed, maybe never).** Searching strangers' shelves needs some shared place to find them. Serverless-ish options to evaluate:
   - **Static registry on GitHub:** a public repo listing opt-in library URLs (added by pull request or a gist naming convention). The app fetches the registry plus the listed libraries and searches them locally. There's no server of our own, the data stays with its owner, and removing an entry unpublishes it. This scales to a few thousand shelves, which is fine for a community.
   - **Nostr relays or IPFS:** decentralised publishing with no central operator. More complex, and there's less control over deletion.
   - Privacy rules for any public option: explicit opt-in per library, a coarse location at most (city, optional, for "books near me"), never notes or loans, and a one-click unpublish.

### J. Print & Reports

- Print-friendly CSS for any list or filtered view, so the browser's "Print / Save as PDF" works. Useful for insurance, moving house, or a list of books lent out.
- Options: with or without covers, grouped by location/author/tag.

### K. Interface Basics

- **Languages:** English and German at launch. The default follows `navigator.language` and can be changed in settings. All strings live in `i18n/*.json`, so community translations are easy to add.
- **Theme:** light/dark following the system by default, with a sun/moon override saved in `localStorage`.
- **Accessibility:**
  - semantic HTML and labelled controls
  - full keyboard navigation and visible focus
  - WCAG AA contrast in both themes
  - touch targets ≥ 44 px
  - respects `prefers-reduced-motion`
  - screen-reader announcements for scan results
- **Responsive:** phone first (bottom action bar: Scan · Shelf photo · Do I own this? · Library), and a wider grid layout on desktop.
- **First start:** a short three-step intro ("Photograph your shelf", "Scan the rest", "Your data stays on this device; back it up").
- **About & Privacy:** what is stored where, which requests leave the device (lookups, covers), the Google Books opt-in toggle (off by default), a note that contacts are never accessed, a link to the source code, and the license (MIT).

## 6. Execution Steps for the Coder

Order follows the decisions in §0: first the prototype, then Round 1, then Round 2. Log progress in [lab-notes.md](lab-notes.md).

### Step 0: Shelf-photo prototype (de-risk first)

- A standalone `jacob/prototype/shelf-ocr.html` (no app code, just the 5.E pipeline: segmentation overlay → rotate both ways → Tesseract → Open Library free-text search → results table).
- Run it on the user's photos in `jacob/test-photos/` (English + German spines, a few hard cases). For each photo, record spines detected / read / matched in `lab-notes.md`.
- Outcome decides how much effort goes into the shelf feature. If OCR does poorly, fall back to a mostly barcode-based Round 2 and keep the vision-model upgrade in mind.

### Round 1

1. **Skeleton:** file layout, vendored libraries, `manifest.webmanifest`, `sw.js` with precache + update banner, CSS themes, i18n loader (en/de), Alpine app shell with phone/desktop layouts, and the deploy-workflow entry.
2. **Data layer:** IndexedDB wrapper (libraries, books, cover blobs, lookup cache, offline queue), the data model with uuid, per-field timestamps and tombstones, ISBN utilities, and `storage.persist()`.
3. **Libraries & browsing:** library switcher and kinds, grid/list, search/filter/sort, detail/edit view, bulk edit, duplicate detection, manual entry (including no ISBN and own cover photo).
4. **Lookup & covers:** Open Library, plus Google Books only when opted in, caching, throttling, cover blob caching.
5. **Barcode:** `BarcodeDetector` + `zxing-wasm` fallback, single scan, fast scan mode, "Do I own this?" mode.
6. **Backup & import/export:** JSON/ZIP/CSV export, field-level merge import with summary/conflicts, Goodreads/StoryGraph/LibraryThing/generic CSV import, backup reminder, shared sync file (linked on desktop Chromium, Sync ↓/↑ elsewhere, multi-file merge).
7. **Sharing links & files:** `#share=` links (compression, size check, QR), share files via the Web Share API, and `#db=` subscribed libraries with refresh, plus the recipient's view/import/merge/overlap.
8. **About & Privacy, onboarding, `LICENSE` (MIT), accessibility pass for Round 1.**

### Round 2

9. **Shelf photo:** capture, row/spine segmentation with an editable overlay, two-way-rotated Tesseract OCR, free-text ISBN resolution with fuzzy ranking, review list with per-row barcode scanning, commit with location.
10. **Lending tracker:** lend/return, lent-out view, per-borrower view, reminder via share.
11. **Friends' shelves:** the Friends section, search scopes, "a friend has it" in bookshop mode, and "Ask to borrow" (5.I2, stage 1).
12. **Stats, print view, final accessibility pass.**

### Postponed (maybe never)

- P2P live lookup and the public shelf directory (5.I2, stages 2–3).

### Throughout

- **Testing:** a small set of real shelf photos (English + German spines) as a regression set for segmentation/OCR, sample Goodreads/StoryGraph exports for import, and manual checks on iOS Safari, Android Chrome and desktop Firefox/Chrome (including offline and installed-PWA mode).
