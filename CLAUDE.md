# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Cloudflare Worker that polls the Polymarket activity API for a specific whale address and sends push notifications via [ntfy.sh](https://ntfy.sh) when new trades are detected. Uses KV storage to track a cursor (last seen timestamp) so only new activity is reported.

## Architecture

TypeScript worker (`src/index.ts`) with a `scheduled` handler (Cron Trigger). Flow:
1. Read last-seen timestamp from KV (`KV_STORE`)
2. Fetch new activity from `data-api.polymarket.com/activity` for the configured whale address
3. Send a notification per activity via ntfy.sh POST
4. Write the newest timestamp back to KV

## Environment Bindings

- `env.WHALE_ADDRESS` — (secret) Polymarket user address to monitor
- `env.NTFY_SH_TOPIC_NAME` — (secret) ntfy.sh topic for push notifications
- `env.KV_STORE` — Cloudflare KV namespace binding (stores `LAST_SUCCESS_TIMESTAMP`)

## Development

- `npm run dev` — start local dev server via Wrangler
- `npm run deploy` — deploy to Cloudflare
- `npm test` — run tests with Vitest (uses `@cloudflare/vitest-pool-workers` to run in Workers runtime)
- `npm run cf-typegen` — regenerate `worker-configuration.d.ts` from `wrangler.toml` bindings (run after changing wrangler.toml)

## Project Structure

- `src/index.ts` — main worker entry point
- `wrangler.toml` — Cloudflare Workers configuration (cron, KV, secrets)
- `worker-configuration.d.ts` — generated types for env bindings (committed, regenerate with `npm run cf-typegen`)
