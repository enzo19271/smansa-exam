// lib/github.js — shared GitHub JSON store helper

const BASE = "https://api.github.com";

// Semua env vars dibaca di dalam fungsi (bukan top-level),
// agar selalu fresh saat dieksekusi di Vercel serverless.
function getToken()  { return process.env.GITHUB_TOKEN; }
function getRepo()   { return process.env.GITHUB_REPO; }
function getBranch() { return process.env.GITHUB_BRANCH || "main"; }

function getHeaders() {
  const token = getToken();
  const repo  = getRepo();
  if (!token) throw new Error("GITHUB_TOKEN env var tidak diset di Vercel");
  if (!repo)  throw new Error("GITHUB_REPO env var tidak diset di Vercel");
  return {
    Authorization: `token ${token}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "e-exam-app",
  };
}

/** Parse request body — Vercel tidak otomatis parse JSON body */
async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { reject(new Error("Body bukan JSON valid")); }
    });
    req.on("error", reject);
  });
}

/** Read a JSON file from the repo. Returns { data, sha }. */
async function readFile(path, defaultValue = []) {
  const res = await fetch(
    `${BASE}/repos/${getRepo()}/contents/${path}?ref=${getBranch()}`,
    { headers: getHeaders() }
  );
  if (res.status === 404) return { data: defaultValue, sha: null };
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub read error ${res.status}: ${errText}`);
  }
  const json = await res.json();
  const content = Buffer.from(json.content, "base64").toString("utf-8");
  let data;
  try { data = JSON.parse(content); }
  catch { data = defaultValue; }
  return { data, sha: json.sha };
}

/** Write / overwrite a JSON file in the repo. */
async function writeFile(path, data, sha = null) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  const body = {
    message: `update ${path}`,
    content,
    branch: getBranch(),
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(`${BASE}/repos/${getRepo()}/contents/${path}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub write error ${res.status}: ${errText}`);
  }
  return true;
}

module.exports = { readFile, writeFile, parseBody };
