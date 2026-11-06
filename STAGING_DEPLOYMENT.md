# Elpis Property Limited — Staging Deployment Record

## Status: not yet deployed

This file is an Elpis setup checklist. It intentionally contains no copied Bliss resource identifiers or deployment URLs.

## Intended staging resources

| Binding | Elpis resource | Status |
|---|---|---|
| Worker | elpis-property | Configuration prepared |
| D1 | elpis-property-staging-db | Create in Elpis Cloudflare account |
| R2 | elpis-property-staging-files | Create in Elpis Cloudflare account |
| KV | Elpis staging cache namespace | Create in Elpis Cloudflare account |
| Queue | elpis-property-staging-tasks | Create in Elpis Cloudflare account |
| Static Assets | Workers Static Assets | Configured in wrangler.toml |

## Outstanding setup

- [ ] Confirm Elpis Cloudflare account access.
- [ ] Create the Elpis staging D1 database and record its generated ID.
- [ ] Create the Elpis staging R2 bucket.
- [ ] Create the Elpis staging KV namespace and record its generated ID.
- [ ] Create the Elpis staging Queue.
- [ ] Replace the D1 and KV placeholders in wrangler.toml.
- [ ] Run local migrations and all automated tests.
- [ ] Apply migrations to Elpis staging D1 only.
- [ ] Deploy the Worker to Elpis staging.
- [ ] Verify login, client registration, role permissions, properties, payments, reports and staff tools.
- [ ] Attach elpisproperty.org after staging approval.

## Isolation requirement

All Elpis data, files, cache, queues, secrets, payment credentials and deployment resources must remain separate from Bliss. No Bliss database, bucket, namespace, queue, account ID or payment secret is authorized for use by Elpis.
