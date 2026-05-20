const express = require("express");
const axios = require("axios");
const Beneficiary = require("../models/Beneficiary");
const Transfer = require("../models/Transfer");
const { BASE_URL, getAccessToken } = require("../utils/airwallex");

const router = express.Router();



router.get("/transfer/page/:beneficiary_id", async (req, res) => {
  try {
    const { beneficiary_id } = req.params;
    const { search } = req.query;

    const beneficiary = await Beneficiary.findOne({
      beneficiary_id,
    });

    if (!beneficiary) {
      return res.status(404).send("Beneficiary not found");
    }

    let query = { beneficiary_id };

    // OPTIONAL SEARCH FILTER
    if (search) {
      query.$or = [
        { transfer_id: search },
        { reference: new RegExp(search, "i") },
      ];
    }

    const transfers = await Transfer.find(query).sort({
      createdAt: -1,
    });

    res.render("transfer", {
      beneficiary_id,
      transfers,
      beneficiary,
      search: search || "",
    });

  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading transfers");
  }
});


router.post("/transfer/create", async (req, res) => {
  let savedTransfer;

  try {
    const token = await getAccessToken();

    const payload = {
      beneficiary_id: req.body.beneficiary_id,

      transfer_amount: Number(req.body.transfer_amount),

      transfer_currency: req.body.transfer_currency,

      transfer_method: req.body.transfer_method,

      reason: req.body.reason,

      reference: `TRF-${Date.now()}`,

      request_id: `REQ-${Date.now()}`,

      source_currency: req.body.source_currency,

      source_amount: null,

      swift_charge_option: req.body.swift_charge_option,
    };

    const response = await axios.post(
      `${BASE_URL}/api/v1/transfers/create`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ SUCCESS:");
    console.log(JSON.stringify(response.data, null, 2));

    // ✅ SAVE SUCCESS TRANSFER
    savedTransfer = await Transfer.create({
      transfer_id: response.data.id || "",

      beneficiary_id: payload.beneficiary_id,

      transfer_amount: payload.transfer_amount,
      transfer_currency: payload.transfer_currency,
      transfer_method: payload.transfer_method,

      reason: payload.reason,
      reference: payload.reference,
      request_id: payload.request_id,

      source_currency: payload.source_currency,
      source_amount: payload.source_amount,

      swift_charge_option: payload.swift_charge_option,

      status: "SUCCESS",

      airwallex_response: response.data,
    });

    return res.send(`
      <h2>✅ Transfer Created Successfully</h2>
      <pre>${JSON.stringify(response.data, null, 2)}</pre>
      <a href="/transfers">View All Transfers</a>
    `);

  } catch (err) {
    console.error("❌ ERROR:");
    console.error(JSON.stringify(err.response?.data || err.message, null, 2));

    // ❗ SAVE FAILED TRANSFER TOO (IMPORTANT)
    try {
      savedTransfer = await Transfer.create({
        transfer_id: "",

        beneficiary_id: req.body.beneficiary_id || "",

        transfer_amount: Number(req.body.transfer_amount || 0),
        transfer_currency: req.body.transfer_currency || "",
        transfer_method: req.body.transfer_method || "",

        reason: req.body.reason || "",
        reference: `FAILED-${Date.now()}`,
        request_id: `FAILED-${Date.now()}`,

        source_currency: req.body.source_currency || "",
        source_amount: null,

        swift_charge_option: req.body.swift_charge_option || "SHARED",

        status: "FAILED",

        airwallex_response: err.response?.data || err.message,
      });
    } catch (dbErr) {
      console.log("Mongo save error:", dbErr.message);
    }

    return res.status(500).send(`
      <h2>❌ Transfer Failed</h2>
      <pre>${JSON.stringify(err.response?.data || err.message, null, 2)}</pre>
      <a href="/">Go Back</a>
    `);
  }
});


// Cancel transfer (Airwallex + MongoDB)

router.post("/transfer/cancel/:id", async (req, res) => {
  try {
    const transfer = await Transfer.findById(req.params.id);

    if (!transfer) {
      return res.status(404).send("Transfer not found");
    }

    // Airwallex cancel
    const token = await getAccessToken();

    try {
      await axios.post(
        `${BASE_URL}/api/v1/transfers/${transfer.transfer_id}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (err) {
      console.log("Airwallex cancel failed:", err.response?.data || err.message);
    }

    // Update MongoDB
    transfer.status = "CANCELLED";
    await transfer.save();

    res.redirect(`/transfer/page/${transfer.beneficiary_id}`);

  } catch (err) {
    console.log(err);
    res.status(500).send("Cancel failed");
  }
});


// Resend transfer (Airwallex + MongoDB)

router.post("/transfer/resend/:id", async (req, res) => {
  try {
    const old = await Transfer.findById(req.params.id);

    if (!old) {
      return res.status(404).send("Transfer not found");
    }

    const token = await getAccessToken();

    const payload = {
      beneficiary_id: old.beneficiary_id,
      transfer_amount: old.transfer_amount,
      transfer_currency: old.transfer_currency,
      transfer_method: old.transfer_method,
      reason: old.reason,
      reference: `RESEND_${Date.now()}`,
      request_id: `req_${Date.now()}`,
      source_currency: old.source_currency,
      source_amount: null,
      swift_charge_option: old.swift_charge_option,
    };

    const response = await axios.post(
      `${BASE_URL}/api/v1/transfers/create`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Save new transfer
    const newTransfer = new Transfer({
      transfer_id: response.data.id,
      ...payload,
      status: response.data.status || "PENDING",
      airwallex_response: response.data,
    });

    await newTransfer.save();

    res.redirect(`/transfer/page/${old.beneficiary_id}`);

  } catch (err) {
    console.log("Resend error:", err.response?.data || err.message);
    res.status(500).send("Resend failed");
  }
});




module.exports = router;