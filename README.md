# Co Pilot Security Marketplace v1.2.2.1

## Authentication Logout Hotfix

This release preserves the Supabase migration already installed and changes frontend authentication only.

### Corrected behavior

- No automatic mock/demo portal entry
- Signed-out users always see the login screen
- Protected UI disappears immediately when Logout is pressed
- Supabase local session is cleared
- Temporary demo, marketplace and session state is cleared
- A hard navigation restarts the application at `/`
- Browser Back cannot revive the protected portal
- Startup always checks the current Supabase session before rendering a portal
- Profile and approval status are loaded before role routing

### Supabase connection

The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env`. It also contains the same publishable project configuration as a safe frontend fallback for GitHub/Bolt imports where hidden `.env` files are not copied.

### Database

Do not rerun the migration if it has already completed successfully. This package contains the migration only as the repository source of truth.
