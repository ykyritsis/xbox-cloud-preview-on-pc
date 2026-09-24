# 0.19.0 — Artwork sources and collections

## Artwork

Choose artwork now has separate **SteamGridDB** and **Official Steam** sources
for tiles, backgrounds, wide art, and logos. Official assets are checked for
availability before they appear. They do not need a SteamGridDB or Steam Web API
key. Steam titles use their App ID; custom titles can use an explicitly entered
Steam App ID to avoid silently matching the wrong edition.

Official Steam covers are not necessarily square. Existing square composition
and centered-logo controls still apply. Your manual artwork stays unchanged
until you save. Source switches ignore stale requests.

## Home and Library

Below news, collection cards link to installed controller-ready, single-player,
multiplayer, and ready-to-play games. Empty categories are hidden. Capability
collections depend on the metadata available for each game; unknown capabilities
are not guessed. The matching shelves include See all links, and Library has an
All collections selector for clearing the collection filter.

## Profile and Settings

Profile opens on an Overview with library statistics and recent games. Gamerpic
and name editing live under Customize profile. Settings use flatter neutral
cards and a clearer sidebar. Typography prefers the reference site's Segoe Sans
Variable Text when installed, then Windows Segoe fallbacks. No proprietary font
files are bundled. This is a closer visual interpretation, not a pixel-identical
copy of signed-in Xbox screens.

## Checks

The isolated Electron visual test covers the new profile tabs, collection links,
official artwork lookup, options, settings, onboarding, and Back navigation.
Layouts are checked at 1600×1000 and 1280×800. Physical controller behavior still
requires device testing. No player library or settings are reset by this update.
