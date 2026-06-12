// api/auth-admin.js — Verify ADMIN_KEY
const { parseBody } = require("./lib/github");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = await parseBody(req);
    const { key } = body;
    if (!key) return res.status(400).json({ error: "Key diperlukan" });

    const ADMIN_KEY = process.env.ADMIN_KEY;
    if (!ADMIN_KEY)
      return res.status(500).json({ error: "ADMIN_KEY belum dikonfigurasi di env" });

    if (key === ADMIN_KEY) {
      return res.status(200).json({ valid: true });
    }
    return res.status(401).json({ valid: false, error: "Key tidak valid" });
  } catch (err) {
    console.error("auth-admin error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
