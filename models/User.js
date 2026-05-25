const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: { type: String, default: "CASHIER" },

  resetToken: String,
  resetTokenExpire: Date,
});

module.exports = mongoose.model("User", userSchema);