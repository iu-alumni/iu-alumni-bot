// netlify/functions/notifyUpcoming.js

const { Client } = require("pg");

exports.handler = async function (event) {
    // 1) Only POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 2) Parse path: 
    //    /.netlify/functions/notifyUpcoming/{eventName}/{userAlias}/
    const parts = event.path.replace(/\/$/, "").split("/");
    const [eventName, userAlias] = parts.slice(-2);

    // 3) Connect to Neon
    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL.trim(),
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();

        // 4) Fetch chat_id for user
        const userQ = await client.query(
            "SELECT chat_id FROM users WHERE alias = $1",
            [userAlias]
        );
        if (userQ.rowCount === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    error: "Alias not found",
                    missing: [userAlias],
                }),
            };
        }
        const userChatId = userQ.rows[0].chat_id;

        // 5) Build reminder message
        const text = `⏰ Reminder: your event "${eventName}" is starting soon!`;

        // 6) Send via Telegram Bot API
        const res = await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: userChatId, text }),
            }
        );
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Telegram API ${res.status}: ${body}`);
        }

        return { statusCode: 200, body: JSON.stringify({ status: "ok" }) };
    }
    catch (err) {
        console.error("Error in notifyUpcoming:", err);
        return {
            statusCode: 502,
            body: "Bad Gateway: " + err.message,
        };
    }
    finally {
        await client.end();
    }
};
