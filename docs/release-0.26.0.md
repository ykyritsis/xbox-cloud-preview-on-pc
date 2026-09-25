# Xbox Preview UI 0.26.0-beta.3

This beta is about making the launcher feel better from the sofa or a handheld. Home, game pages, and the small interactions around launching have had another pass.

## What's new

- Favorites and custom collections, with a Library tile that previews the next four games instead of repeating the Home row.
- A cleaner game page with an at-a-glance overview. When Steam has no matching listing, public Xbox Store data can fill in genre, release date, and clearly labelled capabilities.
- Public Steam achievement catalogs can show titles, descriptions, artwork, and rarity without an API key. The app does not mistake that catalog for your personal unlocks.
- A Return to game action after launch. Directly launched executables are checked for a running process; storefront launches offer a time-limited shortcut that minimizes the launcher.
- TV-friendly text sizing and high-contrast focus options, quieter import/artwork status, and a Power menu with confirmations for sleep, hibernate, restart, and shutdown.
- More consistent recent-game ordering and controller navigation.

## Download and update

- **Installer:** `Xbox-Preview-UI-Setup-0.26.0-beta.3.exe` for a normal Windows installation.
- **Portable:** `Xbox-Preview-UI-Portable-0.26.0-beta.3.exe` if you prefer to replace one EXE for each update.

Your existing launcher settings remain in Windows app data. First-time users can add their own SteamGridDB key during onboarding for community artwork; no shared key is bundled. Uninstalled Steam games and personal Steam progress still require the relevant Steam account visibility and Web API setup.

SHA-256 checksums:

- Portable: `BAB4D2FFC2259E096C6D1F0DDD12B45AFE476F5F1553C5C919F24D259025291B`
- Installer: `AA7BD0FFBD6D5F0776DF4FC93CB0DCFD80CE940B146F237ECF6C8BE405C42928`

## Notes

This is an unofficial fan project. It does not include games, grant ownership, or bypass a storefront. Artwork and metadata depend on the source services and may be missing or change over time. Xbox-only personal achievement progress requires authenticated access; TrueAchievements is linked for reference, not scraped into the app. The installer does not automatically register itself as the Xbox FSE Home app; see the [setup guide](xbox-mode.md).
