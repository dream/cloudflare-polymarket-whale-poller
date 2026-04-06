export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleSchedule(env));
  },
};

async function handleSchedule(env) {
  const user = env.WHALE_ADDRESS;
  const kvKey = "LAST_SUCCESS_TIMESTAMP";
  const topic = env.NTFY_SH_TOPIC_NAME;

  // 1. Get the last recorded timestamp from KV
  let lastTimestamp = await env.KV_STORE.get(kvKey);

  console.log(`Last success timestamp = ${lastTimestamp}`);

  // If no timestamp exists (first run), start from 1 hour ago
  if (!lastTimestamp) {
    lastTimestamp = Math.floor(Date.now() / 1000) - 3600;
    console.log(
      `No timestamp was found, setting timestamp to 1 hour ago. ${lastTimestamp}`,
    );
  }

  // 2. Fetch new activity from Polymarket
  // We use start = lastTimestamp + 1 to avoid duplicates
  const url = `https://data-api.polymarket.com/activity?user=${user}&start=${parseInt(lastTimestamp) + 1}&sortBy=TIMESTAMP&sortDirection=ASC&limit=20`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Cloudflare-Worker-Whale-Tracker" },
    });

    if (!response.ok) {
      console.error(`API Error: ${response.status}`);
      return;
    }

    const activities = await response.json();

    if (activities.length === 0) {
      console.log("No new activity found.");
      return;
    }

    // 3. Process the activities
    for (const activity of activities) {
      await notify(activity, topic);
    }

    // 4. Update the cursor to the timestamp of the latest event
    const newestTimestamp = activities[activities.length - 1].timestamp;
    await env.KV_STORE.put(kvKey, newestTimestamp.toString());

    console.log(
      `Processed ${activities.length} events. New cursor: ${newestTimestamp}`,
    );
  } catch (error) {
    console.error("Worker Execution Error:", error);
  }
}

async function notify(activity, topic) {
  const url = `https://ntfy.sh/${topic}`;

  const message =
    `🐋 Whale ${activity.side}: ${activity.asset}\n` +
    `Size: $${parseFloat(activity.size).toLocaleString()}\n` +
    `Price: $${activity.price}`;

  try {
    await fetch(url, {
      method: "POST",
      body: message,
      headers: {
        Title: "New Polymarket Trade",
        Priority: "high",
        Tags: "money_with_wings,chart_with_upwards_trend",
      },
    });
  } catch (e) {
    console.error("Notification failed", e);
  }
}
