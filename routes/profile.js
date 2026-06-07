const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.get("/", async (req, res) => {

  if (!req.session.user) {
    return res.redirect("/login");
  }

  const user = await User.findById(req.session.user.id);

  res.render("profile", {
    user
  });
});


module.exports = router;