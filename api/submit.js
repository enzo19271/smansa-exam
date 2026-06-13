// api/submit.js
const { readFile, writeFile, parseBody } = require("./lib/github");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── GET: cek duplikat sebelum ujian (dipanggil dari form-ujian.html) ───────
  if (req.method === "GET") {
    try {
      const { nama, kelas, mapel_id } = req.query;
      if (!nama || !kelas || !mapel_id)
        return res.status(400).json({ error: "Parameter tidak lengkap" });

      const { data } = await readFile("data/hasil.json", []);
      const list = Array.isArray(data) ? data : [];

      const sudahAda = list.find(
        h => h.nama.trim().toLowerCase() === nama.trim().toLowerCase()
          && String(h.kelas) === String(kelas)
          && h.mapel_id === mapel_id
      );

      return res.status(200).json({
        sudah: !!sudahAda,
        nilai: sudahAda?.nilai ?? null,
        waktu: sudahAda?.waktu ?? null,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: submit jawaban ujian ─────────────────────────────────────────────
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = await parseBody(req);
    const { nama, kelas, mapel_id, jawaban } = body;

    if (!nama || !kelas || !mapel_id || !jawaban)
      return res.status(400).json({ error: "Data tidak lengkap" });

    // Cek duplikat sekali lagi saat submit (double-guard)
    const { data: hasilList, sha: hasilSha } = await readFile("data/hasil.json", []);
    const list = Array.isArray(hasilList) ? hasilList : [];

    const sudahAda = list.find(
      h => h.nama.trim().toLowerCase() === nama.trim().toLowerCase()
        && String(h.kelas) === String(kelas)
        && h.mapel_id === mapel_id
    );
    if (sudahAda) {
      return res.status(409).json({
        error: "duplicate",
        message: `${nama} sudah mengerjakan ujian ini.`,
        nilai: sudahAda.nilai,
        waktu: sudahAda.waktu,
      });
    }

    // Ambil soal
    const kelasMain = String(kelas).split(".")[0];
    const { data: soalList } = await readFile(`data/soal/${mapel_id}_${kelasMain}.json`, []);
    const soal = Array.isArray(soalList) ? soalList : [];

    if (!soal.length)
      return res.status(404).json({ error: `Soal tidak ditemukan (${mapel_id} kelas ${kelasMain})` });

    // Hitung nilai
    let benar = 0;
    const detail = soal.map(s => {
      const pilihan = jawaban[s.id] || null;
      const correct = pilihan === s.jawaban;
      if (correct) benar++;
      return { id: s.id, pilihan, jawaban: s.jawaban, benar: correct };
    });

    const total = soal.length;
    const nilai = Math.round((benar / total) * 100);

    // Simpan hasil
    list.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nama, kelas, mapel_id, benar, total, nilai,
      waktu: new Date().toISOString(),
    });
    await writeFile("data/hasil.json", list, hasilSha);

    return res.status(200).json({ ok: true, nilai, benar, total, detail });

  } catch (err) {
    console.error("submit.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
