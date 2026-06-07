const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: String,
    email: String,
    password: String,
    role: String,

    blocked: {
      type: Boolean,
      default: false
    },

    resetToken: String,
    resetTokenExpire: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);