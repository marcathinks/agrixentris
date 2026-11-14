const { handler, fail, makeToken, checkPassword } = require("./_lib.js");

module.exports = handler("POST", false, async (req, res) => {
  const pw = req.body && req.body.password;
  if (!checkPassword(pw)) {
    await new Promise((r) => setTimeout(r, 700)); // memperlambat tebakan beruntun
    throw fail(401, "wrong_password", "Kata sandi salah.");
  }
  res.status(200).json({ token: makeToken() });
});
