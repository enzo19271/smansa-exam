// lib/github.js — shared GitHub JSON store helper

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPO;   // e.g. "username/e-exam-data"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const BASE = "https://api.github.com";

const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/vnd.github.v3+json",
};

/** Read a JSON file from the repo. Returns parsed object or default. */
async function readFile(path, defaultValue = {}) {
  const res = await fetch(
    `${BASE}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers }
  );
  if (res.status === 404) return { data: defaultValue, sha: null };
  const json = await res.json();
  const content = Buffer.from(json.content, "base64").toString("utf-8");
  return { data: JSON.parse(content), sha: json.sha };
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
    headers,
    body: JSON.stringify(body),
  });
  return res.ok;
}

module.exports = { readFile, writeFile };
