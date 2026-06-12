module.exports = (req, res) => {
  res.json({
    GITHUB_REPO: process.env.GITHUB_REPO,
    GITHUB_TOKEN_LENGTH: process.env.GITHUB_TOKEN?.length,
    GITHUB_TOKEN_PREFIX: process.env.GITHUB_TOKEN?.slice(0, 8),
  });
};
