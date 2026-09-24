# Community beta — 0.25.0-beta.2

Use `dist/Xbox-Preview-UI-Setup-0.25.0-beta.2.exe` to install, or `dist/Xbox-Preview-UI-Portable-0.25.0-beta.2.exe` without installation. Close the previous launcher first. Existing local settings are retained.

## This pass

- Fetched covers, wide art, backdrops, logos, and viewed screenshots are cached in local app data (up to 600 MB). Returning Home can use them offline; Reset clears the cache.
- Dark logos have a subtle light edge for contrast, the empty player profile has a small library-art preview, and controller button hints are white with dark letters.
- Public-source builds no longer embed a shared SteamGridDB key. Add your own key in Settings if you want SteamGridDB artwork.
- First-run setup now offers the optional SteamGridDB key directly, explains where to obtain it, and saves it before the initial artwork import.
- The README includes a latest-layout promotional Home mockup and a clearly labeled handheld composite made from a supplied device image.
- Returning launches show the last saved library immediately, then refresh it in the background with a small progress indicator. The full-screen import remains for first launch.
- Background refresh keeps keyboard/controller focus on a valid tile. Reset all launcher data also clears the saved library snapshot.
- Home's main game tiles and the final Library collage tile are 30% larger. Library grids and other collections keep their existing size.
- “Most played on Steam” keeps the live player count visible even when you own the game. Missing counts are labelled unavailable.
- Search no longer opens Game options when you type the letter O.
- Launching blocks repeat launches and navigation behind the launch screen. Failed Windows shortcuts report the error instead of recording a successful launch.
- Controller disconnect notifications work when Windows reports the device as disconnected.
- Failed metadata requests stop showing loading text, and a late failure cannot replace the next game's description.

## Coverage and limits

The isolated review exercises cached startup before a delayed scan, background refresh, focus retention, snapshot reset, sample-library screens, modal focus and Back navigation, owned/unowned chart counts, search input, offline metadata, and desktop/handheld layouts including 125% scale. It does not launch installed games or alter the player's settings.

Physical controller behavior, launch handoff to individual games, authenticated Steam/Epic/Xbox services, and direct Windows FSE Home-app registration still need real-device and account testing. Artwork providers can return no match or stop responding. This is an unofficial community beta, not a Microsoft product.
