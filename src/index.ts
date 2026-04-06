interface Activity {
    side: string;
    asset: string;
    size: string;
    price: string;
    timestamp: number;
}

export default {
    async scheduled(
        _controller: ScheduledController,
        env: Env,
        ctx: ExecutionContext,
    ): Promise<void> {
        ctx.waitUntil(handleSchedule(env));
    },
} satisfies ExportedHandler<Env>;

export async function handleSchedule(env: Env): Promise<void> {
    const user = env.WHALE_ADDRESS;
    const kvKey = "LAST_SUCCESS_TIMESTAMP";
    const topic = env.NTFY_SH_TOPIC_NAME;

    // Get the last recorded timestamp from KV
    let lastTimestamp = await env.KV_STORE.get(kvKey);

    console.log(`Last success timestamp = ${lastTimestamp}`);

    // If no timestamp exists (first run), start from 1 hour ago
    if (!lastTimestamp) {
        lastTimestamp = String(Math.floor(Date.now() / 1000) - 3600);
        console.log(
            `No timestamp was found, setting timestamp to 1 hour ago. ${lastTimestamp}`,
        );
    }

    // Fetch new activity from Polymarket (start = lastTimestamp + 1 to avoid duplicates)
    // limit=20 to stay within Cloudflare Workers free-tier sub-request limits; bursts >20 are handled across subsequent cron runs
    const url = `https://data-api.polymarket.com/activity?user=${user}&start=${parseInt(lastTimestamp) + 1}&sortBy=TIMESTAMP&sortDirection=ASC&limit=20`;

    try {
        const response = await fetch(url, {
            headers: {"User-Agent": "Cloudflare-Worker-Whale-Tracker"},
        });

        if (!response.ok) {
            console.error(`API Error: ${response.status}`);
            return;
        }

        const activities: Activity[] = await response.json();

        if (activities.length === 0) {
            console.log("No new activity found.");
            return;
        }

        // Send notifications for each activity, advancing the cursor only up to the last successful notification
        let lastSuccessTimestamp: number | null = null;
        for (const activity of activities) {
            const ok = await notify(activity, topic);
            if (!ok) {
                console.error(`Stopping at failed notification. Cursor will not advance past timestamp ${lastSuccessTimestamp}`);
                break;
            }
            lastSuccessTimestamp = activity.timestamp;
        }

        // Update the cursor to the timestamp of the last successfully notified event
        if (lastSuccessTimestamp !== null) {
            await env.KV_STORE.put(kvKey, lastSuccessTimestamp.toString());
        }

        console.log(
            `Processed ${activities.length} events. New cursor: ${newestTimestamp}`,
        );
    } catch (error) {
        console.error("Worker Execution Error:", error);
    }
}

export async function notify(activity: Activity, topic: string): Promise<boolean> {
    const url = `https://ntfy.sh/${topic}`;

    const message =
        `🐋 Whale ${activity.side}: ${activity.asset}\n` +
        `Size: $${parseFloat(activity.size).toLocaleString()}\n` +
        `Price: $${activity.price}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            body: message,
            headers: {
                Title: "New Polymarket Trade",
                Priority: "high",
                Tags: "money_with_wings,chart_with_upwards_trend",
            },
        });

        if (!response.ok) {
            console.error(`ntfy.sh error: ${response.status} ${response.statusText}`);
            return false;
        }

        return true;
    } catch (e) {
        console.error("Notification failed", e);
        return false;
    }
}
