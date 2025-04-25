// netlify/functions/registerUser.js

const { Client } = require("pg");

exports.handler = async function (event) {
    // Telegram шлёт только POST с JSON
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    let update;
    try {
        update = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: "Bad Request" };
    }

    // Нас интересуют только обычные сообщения с алиасом
    const msg = update.message;
    if (!msg || !msg.from || !msg.from.username) {
        return { statusCode: 200, body: "No username, skipping" };
    }

    const alias = msg.from.username;
    const chatId = msg.chat.id;

    // Подключаемся к Neon
    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Upsert: если алиас есть — обновляем chat_id, если нет — создаём
        await client.query(
            `INSERT INTO users(alias, chat_id)
       VALUES($1, $2)
       ON CONFLICT(alias) DO UPDATE
         SET chat_id = EXCLUDED.chat_id`,
            [alias, chatId]
        );

    } catch (err) {
        console.error("DB error:", err);
        return { statusCode: 500, body: "DB error" };
    } finally {
        await client.end();
    }

    // Можно тут же прислать приветственное сообщение
    try {
        await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `Привет, @${alias}! Вы успешно зарегистрированы для уведомлений.`
                })
            }
        );
    } catch (err) {
        console.error("Telegram send error:", err);
    }

    return { statusCode: 200, body: "OK" };
};
