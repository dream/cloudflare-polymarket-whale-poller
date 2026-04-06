# Polymarket Whale Poller

Cloudflare Worker that monitors a Polymarket whale address for new trades and sends push notifications via [ntfy.sh](https://ntfy.sh).

## How It Works

1. Runs on a cron schedule (every 1 minute by default)
2. Reads the last-seen timestamp from Cloudflare KV
3. Fetches new activity from the Polymarket API for the configured whale address
4. Sends a push notification per trade via ntfy.sh
5. Updates the KV cursor to the newest activity timestamp

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Cloudflare](https://cloudflare.com) account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- An [ntfy.sh](https://ntfy.sh) topic for receiving notifications

## Setup

```bash
# Install dependencies
npm install

# Authenticate with Cloudflare
npx wrangler login

# Create a KV namespace
npx wrangler kv namespace create KV_STORE
```

Copy the KV namespace ID from the output and update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "KV_STORE"
id = "<your-namespace-id>"
```

Set your whale address and ntfy topic as secrets:

```bash
npx wrangler secret put WHALE_ADDRESS
npx wrangler secret put NTFY_SH_TOPIC_NAME
```

Generate TypeScript types from your bindings:

```bash
npm run cf-typegen
```

## Development

```bash
npm run dev
```

## Testing

```bash
npm test
```

## Deployment

```bash
npm run deploy
```

## Configuration

| Binding | Type | Description |
|---|---|---|
| `WHALE_ADDRESS` | Secret | Polymarket user address to monitor |
| `NTFY_SH_TOPIC_NAME` | Secret | ntfy.sh topic name for push notifications |
| `KV_STORE` | KV Namespace | Stores `LAST_SUCCESS_TIMESTAMP` cursor |

The cron schedule is configured in `wrangler.toml` under `[triggers]`. Default: `* * * * *` (every minute).
