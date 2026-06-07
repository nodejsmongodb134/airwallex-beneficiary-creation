const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const mailer = require("../utils/mailer");
const Beneficiary = require("../models/Beneficiary");
const Transfer = require("../models/Transfer");
const auth = require("../middleware/auth");


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

  const user = await User.findOne({
    email: req.body.email
  });

  if (!user) {
    return res.send("Invalid Email");
  }

  if (user.blocked) {
  return res.send("Account blocked");
  }

  const ok = await bcrypt.compare(
    req.body.password,
    user.password
  );

  if (!ok) {
    return res.send("Invalid Password");
  }

  req.session.user = user;

  // ROLE BASED ACCESS
  if (user.role === "ADMIN") {
    return res.redirect("/admin");
  }

  if (user.role === "CASHIER") {
    return res.redirect("/cashier");
  }

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
   ADMIN DASHBOARD
------------------------*/
router.get("/admin", async (req, res) => {

  // check login
  if (!req.session.user) {
    return res.redirect("/login");
  }

  // admin only
  if (req.session.user.role !== "ADMIN") {
    return res.send("Access denied");
  }

  // USERS
  const totalUsers = await User.countDocuments();

  const recentUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(5);

  // BENEFICIARIES
  const totalBeneficiaries = await Beneficiary.countDocuments();

  const recentBeneficiaries = await Beneficiary.find()
    .sort({ createdAt: -1 })
    .limit(5);

  // TRANSFERS
  const totalTransfers = await Transfer.countDocuments();

  const recentTransfers = await Transfer.find()
    .sort({ createdAt: -1 })
    .limit(5);

  // STATUS
  const pendingTransfers = await Transfer.countDocuments({
    status: "PENDING"
  });

  const successTransfers = await Transfer.countDocuments({
    status: "SUCCESS"
  });

  const failedTransfers = await Transfer.countDocuments({
    status: "FAILED"
  });

  res.render("admin", {
    user: req.session.user,

  totalUsers,
  totalBeneficiaries,
  totalTransfers,

  pendingTransfers,
  successTransfers,
  failedTransfers,

  recentUsers,
  recentBeneficiaries,
  recentTransfers
  });
});

/* -----------------------
   DELETE ADMIN USER DELETE
------------------------*/
router.post("/admin/delete-user/:id", async (req, res) => {

  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "ADMIN") {
    return res.send("Access denied");
  }

  await User.findByIdAndDelete(req.params.id);

  res.redirect("/admin");
});

/* -----------------------
   ADMIN BLOCK CASHIER
------------------------*/
router.post("/admin/block-user/:id", async (req, res) => {

  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "ADMIN") {
    return res.send("Access denied");
  }

  await User.findByIdAndUpdate(req.params.id, {
    blocked: true
  });

  res.redirect("/admin");
});

/* -----------------------
   ADMIN UNBLOCK USER
------------------------*/
router.post("/admin/unblock-user/:id", async (req, res) => {

  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "ADMIN") {
    return res.send("Access denied");
  }

  await User.findByIdAndUpdate(req.params.id, {
    blocked: false
  });

  res.redirect("/admin");
});

/* -----------------------
   ADMIN RESET PASSWORD
------------------------*/
router.post("/admin/reset-password/:id", async (req, res) => {

  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "ADMIN") {
    return res.send("Access denied");
  }

  const hash = await bcrypt.hash("123456", 10);

  await User.findByIdAndUpdate(req.params.id, {
    password: hash
  });

  res.redirect("/admin");
});





/* =========================
   CASHIER PAGE
========================= */


router.get("/cashier", auth, async (req, res) => {
  const beneficiaries = await Beneficiary.find().sort({ createdAt: -1 });

  res.render("cashier", {
    user: req.user,
    beneficiaries,
    user: req.session.user   // 👈 THIS FIXES YOUR ERROR
  });
});

/* -----------------------
   LOGOUT
------------------------*/
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});



module.exports = router;