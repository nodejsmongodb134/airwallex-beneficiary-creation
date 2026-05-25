const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const mailer = require("../utils/mailer");

const router = express.Router();

/* -----------------------
   REGISTER
------------------------*/
router.get("/register", (req, res) => {
  res.render("register");
});

router.post("/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);

  await User.create({
    username: req.body.username,
    email: req.body.email,
    password: hash,
    role: req.body.role,
  });

  res.redirect("/login");
});

/* -----------------------
   LOGIN
------------------------*/

router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("login");
});


router.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) return res.send("Invalid email");

  const ok = await bcrypt.compare(req.body.password, user.password);

  if (!ok) return res.send("Invalid password");

  req.session.user = user;

  res.redirect("/");
});

/* -----------------------
   FORGOT PASSWORD
------------------------*/
router.get("/forgot", (req, res) => {
  res.render("forgot");
});

router.post("/forgot", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) return res.send("Email not found");

  const token = crypto.randomBytes(32).toString("hex");

  user.resetToken = token;
  user.resetTokenExpire = Date.now() + 1000 * 60 * 15;

  await user.save();

  const link = `http://localhost:3000/reset/${token}`;

  await mailer.sendMail({
    to: user.email,
    subject: "Password Reset",
    text: link,
  });

  res.send("Reset link sent to email");
});

/* -----------------------
   RESET PASSWORD
------------------------*/
router.get("/reset/:token", async (req, res) => {
  const user = await User.findOne({
    resetToken: req.params.token,
    resetTokenExpire: { $gt: Date.now() },
  });

  if (!user) return res.send("Invalid or expired token");

  res.render("reset", { token: req.params.token });
});

router.post("/reset/:token", async (req, res) => {
  const user = await User.findOne({
    resetToken: req.params.token,
    resetTokenExpire: { $gt: Date.now() },
  });

  if (!user) return res.send("Invalid token");

  user.password = await bcrypt.hash(req.body.password, 10);
  user.resetToken = undefined;
  user.resetTokenExpire = undefined;

  await user.save();

  res.redirect("/login");
});

/* -----------------------
   LOGOUT
------------------------*/
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;