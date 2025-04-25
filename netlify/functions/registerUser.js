// netlify/functions/registerUser.js

const { Client } = require("pg");

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    let update;
    try {
        update = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: "Bad Request" };
    }

    const msg = update.message;
    if (!msg?.from?.username) {
        return { statusCode: 200, body: "No username, skipping" };
    }

    const alias = msg.from.username;
    const chatId = msg.chat.id;

    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL.trim(),
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Создаём таблицу, если её ещё нет
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        alias   TEXT    PRIMARY KEY,
        chat_id BIGINT  NOT NULL
      );
    `);

        // Upsert: вставляем или обновляем
        await client.query(
            `INSERT INTO users(alias, chat_id)
         VALUES($1, $2)
       ON CONFLICT(alias) DO UPDATE
         SET chat_id = EXCLUDED.chat_id`,
            [alias, chatId]
        );

        // …далее ваш sendMessage…
    } catch (err) {
        console.error("DB error:", err);
        return { statusCode: 500, body: "DB error" };
    } finally {
        await client.end();
    }

    // …ответ Telegram…
};
