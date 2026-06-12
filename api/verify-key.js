// api/verify-key.js — Verify guru key for a mapel+kelas combo
const { readFile, parseBody } = require("./lib/github");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = await parseBody(req);
    const { mapel_id, kelas, key } = body;

    if (!mapel_id || !kelas || !key)
      return res.status(400).json({ error: "Data tidak lengkap" });

    const { data: guruList } = await readFile("data/guru.json", []);
    const list = Array.isArray(guruList) ? guruList : [];

    const match = list.find(
      (g) =>
        g.mapel_id === mapel_id &&
        g.kelas.includes(Number(kelas)) &&
        g.guru_key === key
    );

    if (!match)
      return res.status(401).json({ valid: false, error: "Key tidak valid" });

    return res.status(200).json({ valid: true, guru_id: match.id, guru_nama: match.nama });

  } catch (err) {
    console.error("verify-key error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
