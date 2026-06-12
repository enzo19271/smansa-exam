// api/hasil.js — GET hasil ujian (admin or guru); POST submit hasil (siswa)
const { readFile, writeFile, parseBody } = require("./lib/github");

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key,x-guru-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const adminKey = req.headers["x-admin-key"];
      const guruKey  = req.headers["x-guru-key"];
      const isAdmin  = adminKey === ADMIN_KEY;

      let guruMatch = null;
      if (!isAdmin) {
        if (!guruKey) return res.status(401).json({ error: "Unauthorized" });
        const { data: guruList } = await readFile("data/guru.json", []);
        guruMatch = (Array.isArray(guruList) ? guruList : []).find(
          (g) => g.guru_key === guruKey
        );
        if (!guruMatch)
          return res.status(401).json({ error: "Key guru tidak valid" });
      }

      const { data: hasilList } = await readFile("data/hasil.json", []);
      const list = Array.isArray(hasilList) ? hasilList : [];

      const filtered = isAdmin
        ? list
        : list.filter((h) => h.mapel_id === guruMatch.mapel_id);

      return res.status(200).json(filtered);
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error("hasil.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
