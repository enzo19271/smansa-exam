// api/auth.js – Login endpoint
// ENV yang dibutuhkan di Vercel:
//   GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO

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
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi" });
  }

  try {
    const users = await getGithubFile("data/users.json");
    const user  = users.find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      return res.status(401).json({ error: "Username atau password salah" });
    }

    // Jangan kirim password ke client
    const { password: _pw, ...safeUser } = user;

    return res.status(200).json({
      success: true,
      user: safeUser,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal menghubungi server" });
  }
}
