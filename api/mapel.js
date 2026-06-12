// api/mapel.js — GET: list mapel; POST: add/update mapel (admin only)
const { readFile, writeFile } = require("./lib/github");

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── GET: public list ──────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { data } = await readFile("data/mapel.json", []);
    return res.status(200).json(data);
  }

  // ── POST / DELETE: admin only ─────────────────────────────────────────────
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });

  const { action, mapel } = req.body;

  const { data, sha } = await readFile("data/mapel.json", []);

  if (action === "add") {
    // mapel: { id, nama, icon, kelas: [10,11,12] }
    const exists = data.find((m) => m.id === mapel.id);
    if (exists) return res.status(400).json({ error: "ID sudah ada" });
    data.push(mapel);
    await writeFile("data/mapel.json", data, sha);
    return res.status(200).json({ ok: true });
  }

  if (action === "delete") {
    const filtered = data.filter((m) => m.id !== mapel.id);
    await writeFile("data/mapel.json", filtered, sha);
    return res.status(200).json({ ok: true });
  }

  if (action === "update") {
    const idx = data.findIndex((m) => m.id === mapel.id);
    if (idx === -1) return res.status(404).json({ error: "Tidak ditemukan" });
    data[idx] = mapel;
    await writeFile("data/mapel.json", data, sha);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Action tidak valid" });
};
