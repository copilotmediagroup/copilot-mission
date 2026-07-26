# Client Live Tracking v1.0.1 — Boot Recovery

This release hardens application startup after the GitHub upload-ready package produced a blank Bolt preview.

## Changes
- Added a root startup guard.
- Added a React error boundary around the entire application.
- Startup failures now render an actionable on-screen message instead of a blank white page.
- Synchronized package and package-lock release versions.
- Preserved Client Live Tracking Engine, Live Location Engine, migrations, and existing platform functionality.
