# E-EXAM — Portal Ujian Online

Aplikasi ujian online berbasis static HTML + Vercel Serverless Functions + GitHub sebagai data store.

---

## Setup

### 1. Buat Repo GitHub

Buat repo baru di GitHub (misal `e-exam`), lalu upload semua file ini ke dalam repo tersebut.

Pastikan folder `data/` berisi:
- `data/mapel.json` → `[]`
- `data/guru.json` → `[]`
- `data/hasil.json` → `[]`
- `data/soal/` (kosong, akan terisi otomatis)

### 2. Deploy ke Vercel

1. Hubungkan repo ke Vercel
2. Set Environment Variables di Vercel Dashboard:

| Variable | Nilai |
|---|---|
| `GITHUB_TOKEN` | Personal Access Token GitHub (scope: `repo`) |
| `GITHUB_REPO` | `username/e-exam` (nama repo kamu) |
| `GITHUB_BRANCH` | `main` |
| `ADMIN_KEY` | Key rahasia admin (bebas, misal `ADMIN2025`) |

### 3. Alur Penggunaan

#### Admin
1. Buka `/admin.html`
2. Login dengan `ADMIN_KEY`
3. Tambah **Mapel** (contoh: id=`matematika`, nama=`Matematika`, kelas: 10,11,12)
4. Tambah **Guru** (isi nama, pilih mapel, pilih kelas, buat key guru)

#### Guru
1. Buka `/guru.html`
2. Login dengan Key Guru yang diberikan admin
3. Pilih kelas, tambah soal (pertanyaan + 4 opsi + jawaban benar)
4. Klik **Simpan**
5. Bagikan **Key Ujian** ke siswa sebelum ujian dimulai

#### Siswa
1. Buka `/index.html` (beranda)
2. Klik badge kelas pada card mapel
3. Isi **Nama**, **Kelas** (misal 10.2), dan **Key Ujian dari Guru**
4. Baca instruksi, centang persetujuan, klik **Mulai Ujian**
5. Kerjakan soal pilihan ganda
6. Klik **Selesai & Kumpulkan**

---

## Struktur File

```
e-exam/
├── index.html          ← Dashboard publik
├── form-ujian.html     ← Form pendaftaran ujian
├── instruksi.html      ← Instruksi ujian
├── ujian.html          ← Halaman soal
├── selesai.html        ← Hasil ujian
├── admin.html          ← Panel admin
├── guru.html           ← Panel guru
├── vercel.json         ← Konfigurasi Vercel
├── api/
│   ├── lib/github.js   ← GitHub helper
│   ├── mapel.js        ← CRUD mapel
│   ├── guru.js         ← CRUD guru
│   ├── soal.js         ← CRUD soal
│   ├── verify-key.js   ← Verifikasi key ujian
│   ├── submit.js       ← Submit jawaban
│   ├── hasil.js        ← Hasil ujian
│   └── auth-admin.js   ← Login admin
└── data/
    ├── mapel.json
    ├── guru.json
    ├── hasil.json
    └── soal/           ← Dibuat otomatis: {mapel_id}_{kelas}.json
```

---

## Catatan Teknis

- Semua data disimpan di GitHub repo sebagai JSON
- Autentikasi guru menggunakan key plaintext (bisa diganti hash jika diperlukan)
- Timer ujian: 2 menit × jumlah soal
- Soal diacak tidak diterapkan (urut sesuai input guru)
