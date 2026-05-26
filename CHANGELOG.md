# Changelog

## [Unreleased]

### Added
- Configurable export border width (1–100px) with slider and number input in Canvas Settings. Previously hardcoded to 1px.

### Improved
- Agent workflow documentation: added pre/post-edit checklist to `copilot-instructions.md`
- Expanded `applyTo` coverage in instruction files (`projectSerializer.ts`, `PropertyPanel/**`)
- Corrected store-patterns docs to reflect `useAutoHistory` auto-push behavior

### Fixed
- Transparency Mask preview zoom can now be preserved while adjusting the threshold by disabling Pin Fit, matching Pixelator preview behavior.
- Crop, Transparency Mask, and Background Removal preview zoom controls are more consistent: Fit and Reset are distinct, scroll zoom/middle-drag panning are available where applicable, and Background Removal Fit recenters the image.
