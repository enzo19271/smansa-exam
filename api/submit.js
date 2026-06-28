// api/submit.js
// REVISI: Tambahkan submit locking dan prevent concurrent submission
const { readFile, writeFile, parseBody } = require("./lib/github");

// ── Simple in-memory lock untuk prevent concurrent submit (serverless-friendly) ────────
// Dalam env production, gunakan Redis. Untuk testing ini cukup.
const submitLocks = new Map(); // key: "${nama}|${kelas}|${mapel_id}", value: timestamp

const LOCK_TIMEOUT = 10000; // 10 detik, timeout lock jika proses stuck
const lockKey = (nama, kelas, mapel_id) => `${String(nama).toLowerCase()}|${String(kelas).toLowerCase()}|${String(mapel_id).toLowerCase()}`;

function acquireLock(key) {
  const now = Date.now();
  const lastLock = submitLocks.get(key);
  
  // Jika ada lock dan belum timeout
  if (lastLock && (now - lastLock < LOCK_TIMEOUT)) {
    return false; // Lock acquire gagal
  }
  
  // Acquire lock
  submitLocks.set(key, now);
  return true;
}

function releaseLock(key) {
  submitLocks.delete(key);
}

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
    const { nama, kelas, mapel_id, jawaban, ujian_id } = body;

    // Ambil field anti-cheat (opsional, default 0 / false)
    const cheat_count       = Number(body.cheat_count)       || 0;
    const auto_submit_cheat = Boolean(body.auto_submit_cheat) || false;

    if (!nama || !kelas || !mapel_id || !jawaban)
      return res.status(400).json({ error: "Data tidak lengkap" });

    // ── REVISI: Acquire lock untuk prevent concurrent submit ─────────────────
    const key = lockKey(nama, kelas, mapel_id);
    if (!acquireLock(key)) {
      // Lock failed = ada submit lain sedang berjalan
      return res.status(429).json({
        error: "pending",
        message: "Ujian sedang diproses. Mohon tunggu beberapa saat...",
        retry_after: 3
      });
    }

    try {
      // Cek duplikat
      const { data: hasilList, sha: hasilSha } = await readFile("data/hasil.json", []);
      const list = Array.isArray(hasilList) ? hasilList : [];

      const sudahAda = list.find(
        h => h.nama.trim().toLowerCase() === nama.trim().toLowerCase()
          && String(h.kelas) === String(kelas)
          && h.mapel_id === mapel_id
      );
      if (sudahAda) {
        releaseLock(key);
        return res.status(409).json({
          error: "duplicate",
          message: `${nama} sudah mengerjakan ujian ini.`,
          nilai: sudahAda.nilai,
          waktu: sudahAda.waktu,
        });
      }

      // Ambil soal dari ujian.json (sumber utama)
      let soal = [];
      const { data: ujianList } = await readFile("data/ujian.json", []);
      const ujianArr = Array.isArray(ujianList) ? ujianList : [];

      // Cari ujian yang cocok: by ujian_id kalau ada, atau by mapel_id+kelas
      let ujianMatch = ujian_id
        ? ujianArr.find(u => u.id === ujian_id)
        : ujianArr.find(u =>
            u.mapel_id === mapel_id &&
            u.aktif !== false &&
            (u.kelas || []).some(k => String(k) === String(kelas) || String(kelas).startsWith(String(k) + "."))
          );

      if (ujianMatch && Array.isArray(ujianMatch.soal) && ujianMatch.soal.length) {
        soal = ujianMatch.soal;
      } else {
        // Fallback ke file soal lama
        const kelasMain = String(kelas).split(".")[0];
        const { data: soalFile } = await readFile(`data/soal/${mapel_id}_${kelasMain}.json`, []);
        soal = Array.isArray(soalFile) ? soalFile : [];
      }

      if (!soal.length) {
        releaseLock(key);
        return res.status(404).json({ error: `Soal tidak ditemukan untuk ujian ini` });
      }

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

      // Simpan hasil — termasuk data anti-cheat
      list.push({
        id:                `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        nama,
        kelas,
        mapel_id,
        benar,
        total,
        nilai,
        ujian_id:          ujianMatch?.id || null,
        waktu:             new Date().toISOString(),
        // ── Field anti-cheat ──────────────────────────────────────────────
        cheat_count,                  // 0 = jujur, 1 = 1 peringatan, dst
        auto_submit_cheat,            // true = dikumpul paksa karena 3x curang
      });
      await writeFile("data/hasil.json", list, hasilSha);

      releaseLock(key);
      return res.status(200).json({ ok: true, nilai, benar, total, detail });

    } catch (innerErr) {
      releaseLock(key);
      throw innerErr;
    }

  } catch (err) {
    console.error("submit.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
