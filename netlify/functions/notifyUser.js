// netlify/functions/notifyUser.js

const { Client } = require("pg");

exports.handler = async function (event) {
    // 1) Только POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 2) Разбираем путь вида
    //    /.netlify/functions/notifyUser/{eventName}/{userAlias}/
    const parts = event.path.replace(/\/$/, "").split("/");
    const [eventName, userAlias] = parts.slice(-3);

    // 2.1) Парсим тело и достаём текст
    let customText;
    try {
        const body = JSON.parse(event.body || "{}");
        customText = body.text;
    } catch (e) {
        return { statusCode: 400, body: "Bad Request: invalid JSON" };
    }
    if (!customText) {
        return { statusCode: 400, body: "Bad Request: missing 'text' in body" };
    }

    // 3) Подключаемся к Neon
    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const userQ = await client.query(
            "SELECT chat_id FROM users WHERE alias = $1",
            [userAlias]
        );

        if (userQ.rowCount === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    error: "Alias not found",
                    missing: [
                        userQ.rowCount === 0 && userAlias
                    ].filter(Boolean)
                })
            };
        }

        const userChatId = userQ.rows[0].chat_id;

        // 5) Используем единый текст из body
        const send = async (chat_id, text) => {
            const res = await fetch(
                `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id, text })
                }
            );
            if (!res.ok) {
                const body = await res.text();
                throw new Error(`Telegram API ${res.status}: ${body}`);
            }
        };

        // 6) Шлём кастомный текст и пользователю, и владельцу
        await send(userChatId, customText);

        return {
            statusCode: 200,
            body: JSON.stringify({ status: "ok" })
        };

    } catch (err) {
        console.error("Error in notifyJoin:", err);
        return {
            statusCode: 502,
            body: "Bad Gateway: " + err.message
        };
    } finally {
        await client.end();
    }
};
