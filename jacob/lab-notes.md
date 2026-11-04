# Jacob — Lab Notes

A running log of what was done, decided and learned, so work can continue on any machine.
**Read this first, then [plan.md](plan.md).** Add a dated entry at the end of every session: what was done, what's next, and any open issues.

---

## 2026-11-04: Planning session (no code yet)

**Done**
- Wrote and iterated [plan.md](plan.md) up to v3 together with Stefan:
  - Local-first, no server, multiple static files allowed (no build step).
  - Shelf-photo input with keyless in-browser OCR (Tesseract.js, rotating each spine both ways).
  - Barcode scanning, "Do I own this?" bookshop mode, lending tracker, reading stats.
  - Goodreads/StoryGraph/LibraryThing import, field-level merge, a shared sync file via iCloud/Dropbox.
  - Sharing via `#share=` links / files / `#db=` URLs, and searching friends' shelves.
- Recorded all decisions in plan.md §0. Key points:
  - MIT license; EN + DE interface.
  - Google Books **off** by default.
  - Borrower names are free text, and the app never accesses contacts.
  - P2P lookup and the public shelf directory are postponed.

**Next**
1. ~~Test photos~~: done. 10 iPhone photos of real shelves are in `jacob/test-photos/` (IMG_2283–2292, ~3 MB each). GPS metadata was stripped before pushing, because the repo is public. **Strip GPS from any future photos too** (`exiftool -overwrite_original -gps:all= …`).
2. **Step 0:** build `jacob/prototype/shelf-ocr.html` and measure spines detected / read / matched per photo. Log the results here.
3. Then Round 1, steps 1–8 in plan.md §6.

**Open issues / notes**
- Nothing in `jacob/` is deployed yet. Remember to add `jacob/` to `.github/workflows/deploy-pages.yml` ("Assemble site") and to the root `index.html` landing page in Round 1, step 1.
- No browser can keep a link to a sync file on phones (iOS Safari, Android Chrome), so sync there is manual: "Sync ↓/↑" through the file picker. Only desktop Chrome/Edge can link the file automatically.
