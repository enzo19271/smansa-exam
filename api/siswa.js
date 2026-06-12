// api/siswa.js – Data ujian tersedia untuk siswa
// Query param: ?action=ujian-hari-ini&kelas=10.1

const GITHUB_PAT   = process.env.GITHUB_PAT;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO  = process.env.GITHUB_REPO;

async function getGithubFile(path) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_PAT}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const json = await res.json();
  const content = Buffer.from(json.content, "base64").toString("utf-8");
  return JSON.parse(content);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, kelas } = req.query;

  try {
    if (action === "ujian-hari-ini") {
      if (!kelas) return res.status(400).json({ error: "Parameter kelas wajib diisi" });

      const semua = await getGithubFile("data/ujian.json");
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      const tersedia = semua.filter(
        (u) =>
          u.tanggal === today &&
          u.status === "aktif" &&
          u.kelas.includes(kelas)
      );

      return res.status(200).json({ success: true, ujian: tersedia });
    }

    return res.status(400).json({ error: "Action tidak dikenal" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal mengambil data" });
  }
}
