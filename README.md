# GM Toolkit

A desktop app that helps you run Dungeons & Dragons 5e sessions. Its main trick: it **listens to your table while you play** and automatically pulls up the right spell, monster, item or rule card the moment someone says its name — so you're not pausing the game to flip through a book or tab through a PDF.

Everything about it is private and local. There's no account to create, nothing runs on a server, and no audio from your table is ever sent anywhere.

---

## What it does

- **A living rulebook** — the full D&D 5e SRD (spells, monsters, items, conditions, classes and more) is built in and works offline. You can also add your own homebrew content — custom spells, monsters, NPCs, items, house rules — right alongside it. Content is organized per campaign, so your homebrew for one game doesn't clutter another.

- **Listens and surfaces cards for you** — while you're running a session, the app transcribes the conversation at your table in real time and watches for anything that matches your library. Say "the goblin casts *shield*" and both cards pop up automatically, no searching required. You can also search manually, correct anything it mishears, and pin cards you know you'll need.

- **A session dashboard** — a workspace for each session with a pinboard for the cards you're using, an initiative tracker, and a notes area. Starting a new session lets you carry things over from the last one.

- **Initiative & combat tracking** — roll initiative, step through turns with the spacebar, and track HP, temporary HP and conditions for everyone in the fight. Add monsters in bulk, and pull your players in automatically.

- **Full character sheets** — stats, saving throws, skills, senses, spell slots, inventory, features, background and notes for every player character. Import a character from a file, or paste a public **D&D Beyond** link and it fills itself in.

- **Multiple campaigns** — keep separate games completely separate: their own content, board, combat state, party and session history.

- **Bring your own notes** — import Word documents, PDFs, text files or Markdown as draft library entries. There's an optional "smart parse" mode (using your own Anthropic API key) that can make sense of messier documents for you.

---

## Installing the app

If you just want to run the app — no coding required — go to the [Releases page](https://github.com/mwhjfung/GMToolKit/releases/latest) and download the file for your computer:

| Platform | File to download |
|---|---|
| Windows | `gm-toolkit-X.Y.Z-setup.exe` |
| Mac (Apple Silicon) | `gm-toolkit-X.Y.Z.dmg` |

**Windows:** run the `.exe` installer and click through the prompts. Windows may warn "unrecognised app" since this isn't a signed, store-published app — click **More info → Run anyway**.

**Mac:** open the `.dmg` and drag the app into Applications. Because this build isn't signed with a paid Apple Developer certificate, macOS will block it on first launch:

- If you see **"developer cannot be verified"** — right-click the app, choose **Open**, then click **Open** again in the dialog. You only need to do this once.
- If you see **"Apple could not verify 'GM Toolkit' is free of malware"** — this is the current Gatekeeper wording for the same "not notarized" situation (no paid Apple Developer certificate). Go to **System Settings → Privacy & Security**, scroll to the Security section, and click **Open Anyway** next to the GM Toolkit message, then confirm in the dialog that follows. You only need to do this once.
- If you instead see **"GM Toolkit is damaged and can't be opened"** — this is misleading; the app isn't actually broken, macOS is just refusing to run an unsigned app (common on newer macOS versions). Open **Terminal** (search for it with Spotlight), run:

  ```bash
  xattr -cr "/Applications/GM Toolkit.app"
  ```

  then open the app normally. You only need to do this once per install.

After that, the app checks for updates itself (Settings → Updates) — see below.

---

## Privacy

- Everything you create lives only on your computer, in a local database — nothing is uploaded anywhere.
- Voice transcription happens entirely on your machine; no audio ever leaves your computer.
- An Anthropic (Claude) API key is completely optional and only used if you turn on the "smart parse" import feature. It's stored encrypted and never leaves your device.

---

## Getting updates

Updates happen from inside the app (Settings → Updates) once it's installed — you don't need to redownload anything from GitHub each time:

- **Windows:** clicking "Download" installs the update silently — just click "Restart & install" when it's ready.
- **Mac:** clicking "Download" opens the GitHub releases page so you can grab the new `.dmg` and reinstall (full silent updates on Mac require a paid Apple Developer certificate).

---

## Status

In active development. The core experience — library, live voice feed, dashboard, combat tracker, campaigns and party sheets — is built and working, along with in-app updates via GitHub Releases.

---

## For developers

**Prerequisites:** Node.js 18+ (20 recommended) and npm.

```bash
npm install
npm run dev      # launches the app with hot-reload
```

> Changes to the renderer hot-reload instantly. Changes to the **main process or preload** (`src/main`, `src/preload`) require the dev server to restart.

```bash
npm run typecheck      # type-checks main + renderer
```

**Project layout:**

```
src/main        Electron main process (window, mic permissions, secrets, D&D Beyond fetch)
src/preload     Context-isolated bridge exposed as window.dmc
src/renderer    The React app
  app/          Layout, sidebar, router, campaign switcher
  features/     library, voice, board (dashboard), session, party, settings
  lib/          stores (Zustand), db (Dexie), api (Open5e, Anthropic), import, dnd, templates
  components/   shared UI
```

**Tech stack:** Electron 33 · electron-vite · React 18 · TypeScript · Tailwind CSS · Zustand · Dexie (IndexedDB) · `@huggingface/transformers` (Whisper) · electron-builder.

### Building installers

```bash
npm run build:mac      # → dist/gm-toolkit-<version>.dmg
npm run build:win      # → dist/gm-toolkit-<version>-setup.exe  (NSIS)
npm run build:unpack   # unpacked build for quick local testing
```

A custom app icon is optional — drop a 1024×1024 `build/icon.png` and electron-builder generates the platform icons; without it the default Electron icon is used. Targets live in [`electron-builder.yml`](electron-builder.yml). Cross-building (e.g. a Windows installer from macOS) is unreliable — build each platform on its own OS, or in CI.

Builds are **unsigned** by default, so macOS Gatekeeper and Windows SmartScreen will both warn on first launch (see "Installing the app" above for how to get past that). Removing the macOS warning entirely needs an Apple Developer certificate (signing + notarisation). On Apple Silicon the build is `arm64`; add `--universal` to also run on Intel Macs.

### Publishing an update

Do this whenever you want to push a new version out to users:

1. **Bump the version** in `package.json` — e.g. `"version": "0.1.0"` → `"0.2.0"`.
2. **Set your GitHub token** (create one at github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens; give it **Contents: Read and write** on this repo):

   ```bash
   export GH_TOKEN=your_token_here
   ```

3. **Build and publish:**

   ```bash
   npm run publish:mac      # run this on a Mac
   npm run publish:win      # run this on a Windows machine
   ```

Each command builds the app and creates a GitHub Release with the installer attached. The next time a user opens the app and checks for updates, it'll find and offer the new version.

---

## Licence

MIT
