// api/ujian.js — Guru manages exams (ujian)
// Handles: add, update, delete, get_soal, list
const { readFile, writeFile, parseBody } = require("./lib/github");

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key,x-guru-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // ── GET: List all ujian (guru bisa lihat miliknya saja via filter frontend) ──
    if (req.method === "GET") {
      const { data } = await readFile("data/ujian.json", []);
      return res.status(200).json(Array.isArray(data) ? data : []);
    }

    // ── POST: add / update / delete / get_soal ujian ────────────────────────────
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });

    // Validasi authentication (guru atau admin)
    const adminKey = req.headers["x-admin-key"];
    const guruKey = req.headers["x-guru-key"];
    const isAdmin = adminKey === ADMIN_KEY;

    if (!isAdmin && !guruKey) {
      return res.status(401).json({ error: "Unauthorized: x-guru-key atau x-admin-key diperlukan" });
    }

    // Jika guru, validasi guru key terhadap data/guru.json
    let guruMatch = null;
    if (!isAdmin) {
      const { data: guruList } = await readFile("data/guru.json", []);
      guruMatch = (Array.isArray(guruList) ? guruList : []).find(
        (g) => g.guru_key === guruKey
      );
      if (!guruMatch) {
        return res.status(401).json({ error: "Key guru tidak valid" });
      }
    }

    // Parse request body
    const body = await parseBody(req);
    const { action, ujian_id, mapel_id, mapel_nama, kelas, kunci, soal, aktif } = body;

    if (!action) {
      return res.status(400).json({ error: "Field 'action' wajib diisi" });
    }

    // ── READ ujian data ────────────────────────────────────────────────────────
    const { data: ujianList, sha } = await readFile("data/ujian.json", []);
    const list = Array.isArray(ujianList) ? ujianList : [];

    // ────────────────────────────────────────────────────────────────────────────
    // ACTION: list — Get all ujian (filter by guru at frontend level)
    // ────────────────────────────────────────────────────────────────────────────
    if (action === "list") {
      return res.status(200).json(list);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // ACTION: get_soal — Get full exam with solutions (for guru editing)
    // ────────────────────────────────────────────────────────────────────────────
    if (action === "get_soal") {
      if (!ujian_id) {
        return res.status(400).json({ error: "ujian_id wajib untuk get_soal" });
      }
      const ujian = list.find((u) => u.id === ujian_id);
      if (!ujian) {
        return res.status(404).json({ error: `Ujian '${ujian_id}' tidak ditemukan` });
      }
      // Cek akses: guru hanya bisa akses ujian miliknya
      if (!isAdmin && guruMatch && guruMatch.mapel_id !== ujian.mapel_id) {
        return res.status(403).json({ error: "Akses ditolak untuk mapel ini" });
      }
      return res.status(200).json({ soal: ujian.soal || [], ujian });
    }

    // ────────────────────────────────────────────────────────────────────────────
    // ACTION: add — Create new exam
    // ────────────────────────────────────────────────────────────────────────────
    if (action === "add") {
      // Validasi input
      if (!mapel_id || !Array.isArray(kelas) || !kelas.length || !kunci) {
        return res.status(400).json({
          error: "mapel_id, kelas (array), dan kunci wajib diisi"
        });
      }
      if (!Array.isArray(soal) || !soal.length) {
        return res.status(400).json({
          error: "soal harus berupa array dengan minimal 1 item"
        });
      }

      // Cek akses guru: hanya bisa buat untuk mapel miliknya
      if (!isAdmin && guruMatch && guruMatch.mapel_id !== mapel_id) {
        return res.status(403).json({
          error: "Akses ditolak: Anda hanya bisa buat ujian untuk mapel Anda sendiri"
        });
      }

      // Validasi soal
      for (let i = 0; i < soal.length; i++) {
        if (!soal[i].pertanyaan?.trim()) {
          return res.status(400).json({
            error: `Soal #${i + 1}: Pertanyaan tidak boleh kosong`
          });
        }
        if (!soal[i].jawaban) {
          return res.status(400).json({
            error: `Soal #${i + 1}: Jawaban benar (jawaban) wajib dipilih`
          });
        }
        const opsi = soal[i].opsi || {};
        if (!opsi.A?.trim() || !opsi.B?.trim() || !opsi.C?.trim() || !opsi.D?.trim()) {
          return res.status(400).json({
            error: `Soal #${i + 1}: Semua opsi (A,B,C,D) wajib diisi`
          });
        }
      }

      // Generate ID ujian
      const newUjianId = `ujian_${Date.now()}`;

      // Buat object ujian baru
      const newUjian = {
        id: newUjianId,
        mapel_id,
        mapel_nama: mapel_nama || mapel_id,
        kelas: Array.isArray(kelas) ? kelas : [],
        kunci,
        soal: soal.map((s) => ({
          id: s.id || `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pertanyaan: s.pertanyaan?.trim() || "",
          opsi: s.opsi || {},
          jawaban: s.jawaban || "A"
        })),
        aktif: aktif !== false,
        dibuat_at: new Date().toISOString(),
        guru_id: guruMatch ? guruMatch.id : "admin"
      };

      list.push(newUjian);
      await writeFile("data/ujian.json", list, sha);

      return res.status(200).json({ ok: true, ujian_id: newUjianId });
    }

    // ────────────────────────────────────────────────────────────────────────────
    // ACTION: update — Edit existing exam
    // ────────────────────────────────────────────────────────────────────────────
    if (action === "update") {
      if (!ujian_id) {
        return res.status(400).json({ error: "ujian_id wajib untuk update" });
      }

      const ujianIdx = list.findIndex((u) => u.id === ujian_id);
      if (ujianIdx === -1) {
        return res.status(404).json({ error: `Ujian '${ujian_id}' tidak ditemukan` });
      }

      const ujian = list[ujianIdx];

      // Cek akses guru: hanya bisa edit miliknya
      if (!isAdmin && guruMatch && guruMatch.mapel_id !== ujian.mapel_id) {
        return res.status(403).json({ error: "Akses ditolak" });
      }

      // Validasi input (gunakan field yang ada atau data lama)
      const finalMapelId = mapel_id || ujian.mapel_id;
      const finalKelas = Array.isArray(kelas) ? kelas : ujian.kelas || [];
      const finalKunci = kunci?.trim() || ujian.kunci;
      const finalSoal = soal || ujian.soal || [];

      if (!finalKelas.length || !finalKunci) {
        return res.status(400).json({
          error: "Kelas dan kunci ujian tidak boleh kosong"
        });
      }

      // Validasi soal jika ada update
      if (soal && Array.isArray(soal)) {
        for (let i = 0; i < soal.length; i++) {
          if (!soal[i].pertanyaan?.trim()) {
            return res.status(400).json({
              error: `Soal #${i + 1}: Pertanyaan tidak boleh kosong`
            });
          }
          if (!soal[i].jawaban) {
            return res.status(400).json({
              error: `Soal #${i + 1}: Jawaban benar wajib dipilih`
            });
          }
        }
      }

      // Update ujian
      list[ujianIdx] = {
        ...ujian,
        mapel_id: finalMapelId,
        mapel_nama: mapel_nama || ujian.mapel_nama,
        kelas: finalKelas,
        kunci: finalKunci,
        soal: finalSoal.map((s) => ({
          id: s.id || `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pertanyaan: s.pertanyaan?.trim() || "",
          opsi: s.opsi || {},
          jawaban: s.jawaban || "A"
        })),
        aktif: aktif !== undefined ? aktif : ujian.aktif,
        diupdate_at: new Date().toISOString()
      };

      await writeFile("data/ujian.json", list, sha);
      return res.status(200).json({ ok: true });
    }

    // ────────────────────────────────────────────────────────────────────────────
    // ACTION: delete — Delete exam
    // ────────────────────────────────────────────────────────────────────────────
    if (action === "delete") {
      if (!ujian_id) {
        return res.status(400).json({ error: "ujian_id wajib untuk delete" });
      }

      const ujian = list.find((u) => u.id === ujian_id);
      if (!ujian) {
        return res.status(404).json({ error: `Ujian '${ujian_id}' tidak ditemukan` });
      }

      // Cek akses guru
      if (!isAdmin && guruMatch && guruMatch.mapel_id !== ujian.mapel_id) {
        return res.status(403).json({ error: "Akses ditolak" });
      }

      const filtered = list.filter((u) => u.id !== ujian_id);
      await writeFile("data/ujian.json", filtered, sha);

      return res.status(200).json({ ok: true });
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Unknown action
    // ────────────────────────────────────────────────────────────────────────────
    return res.status(400).json({ error: `Action '${action}' tidak dikenal` });

  } catch (err) {
    console.error("ujian.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
