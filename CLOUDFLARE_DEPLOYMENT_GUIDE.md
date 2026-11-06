# Elpis Property Limited — Cloudflare Deployment Guide

## Current status

This repository is configured as an Elpis staging project, not as a live production deployment. No Bliss Cloudflare account IDs, D1 identifiers, KV identifiers, R2 buckets, Queue names or payment credentials may be reused.

## Target architecture

- Cloudflare Worker: elpis-property
- Workers Static Assets: application HTML, CSS, JavaScript and images
- D1: elpis-property-staging-db
- R2: elpis-property-staging-files
- KV: Elpis staging cache namespace
- Queue: elpis-property-staging-tasks
- Domain: elpisproperty.org

## Required setup in Elpis's Cloudflare account

1. Confirm the Cloudflare account invitation and select the Elpis account.
2. Create a D1 database named elpis-property-staging-db.
3. Create an R2 bucket named elpis-property-staging-files.
4. Create a KV namespace for Elpis staging.
5. Create the Queue elpis-property-staging-tasks.
6. Copy the newly generated D1 database ID and KV namespace ID into this repository's wrangler.toml.
7. Confirm the Worker name is elpis-property and that all bindings point only to Elpis resources.
8. Configure secrets using Elpis-issued credentials. Never commit secrets to GitHub.

The current wrangler.toml deliberately contains placeholder identifiers. Do not deploy until those placeholders are replaced with IDs created inside Elpis's Cloudflare account.

## Database migration safety

First run and verify migrations against a local D1 database. Only after the Elpis staging D1 resource exists should remote migrations be applied to that specific Elpis database. Do not use a database name or identifier from another business or Cloudflare account.

## Payment integration

ALATPay is not ready for live use until Elpis completes its own merchant onboarding and supplies its own production Business ID, API credentials and webhook configuration. Keep test and production credentials separate. Never reuse Bliss credentials.

## Domain

Attach elpisproperty.org to the Elpis Worker only after the staging application passes its tests. Configure www separately if Elpis wants that hostname. Do not change the Bliss domain or its DNS.

## Release gate

Before production:
- Complete Elpis branding and remove all legacy references.
- Confirm branch locations, official contact details and staff roles with Elpis.
- Provision separate production D1, R2, KV and Queue resources.
- Configure Elpis-owned secrets.
- Run all test suites and complete manual role-based checks.
- Verify backups, access controls, webhook signature checks and private report storage.
