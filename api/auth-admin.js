// api/auth-admin.js — Verify ADMIN_KEY
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "Key diperlukan" });

  if (key === process.env.ADMIN_KEY) {
    return res.status(200).json({ valid: true });
  }
  return res.status(401).json({ valid: false, error: "Key tidak valid" });
};
