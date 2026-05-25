const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

// CREATE USER PAGE
router.get("/users/create", (req, res) => {
  res.render("create-user");
});

// CREATE USER HANDLER
router.post("/users/create", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      username,
      email,
      password: hashedPassword,
      role,
    });

    return res.redirect("/users/create");
  } catch (err) {
    console.log(err);
    res.status(500).send("User creation failed");
  }
});

module.exports = router;