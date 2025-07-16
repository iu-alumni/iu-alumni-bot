// netlify/functions/getFeedback.js

const { Client } = require("pg");

exports.handler = async function (event) {
    if (event.httpMethod !== "GET") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }
    const client = new Client({ connectionString: process.env.NEON_DATABASE_URL.trim(), ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        // Создаём таблицу feedback, если ещё нет
        await client.query(
            `CREATE TABLE IF NOT EXISTS feedback (
        id         SERIAL PRIMARY KEY,
        alias      TEXT,
        question   TEXT NOT NULL,
        answer     TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );`
        );
        const res = await client.query(
            `SELECT alias, question, answer, created_at FROM feedback ORDER BY created_at DESC;`
        );
        await client.end();
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(res.rows) };
    } catch (err) {
        console.error("Error in getFeedback:", err);
        await client.end();
        return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message }) };
    }
};
