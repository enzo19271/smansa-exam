// api/mapel.js — GET: list mapel; POST: add/update/delete mapel (admin only)
const { readFile, writeFile, parseBody } = require("./lib/github");

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // ── GET: public list ─────────────────────────────────────────────────────
    if (req.method === "GET") {
      const { data } = await readFile("data/mapel.json", []);
      return res.status(200).json(Array.isArray(data) ? data : []);
    }

    // ── POST: admin only ─────────────────────────────────────────────────────
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });

    // Verifikasi admin key
    const key = req.headers["x-admin-key"];
    if (!key || key !== ADMIN_KEY)
      return res.status(401).json({ error: "Unauthorized: x-admin-key salah atau tidak ada" });

    // Parse body secara eksplisit (fix bug utama Vercel)
    const body = await parseBody(req);
    const { action, mapel } = body;

    if (!action || !mapel)
      return res.status(400).json({ error: "Field 'action' dan 'mapel' wajib diisi" });

    const { data, sha } = await readFile("data/mapel.json", []);
    const list = Array.isArray(data) ? data : [];

    if (action === "add") {
      if (!mapel.id || !mapel.nama)
        return res.status(400).json({ error: "Mapel harus memiliki 'id' dan 'nama'" });
      const exists = list.find((m) => m.id === mapel.id);
      if (exists)
        return res.status(400).json({ error: `ID mapel '${mapel.id}' sudah ada` });
      list.push(mapel);
      await writeFile("data/mapel.json", list, sha);
      return res.status(200).json({ ok: true, data: mapel });
    }

    if (action === "delete") {
      if (!mapel.id)
        return res.status(400).json({ error: "ID mapel wajib untuk delete" });
      const filtered = list.filter((m) => m.id !== mapel.id);
      if (filtered.length === list.length)
        return res.status(404).json({ error: `Mapel '${mapel.id}' tidak ditemukan` });
      await writeFile("data/mapel.json", filtered, sha);
      return res.status(200).json({ ok: true });
    }

    if (action === "update") {
      if (!mapel.id)
        return res.status(400).json({ error: "ID mapel wajib untuk update" });
      const idx = list.findIndex((m) => m.id === mapel.id);
      if (idx === -1)
        return res.status(404).json({ error: `Mapel '${mapel.id}' tidak ditemukan` });
      list[idx] = { ...list[idx], ...mapel };
      await writeFile("data/mapel.json", list, sha);
      return res.status(200).json({ ok: true, data: list[idx] });
    }

    return res.status(400).json({ error: `Action '${action}' tidak dikenal` });

  } catch (err) {
    console.error("mapel.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
