# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Cloudflare Worker that polls the Polymarket activity API for a specific whale address and sends push notifications via [ntfy.sh](https://ntfy.sh) when new trades are detected. Uses KV storage to track a cursor (last seen timestamp) so only new activity is reported.

## Architecture

Single-file worker (`worker.js`) with a `scheduled` handler (Cron Trigger). Flow:
1. Read last-seen timestamp from KV (`KV_STORE`)
2. Fetch new activity from `data-api.polymarket.com/activity` for the configured whale address
3. Send a notification per activity via ntfy.sh POST
4. Write the newest timestamp back to KV

## Environment Bindings

- `env.WHALE_ADDRESS` — Polymarket user address to monitor
- `env.NTFY_SH_TOPIC_NAME` — ntfy.sh topic for push notifications
- `env.KV_STORE` — Cloudflare KV namespace binding (stores `LAST_SUCCESS_TIMESTAMP`)

## Development

Deploy and manage with Wrangler (`npx wrangler`). There is no `wrangler.toml` checked in yet — one is needed to configure the cron schedule, KV namespace binding, and environment variables.

No build step, tests, or dependencies — the worker is plain JS using only the Cloudflare Workers runtime APIs and `fetch`.
