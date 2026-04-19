# Reading Log

A tiny, zero-dependency PWA for logging things you read — links, highlights, and notes. Designed to be installed to your iPhone home screen and populated via the share sheet.

## Stack

- Vanilla HTML / CSS / JS. No build step, no dependencies.
- `localStorage` for persistence.
- PWA manifest + service worker for home-screen install and offline use.
- Deploys as a static site on Vercel.

## Repo layout

```
index.html              App shell + all UI
styles.css              Mobile-first styling (dark/light auto)
app.js                  Logic, CRUD, filtering, share-intent handling
manifest.webmanifest    PWA manifest with share_target registration
sw.js                   Service worker (offline shell, share route)
vercel.json             Rewrites /share -> index.html, SW headers
icon.svg                Source icon
icon-192.png            192x192 PWA / Android icon
icon-512.png            512x512 PWA icon
icon-maskable-512.png   Maskable icon (Android adaptive)
```

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, **Add New Project → Import** that repo.
3. Framework preset: **Other**. Build command: *(leave empty)*. Output directory: *(leave empty / root)*.
4. Deploy.

No environment variables, no build step. Every push to the main branch redeploys automatically.

## Add to iPhone home screen

1. Open the deployed URL in Safari on your iPhone.
2. Tap **Share → Add to Home Screen**.
3. Launch the app from the home screen. It runs standalone (no Safari chrome) and works offline.

## Sharing into the app

### Android / Chrome (supported natively)

Once installed, the app appears as a target in the system share sheet automatically — shared URL, page title, and selected text land pre-populated in the new-entry form.

### iPhone / Safari (via Shortcuts)

**iOS Safari does not yet expose PWAs as share targets.** Workaround with the built-in Shortcuts app:

1. Open **Shortcuts → + → New Shortcut**.
2. Tap **Add Action → URL**. Paste:
   ```
   https://YOUR-DOMAIN.vercel.app/share?url=[URL]&title=[TITLE]&text=[TEXT]
   ```
3. Replace each bracketed placeholder with a **magic variable** from **Shortcut Input** (URL-encoded). Specifically:
   - `[URL]` → Shortcut Input (as URL, URL-encoded)
   - `[TITLE]` → Shortcut Input (as Name, URL-encoded)
   - `[TEXT]` → Shortcut Input (as Text, URL-encoded)
4. Add an **Open URLs** action beneath the URL action.
5. Rename the shortcut to **Save to Reading Log**.
6. Tap the shortcut settings (ⓘ) → enable **Show in Share Sheet** → accept **URLs, Text, Safari web pages**.
7. Now in Safari/Substack/X: tap **Share → Save to Reading Log**. The PWA opens with the new-entry form pre-filled.

Tip: pin the shortcut high up in the share sheet so it's one tap away.

## Data

Everything lives in `localStorage` under the key `reading-log:v1`. The app never talks to a server.

- **Export JSON** (menu ⋯) downloads a backup.
- **Import JSON** merges a previously exported file. Duplicate IDs get reassigned.
- Clearing Safari data or deleting the PWA wipes your entries — back up periodically.

## Features

- Capture title, URL, platform (auto-detected from host), highlight/quote, free-text notes, tags, and status (`Saved` / `Reading` / `Done`).
- Library view: newest-first, search across title/highlight/notes, filter by status / platform / tag.
- Tap an entry for full detail with link-out. Edit or delete inline.
- Works offline after first load.

## Notes on the share target implementation

- The manifest declares a GET `share_target` at `/share` with params `title`, `text`, `url`. This is the [Web Share Target API](https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target), supported by Chrome/Android-installed PWAs today.
- `vercel.json` rewrites `/share` to `/index.html` so the static host serves the shell; the client-side handler in `app.js` reads the query params and opens the new-entry form pre-populated.
- The service worker also intercepts `/share` so the flow works offline.
- `index.html` is the only HTML file — no separate `share.html`, to keep the shell unified.

## Customizing

- Colors live in `:root` CSS variables at the top of `styles.css`.
- Platform detection rules are in `detectPlatform()` in `app.js` — add more hostnames there.
- Want different storage? Replace `load()` / `save()` in `app.js`.
