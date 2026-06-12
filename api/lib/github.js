// lib/github.js — shared GitHub JSON store helper

const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const GITHUB_REPO   = process.env.GITHUB_REPO;    // e.g. "username/e-exam-data"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const BASE          = "https://api.github.com";

function getHeaders() {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN env var tidak diset");
  if (!GITHUB_REPO)  throw new Error("GITHUB_REPO env var tidak diset");
  return {
    Authorization: `token ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "e-exam-app",
  };
}

/** Parse request body — Vercel tidak otomatis parse JSON body */
async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body; // sudah diparsing
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

/** Read a JSON file from the repo. Returns parsed object or default. */
async function readFile(path, defaultValue = []) {
  const res = await fetch(
    `${BASE}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
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
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(`${BASE}/repos/${GITHUB_REPO}/contents/${path}`, {
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
