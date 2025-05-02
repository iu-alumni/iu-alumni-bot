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

        const res = await client.query(`
      SELECT alias,
             chat_id,
             poll_id,
             option_ids,
             created_at
      FROM feedback
      ORDER BY created_at DESC
    `);

        return {
            statusCode: 200,
            body: JSON.stringify(res.rows),
            headers: { "Content-Type": "application/json" },
        };
    } catch (err) {
        console.error("Error fetching feedback:", err);
        return { statusCode: 500, body: "DB error" };
    } finally {
        await client.end();
    }
};
