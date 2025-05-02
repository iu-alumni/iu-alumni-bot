// netlify/functions/getFeedback.js

const { Client } = require("pg");

exports.handler = async function (event) {
    if (event.httpMethod !== "GET") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL.trim(),
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();

        // Если таблицы ещё нет — создаём её
        await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id          SERIAL PRIMARY KEY,
        alias       TEXT,
        chat_id     BIGINT    NOT NULL,
        poll_id     TEXT      NOT NULL,
        option_ids  TEXT[]    NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT now()
      );
    `);

        // Теперь можно безопасно SELECT
        const res = await client.query(`
      SELECT alias,
             chat_id,
             poll_id,
             option_ids,
             created_at
      FROM feedback
      ORDER BY created_at DESC;
    `);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(res.rows),
        };
    } catch (err) {
        console.error("Error in getFeedback:", err);
        // возвращаем текст ошибки для отладки (на проде можно убрать)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
            headers: { "Content-Type": "application/json" },
        };
    } finally {
        await client.end();
    }
};
