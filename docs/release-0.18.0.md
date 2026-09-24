# 0.18.0 — Interface refinement

This update brings the main screens into one visual system: charcoal surfaces,
consistent spacing and typography, white focus rings, and restrained transitions.

- Game options now separate Manage, Artwork, and Advanced, alongside a persistent
  cover and Play action. Steam actions remain limited to Steam games.
- Settings use a quieter sidebar and clearer section hierarchy.
- The player profile has a larger identity area, a simpler statistics strip,
  gamerpic collection, and a persistent save footer.
- Library filters sit on a subdued background with responsive square tiles.
- Game pages use a left-to-right backdrop fade, a cleaner action area, and
  reorganized information and capability cards.
- Achievement cards open a readable detail view using the provider's artwork
  when available. Catalog entries do not imply earned achievements.
- Onboarding keeps optional online integrations inside a disclosure.
- Back navigation and dialog focus restoration share one implementation.
- Launch, import, controller status, artwork, and news surfaces share the same
  presentation rules. Reduced-motion preferences remain supported.

## Verification

The isolated demo review covers Home, Library, game options, Settings,
Personalization, Profile, game details, achievement details, and onboarding at
1600×1000; options, Settings, and Library are also checked at 1280×800.
Checks include modal bounds, horizontal overflow, options tab visibility, and
Library-to-Home Back navigation. Demo achievement content is a layout fixture,
not an account-integration test.

A physical controller and handheld battery/performance test remain necessary
before describing this build as release-certified. This is an unofficial project,
not a Microsoft or Xbox product.
