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

**iOS Safari does not expose PWAs as share targets.** Workaround: a built-in Shortcuts recipe that calls the app's `/share` URL with `autosave=1` so the entry is saved immediately (no need to tap Save in the form).

#### The endpoint the Shortcut calls

```
https://YOUR-DOMAIN.vercel.app/share?autosave=1
  &url=<URL-encoded page URL>
  &title=<URL-encoded page title>
  &text=<URL-encoded highlight>
```

When the Shortcut opens that URL, the PWA:
1. Parses the query params.
2. Auto-creates an entry in `localStorage` with `status = "Saved"`.
3. Flashes a **Saved ✓** toast and shows the library.

Drop `autosave=1` if you want the pre-filled new-entry form instead (for manual review).

Optional params: `notes`, `tags` (comma-separated).

#### Build the Shortcut (step by step)

Open the built-in **Shortcuts** app and tap **+** (new shortcut). Add the following actions in order. For each, tap **Add Action** and search by the action name in bold.

**1. Get current URL**
- Action: **Get Details of Safari Web Page**
- Detail: **Page URL**
- Input: tap the "Safari web page" placeholder and pick **Shortcut Input**.

**2. Get current title**
- Action: **Get Details of Safari Web Page** (a second copy)
- Detail: **Name**
- Input: **Shortcut Input**.

**3. Ask for the highlight (dismissable)**
- Action: **Ask for Input**
- Prompt: `Highlight or quote? (optional)`
- Input Type: **Text**
- Tap the options row → toggle **Allow Multiple Lines** on, leave **Default Answer** blank.
  *(Leaving the prompt empty and pressing Done stores an empty string — the entry is still saved.)*

**4. URL-encode each variable**
Add three copies of the **URL Encode** action, each operating on one of the variables above:
- Encode #1 → the **Page URL** from step 1
- Encode #2 → the **Name** from step 2
- Encode #3 → the **Provided Input** from step 3

In each URL Encode action, tap the input placeholder and pick the matching magic variable. The Shortcuts app will rename them as `URL Encoded Text`, `URL Encoded Text 2`, `URL Encoded Text 3` — you can rename the variables (long-press → Rename Variable) to `EncURL`, `EncTitle`, `EncText` for clarity.

**5. Build the target URL**
- Action: **Text**
- Tap into the content area and type:
  ```
  https://YOUR-DOMAIN.vercel.app/share?autosave=1&url=
  ```
- Immediately after `url=`, insert the `EncURL` variable. Then type `&title=` and insert `EncTitle`. Then type `&text=` and insert `EncText`.

Final content looks like:
```
https://YOUR-DOMAIN.vercel.app/share?autosave=1&url=[EncURL]&title=[EncTitle]&text=[EncText]
```
(Square-bracketed names are the magic-variable chips, not literal text.)

**6. Open the URL**
- Action: **Open URLs**
- Input: the **Text** from step 5.
  *(If you have the PWA installed to your home screen, iOS opens it directly. Otherwise Safari opens it.)*

**7. Confirmation (optional — the PWA already shows its own toast)**
- Action: **Show Notification**
- Title: `Reading Log`
- Body: `Saved`
- Skip this step if you'd rather not double up on confirmations.

#### Shortcut settings

Tap the ⓘ icon at the top of the shortcut editor:

- **Name**: `Save to Reading Log`
- **Icon / color**: your choice.
- **Show in Share Sheet**: **ON**.
- **Share Sheet Types**: untick everything except **Safari web pages** (and optionally **URLs** for sharing from non-Safari apps).
- **Show in Share Sheet → Receive** (newer iOS puts it here): **Safari web pages**, **URLs**.

Tap **Done**.

#### Use it

In Safari (or Substack, X, any WebKit-based browser on iOS):

1. Tap **Share** → scroll to the actions row → tap **Save to Reading Log**.
2. The highlight prompt appears. Paste or type a quote, or just tap **Done** to skip.
3. The PWA opens, flashes **Saved ✓**, and the entry is in your library.

Tip: in the share sheet, long-press the **Save to Reading Log** row and pin it to the top.

#### Why no .shortcut file in the repo?

Apple's `.shortcut` binary format requires an iCloud signature for clean import — unsigned plists trigger an "Untrusted Shortcut" warning that has to be enabled in **Settings → Shortcuts**, and the action identifiers shift between iOS versions. A 10-step build with variable drag-drop is more reliable than shipping an unsigned plist that may not import.

Once you've built the shortcut yourself, you can share it via iCloud (**⋯ → Share → Copy iCloud Link**) — that link is the canonical, Apple-signed distribution format.

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
