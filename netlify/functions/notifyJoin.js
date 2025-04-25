// netlify/functions/notifyJoin.js

const { Client } = require("pg");

exports.handler = async function (event) {
    // 1) Только POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 2) Разбираем путь вида
    //    /.netlify/functions/notifyJoin/{eventName}/{ownerAlias}/{userAlias}/
    const parts = event.path.replace(/\/$/, "").split("/");
    const [eventName, ownerAlias, userAlias] = parts.slice(-3);

    // 3) Подключаемся к Neon
    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 4) Читаем chat_id для owner и для user
        const ownerQ = await client.query(
            "SELECT chat_id FROM users WHERE alias = $1",
            [ownerAlias]
        );
        const userQ = await client.query(
            "SELECT chat_id FROM users WHERE alias = $1",
            [userAlias]
        );

        if (ownerQ.rowCount === 0 || userQ.rowCount === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    error: "Alias not found",
                    missing: [
                        ownerQ.rowCount === 0 && ownerAlias,
                        userQ.rowCount === 0 && userAlias
                    ].filter(Boolean)
                })
            };
        }

        const ownerChatId = ownerQ.rows[0].chat_id;
        const userChatId = userQ.rows[0].chat_id;

        // 5) Тексты уведомлений
        const textForUser = `You successfully joined this event: ${eventName}`;
        const textForOwner = `${userAlias} joined your event ${eventName}!`;

        // 6) Шлём через Telegram Bot API (глобальный fetch доступен)
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

        await send(userChatId, textForUser);
        await send(ownerChatId, textForOwner);

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
