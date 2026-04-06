import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { env } from "cloudflare:workers";
import { handleSchedule, notify } from "../src/index";

const KV_KEY = "LAST_SUCCESS_TIMESTAMP";

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    side: "BUY",
    asset: "Will ETH hit $5k?",
    size: "15000.50",
    price: "0.72",
    timestamp: 1700000000,
    ...overrides,
  };
}

let fetchCalls: { url: string; init?: RequestInit }[];
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      fetchCalls.push({ url, init });

      if (url.includes("data-api.polymarket.com")) {
        // Return the mock data set by individual tests
        return new Response(JSON.stringify(mockApiResponse), { status: 200 });
      }
      if (url.includes("ntfy.sh")) {
        return new Response("ok", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

let mockApiResponse: unknown[] = [];

describe("notify", () => {
  it("sends a correctly formatted notification to ntfy.sh", async () => {
    const activity = makeActivity();

    await notify(activity, "test-topic");

    expect(fetchCalls).toHaveLength(1);
    const call = fetchCalls[0]!;
    expect(call.url).toBe("https://ntfy.sh/test-topic");
    expect(call.init?.method).toBe("POST");
    expect(call.init?.body).toContain("Whale BUY");
    expect(call.init?.body).toContain("Will ETH hit $5k?");
    expect(call.init?.body).toContain("Price: $0.72");

    const headers = call.init?.headers as Record<string, string>;
    expect(headers["Title"]).toBe("New Polymarket Trade");
    expect(headers["Priority"]).toBe("high");
  });
});

describe("handleSchedule", () => {
  beforeEach(async () => {
    await env.KV_STORE.delete(KV_KEY);
    mockApiResponse = [];
  });

  it("does nothing when there are no new activities", async () => {
    await env.KV_STORE.put(KV_KEY, "1700000000");
    mockApiResponse = [];

    await handleSchedule(env);

    // Only the Polymarket API call, no ntfy calls
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.url).toContain("data-api.polymarket.com");

    // KV should remain unchanged
    const cursor = await env.KV_STORE.get(KV_KEY);
    expect(cursor).toBe("1700000000");
  });

  it("processes activities and updates the KV cursor", async () => {
    await env.KV_STORE.put(KV_KEY, "1700000000");
    mockApiResponse = [
      makeActivity({ timestamp: 1700000001 }),
      makeActivity({ timestamp: 1700000002, side: "SELL", size: "5000" }),
    ];

    await handleSchedule(env);

    // 1 API call + 2 notification calls
    expect(fetchCalls).toHaveLength(3);
    expect(fetchCalls[0]!.url).toContain("data-api.polymarket.com");
    expect(fetchCalls[0]!.url).toContain("start=1700000001");
    expect(fetchCalls[1]!.url).toContain("ntfy.sh");
    expect(fetchCalls[2]!.url).toContain("ntfy.sh");

    // Cursor should be updated to the newest timestamp
    const cursor = await env.KV_STORE.get(KV_KEY);
    expect(cursor).toBe("1700000002");
  });

  it("uses a timestamp ~1 hour ago on first run", async () => {
    const beforeRun = Math.floor(Date.now() / 1000) - 3600;
    mockApiResponse = [];

    await handleSchedule(env);

    // Verify the start param is approximately now - 3600 + 1
    const apiUrl = new URL(fetchCalls[0]!.url);
    const start = parseInt(apiUrl.searchParams.get("start") ?? "0");
    expect(Math.abs(start - (beforeRun + 1))).toBeLessThan(5);

    // KV should not be set since there were no activities
    const cursor = await env.KV_STORE.get(KV_KEY);
    expect(cursor).toBeNull();
  });
});
