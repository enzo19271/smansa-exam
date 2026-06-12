// api/submit.js — Submit hasil ujian siswa
const { readFile, writeFile, parseBody } = require("./lib/github");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = await parseBody(req);
    const { nama, kelas, mapel_id, jawaban } = body;

    if (!nama || !kelas || !mapel_id || !jawaban)
      return res.status(400).json({ error: "Data tidak lengkap" });

    // Ambil soal dengan kunci jawaban
    const path = `data/soal/${mapel_id}_${kelas}.json`;
    const { data: soalList } = await readFile(path, []);
    const soal = Array.isArray(soalList) ? soalList : [];

    if (!soal.length)
      return res.status(400).json({ error: "Soal tidak ditemukan untuk mapel/kelas ini" });

    // Hitung nilai
    let benar = 0;
    soal.forEach((s) => {
      if (jawaban[s.id] && jawaban[s.id] === s.jawaban) benar++;
    });
    const total = soal.length;
    const nilai = Math.round((benar / total) * 100);

    // Simpan hasil
    const { data: hasilList, sha } = await readFile("data/hasil.json", []);
    const list = Array.isArray(hasilList) ? hasilList : [];
    const hasil = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nama,
      kelas: Number(kelas),
      mapel_id,
      benar,
      total,
      nilai,
      waktu: new Date().toISOString(),
    };
    list.push(hasil);
    await writeFile("data/hasil.json", list, sha);

    return res.status(200).json({ ok: true, nilai, benar, total });

  } catch (err) {
    console.error("submit.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
