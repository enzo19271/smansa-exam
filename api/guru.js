// api/guru.js — CRUD guru (admin); GET list (admin)
const { readFile, writeFile } = require("./lib/github");

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });

  // GET: list all guru
  if (req.method === "GET") {
    const { data } = await readFile("data/guru.json", []);
    return res.status(200).json(data);
  }

  // POST: add / delete / update guru
  const { action, guru } = req.body;
  const { data, sha } = await readFile("data/guru.json", []);

  if (action === "add") {
    if (data.find((g) => g.id === guru.id))
      return res.status(400).json({ error: "ID sudah ada" });
    // guru: { id, nama, mapel_id, kelas: [10,11,12], guru_key }
    data.push(guru);
    await writeFile("data/guru.json", data, sha);
    return res.status(200).json({ ok: true });
  }

  if (action === "delete") {
    const filtered = data.filter((g) => g.id !== guru.id);
    await writeFile("data/guru.json", filtered, sha);
    return res.status(200).json({ ok: true });
  }

  if (action === "update") {
    const idx = data.findIndex((g) => g.id === guru.id);
    if (idx === -1) return res.status(404).json({ error: "Tidak ditemukan" });
    data[idx] = { ...data[idx], ...guru };
    await writeFile("data/guru.json", data, sha);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Action tidak valid" });
};
