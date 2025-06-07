// netlify/functions/notifyAdmins.js

const fetch = global.fetch || require("node-fetch");

exports.handler = async function (event) {
    // 1) Only POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 2) Parse payload: expect JSON body with field "s"
    let payload;
    try {
        payload = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: "Bad Request: invalid JSON" };
    }

    const text = payload.s;
    if (typeof text !== "string" || !text.trim()) {
        return { statusCode: 400, body: "Bad Request: missing or invalid 's' field" };
    }

    // 3) Send to hard-coded admin group
    const adminChatId = -4725261280;
    try {
        const res = await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: adminChatId,
                    text
                })
            }
        );
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Telegram API ${res.status}: ${body}`);
        }
        return { statusCode: 200, body: JSON.stringify({ status: "ok" }) };
    } catch (err) {
        console.error("Error in notifyAdmins:", err);
        return {
            statusCode: 502,
            body: "Bad Gateway: " + err.message
        };
    }
};
