// api/submit.js — Submit jawaban siswa, hitung skor, simpan hasil
const { readFile, writeFile } = require("./lib/github");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { nama, kelas, mapel_id, jawaban } = req.body;
  // jawaban: { "soal_id": "A", ... }

  if (!nama || !kelas || !mapel_id || !jawaban)
    return res.status(400).json({ error: "Data tidak lengkap" });

  // Load answer key
  const soalPath = `data/soal/${mapel_id}_${kelas.toString().slice(0, 2)}.json`;
  const { data: soalList } = await readFile(soalPath, []);

  let benar = 0;
  const detail = soalList.map((s) => {
    const pilihan = jawaban[s.id] || null;
    const correct = pilihan === s.jawaban;
    if (correct) benar++;
    return { id: s.id, pilihan, jawaban: s.jawaban, benar: correct };
  });

  const total  = soalList.length;
  const nilai  = total > 0 ? Math.round((benar / total) * 100) : 0;

  // Save result
  const hasilPath = "data/hasil.json";
  const { data: hasilList, sha } = await readFile(hasilPath, []);
  const entry = {
    id: Date.now().toString(),
    nama,
    kelas,
    mapel_id,
    benar,
    total,
    nilai,
    waktu: new Date().toISOString(),
    detail,
  };
  hasilList.push(entry);
  await writeFile(hasilPath, hasilList, sha);

  return res.status(200).json({ nilai, benar, total, detail });
};
