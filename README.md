# Co Pilot Security Marketplace v1.2.2

## Authentication Gateway & Session Manager

This upload-ready build combines the Supabase connection with a protected authentication front door.

### Included
- Secure startup splash while Supabase restores the browser session
- Dedicated sign-in screen
- Public Client and Agency registration
- Profile and role loading before any portal renders
- Pending, disabled, rejected, missing-profile, and connection-error screens
- Local-device logout with application state cleanup
- Protected portal rendering
- Developer mock fallback only when Supabase environment variables are absent
- Supabase foundation migration with automatic profile creation trigger

### Important deployment order
1. Replace the GitHub repository contents with this package.
2. Allow Bolt to install dependencies and restart Vite.
3. In Supabase SQL Editor, run the complete migration:
   `supabase/migrations/202607240001_marketplace_foundation.sql`
4. Create a test Client or Agency account from the new registration screen.
5. Approve the account in SQL before portal access:

```sql
update public.profiles
set account_status = 'approved'
where id = '<AUTH USER UUID>';

-- Agency accounts also require agency approval:
update public.agencies
set status = 'approved'
where owner_user_id = '<AUTH USER UUID>';
```

### First Platform Admin
Create the user in Supabase Authentication, then update its generated profile:

```sql
update public.profiles
set role = 'platform_admin', account_status = 'approved'
where id = '<AUTH USER UUID>';
```

The publishable key is safe for frontend use. Never place the Supabase service-role key in this repository.
