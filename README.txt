ELPIS PROPERTY LIMITED — PROPERTY MANAGEMENT PLATFORM

This repository is the independent Elpis Property Limited application. It was copied as a starting codebase and is being configured for Elpis. It must use only Elpis-owned Cloudflare resources, domains, payment credentials and business data.

Technology
----------
Cloudflare Workers + D1 + R2 + KV + Queues + Workers Static Assets.
No Supabase, Firebase, Vercel or Netlify is required.

Before local setup
------------------
1. Use Node.js 22 or later.
2. Install dependencies with npm install.
3. Create a local D1 database using the Elpis Wrangler configuration.
4. Apply migrations locally only: npm run db:migrate:local.
5. Run npm run dev and open http://localhost:8787/login.html.

IMPORTANT
---------
Do not run remote migrations or deploy until the Elpis Cloudflare D1, R2, KV and Queue resources have been created and their identifiers added to wrangler.toml. Never copy Bliss production or staging identifiers, account credentials, demo users, payment secrets or customer data into this repository.

Test commands
-------------
npm run test:phase5
npm run test:phase6
npm run test:phase7
npm run test:phase8
npm run test:seed
npm run test:browser
npm test

The browser suite may require a locally installed Chrome/Chromium browser.

Core screens
-----------
- index.html — Elpis public website
- login.html / signup.html — staff sign-in and public client registration
- dashboard.html — role-aware staff dashboard
- clients.html / properties.html — client and property management
- commissions.html / referral-commissions.html — commissions and referrals
- reports.html / revenue.html — reporting and revenue
- staff-management.html / staff-notifications.html / staff-chat.html — staff tools
- client-dashboard.html and related client pages — client portal

Configuration
-------------
- wrangler.toml — Elpis staging Worker and resource bindings
- migrations/ — database schema migrations
- assets/js/site-config.js — public company details and branch placeholders
- assets/js/intro-config.js — Elpis logo intro and brand colours

Elpis business contact: hr@elpisproperty.org
Website: https://elpisproperty.org

Branch addresses, telephone numbers, social links, payment provider credentials and production resource IDs must be supplied and verified by Elpis before production launch.
