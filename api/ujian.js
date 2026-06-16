// api/ujian.js — CRUD ujian (guru) dan GET publik untuk siswa
// Struktur data/ujian.json: [ { id, guru_id, mapel_id, mapel_nama, kelas[], kunci, soal[], aktif,
//                                acak_soal, waktu_mulai, waktu_selesai, waktu_menit } ]

const { readFile, writeFile, parseBody } = require("./lib/github");

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key,x-guru-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // ── GET PUBLIC: untuk siswa ambil soal (tanpa jawaban) ─────────────────
    if (req.method === "GET") {
      const { mapel_id, kelas, ujian_id } = req.query;
      if (!mapel_id || !kelas) return res.status(400).json({ error: "mapel_id dan kelas wajib" });

      const { data: ujianAll } = await readFile("data/ujian.json", []);
      const list = Array.isArray(ujianAll) ? ujianAll : [];

      const kelasStr = String(kelas);
      const kelasMatch = (u) => (u.kelas || []).some(k => {
        const ks = String(k);
        return ks === kelasStr || kelasStr.startsWith(ks + ".");
      });

      let ujian = null;

      if (ujian_id) {
        const byId = list.find(u => u.id === ujian_id);
        if (byId && byId.mapel_id === mapel_id && byId.aktif !== false && kelasMatch(byId)) {
          ujian = byId;
        }
      }

      if (!ujian) {
        ujian = list.find((u) => u.mapel_id === mapel_id && u.aktif !== false && kelasMatch(u));
      }

      if (!ujian) return res.status(200).json({ soal: [], acak_soal: false, waktu_menit: null });

      // ── Cek window waktu (deadline) ──────────────────────────────────────
      const now = new Date();
      if (ujian.waktu_mulai && now < new Date(ujian.waktu_mulai)) {
        return res.status(403).json({
          error: "Ujian belum dimulai",
          code: "BELUM_MULAI",
          waktu_mulai: ujian.waktu_mulai
        });
      }
      if (ujian.waktu_selesai && now > new Date(ujian.waktu_selesai)) {
        return res.status(403).json({
          error: "Waktu ujian sudah berakhir",
          code: "SUDAH_SELESAI",
          waktu_selesai: ujian.waktu_selesai
        });
      }

      // Hapus jawaban sebelum dikirim ke siswa; sertakan metadata ujian
      const soalSafe = (ujian.soal || []).map(({ jawaban, ...rest }) => rest);
      return res.status(200).json({
        soal: soalSafe,
        acak_soal: ujian.acak_soal === true,
        waktu_menit: ujian.waktu_menit || null
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // ── Autentikasi ─────────────────────────────────────────────────────────
    const adminKey = req.headers["x-admin-key"];
    const guruKey  = req.headers["x-guru-key"];
    const isAdmin  = adminKey === ADMIN_KEY;

    let guruMatch = null;
    if (!isAdmin) {
      if (!guruKey) return res.status(401).json({ error: "Unauthorized" });
      const { data: guruList } = await readFile("data/guru.json", []);
      guruMatch = (Array.isArray(guruList) ? guruList : []).find(g => g.guru_key === guruKey);
      if (!guruMatch) return res.status(401).json({ error: "Key guru tidak valid" });
    }

    const body = await parseBody(req);
    const { action } = body;

    const { data: ujianAll, sha } = await readFile("data/ujian.json", []);
    const list = Array.isArray(ujianAll) ? ujianAll : [];

    // ── LIST: guru lihat ujian miliknya ─────────────────────────────────────
    if (action === "list") {
      const myUjian = isAdmin ? list : list.filter(u => u.guru_id === guruMatch.id);
      const slim = myUjian.map(({ soal, ...rest }) => ({
        ...rest,
        soal_count: (soal||[]).length
      }));
      return res.status(200).json({ ujian: slim });
    }

    // ── GET SOAL: guru edit soal ujian tertentu ──────────────────────────────
    if (action === "get_soal") {
      const { ujian_id } = body;
      const ujian = list.find(u => u.id === ujian_id);
      if (!ujian) return res.status(404).json({ error: "Ujian tidak ditemukan" });
      if (!isAdmin && ujian.guru_id !== guruMatch.id) return res.status(403).json({ error: "Akses ditolak" });
      return res.status(200).json({ soal: ujian.soal || [] });
    }

    // ── ADD: guru buat ujian baru ────────────────────────────────────────────
    if (action === "add") {
      const { mapel_id, mapel_nama, kelas, kunci, soal, aktif,
              acak_soal, waktu_mulai, waktu_selesai, waktu_menit } = body;
      if (!mapel_id || !kelas || !kelas.length) return res.status(400).json({ error: "mapel_id dan kelas wajib" });

      if (!isAdmin && guruMatch.mapel_id !== mapel_id) {
        return res.status(403).json({ error: "Guru hanya bisa membuat ujian untuk mapelnya sendiri" });
      }

      const newUjian = {
        id: "ujian_" + Date.now(),
        guru_id: isAdmin ? "admin" : guruMatch.id,
        mapel_id,
        mapel_nama: mapel_nama || mapel_id,
        kelas: Array.isArray(kelas) ? kelas : [kelas],
        kunci: kunci || "",
        soal: Array.isArray(soal) ? soal : [],
        aktif: aktif !== false,
        acak_soal: acak_soal === true,
        waktu_mulai: waktu_mulai || null,
        waktu_selesai: waktu_selesai || null,
        waktu_menit: waktu_menit ? Number(waktu_menit) : null,
        created_at: new Date().toISOString()
      };
      list.push(newUjian);
      await writeFile("data/ujian.json", list, sha);
      return res.status(200).json({ ok: true, id: newUjian.id });
    }

    // ── UPDATE: guru edit ujian ──────────────────────────────────────────────
    if (action === "update") {
      const { ujian_id, kelas, kunci, soal, aktif,
              acak_soal, waktu_mulai, waktu_selesai, waktu_menit } = body;
      const idx = list.findIndex(u => u.id === ujian_id);
      if (idx === -1) return res.status(404).json({ error: "Ujian tidak ditemukan" });
      if (!isAdmin && list[idx].guru_id !== guruMatch.id) return res.status(403).json({ error: "Akses ditolak" });

      if (kelas         !== undefined) list[idx].kelas         = Array.isArray(kelas) ? kelas : [kelas];
      if (kunci         !== undefined) list[idx].kunci         = kunci;
      if (soal          !== undefined) list[idx].soal          = Array.isArray(soal) ? soal : [];
      if (aktif         !== undefined) list[idx].aktif         = aktif;
      if (acak_soal     !== undefined) list[idx].acak_soal     = acak_soal === true;
      if (waktu_mulai   !== undefined) list[idx].waktu_mulai   = waktu_mulai || null;
      if (waktu_selesai !== undefined) list[idx].waktu_selesai = waktu_selesai || null;
      if (waktu_menit   !== undefined) list[idx].waktu_menit   = waktu_menit ? Number(waktu_menit) : null;
      list[idx].updated_at = new Date().toISOString();

      await writeFile("data/ujian.json", list, sha);
      return res.status(200).json({ ok: true });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (action === "delete") {
      const { ujian_id } = body;
      const ujian = list.find(u => u.id === ujian_id);
      if (!ujian) return res.status(404).json({ error: "Ujian tidak ditemukan" });
      if (!isAdmin && ujian.guru_id !== guruMatch.id) return res.status(403).json({ error: "Akses ditolak" });

      const filtered = list.filter(u => u.id !== ujian_id);
      await writeFile("data/ujian.json", filtered, sha);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Action '${action}' tidak dikenal` });

  } catch (err) {
    console.error("ujian.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
