const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

router.get("/users/create", (req, res) => {
  res.render("create-user");
});

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

    res.redirect("/users/create");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating user");
  }
});

module.exports = router;