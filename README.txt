VignaDigital website ZIP publishing patch

Copy server/server.js over your existing server/server.js.
Copy server/supabase.js over your existing server/supabase.js (check that env var names match your Vercel settings).
Copy admin-pages/onboard-restaurant.html over your existing file.
Merge package.json dependencies/scripts with your existing package.json, then run npm install.
Replace vercel.json with this file, then redeploy.

Supabase Storage setup:
1. Create a PRIVATE bucket named website-uploads.
2. Create a PUBLIC bucket named restaurant-sites.
3. Set SUPABASE_URL, SUPABASE_SECRET_KEY, and SESSION_SECRET in Vercel Environment Variables.
4. Keep the Supabase service-role/secret key server-only; never put it in HTML or client JS.
5. Make sure the restaurants table has website_status, website_path, website_source, slug and other fields expected by your current API.

ZIP requirements: maximum 5 MB compressed, maximum 25 MB extracted, 500 files, index.html at ZIP root or inside one top-level folder. Allowed static file types are defined in server/server.js. Server-side code does not execute PHP, Node, Python, or other server code from uploaded ZIPs.

Important limitations: GitHub import only records the repository metadata in this version; ZIP upload is the implemented publishing path. This is intended for small static websites. Large sites/videos should use a dedicated object-storage/CDN workflow. Test with a non-production slug first. Review Supabase bucket policies and Vercel function limits before production use.
