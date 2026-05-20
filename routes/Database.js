const mongoose = require("mongoose");
const express = require("express");
const Beneficiary = require("../models/Beneficiary");
const Transfer = require("../models/Transfer");
const { BASE_URL, getAccessToken } = require("../utils/airwallex");
const router = express.Router();


mongoose
  .connect("mongodb://127.0.0.1:27017/airwallex-create")
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => {
    console.log("MongoDB Error:", err);
  });

module.exports = router;