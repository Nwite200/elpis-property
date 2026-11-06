# Elpis Property Limited — Independent Cloudflare Setup

This repository is a separate Elpis deployment. Do not connect it to Bliss Property's D1, R2, KV, Queue, Worker, domain, payment credentials, or production records.

## Cloudflare resources to create

Create these resources in the Cloudflare account chosen by Elpis:
- Worker: `elpis-property`
- D1 database: `elpis-property-db`
- R2 bucket: `elpis-property-files` (keep private)
- KV namespace: Elpis-specific namespace
- Queue: `elpis-property-tasks`

Copy the new D1 database ID and KV namespace ID into Elpis's `wrangler.toml`. The bucket and queue names must match the config. Do not use any Bliss resource IDs.

## First deployment safety

1. Keep `PAYMENT_MODE = "test"`.
2. Configure Worker secrets in Cloudflare (never commit secrets): `SETUP_SECRET`, and payment/provider secrets only when Elpis supplies its own production credentials.
3. Apply migrations to the Elpis D1 database only:
   `npm run db:migrate:remote`
4. Deploy the staging Worker and test login, each role dashboard, property listings, client portal, file access, reports, and chat.
5. Create the first Managing Director account using the setup endpoint and a strong one-time `SETUP_SECRET`; rotate/remove that secret immediately after setup.
6. Do not switch payments to live until Elpis's own merchant credentials, webhook URL, callback flow, and successful end-to-end test are verified.
7. Attach Elpis's approved domain only after the client confirms the exact domain and DNS access.

## Production

Use `wrangler.production.toml` after separately provisioning production D1/R2/KV/Queue resources and replacing its Elpis-only placeholders. Keep payment mode in test until the live-payment checklist is signed off.

## Important

The repository contains inherited sample/test data and inherited business wording in some secondary pages and docs. Review and replace it with Elpis-approved company details, branch contacts, property listings, policies, and legal text before public launch. Do not seed Bliss customer/staff records into Elpis.
