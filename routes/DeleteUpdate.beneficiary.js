const express = require("express");
const axios = require("axios");
const Beneficiary = require("../models/Beneficiary");
const { BASE_URL, getAccessToken } = require("../utils/airwallex");

const router = express.Router();

router.post("/beneficiary/delete/:id", async (req, res) => {
  let mongoRecord;

  try {
    // STEP 1: Find Mongo record
    mongoRecord = await Beneficiary.findById(req.params.id);

    if (!mongoRecord) {
      return res.status(404).send("Not found");
    }

    // STEP 2: Get Airwallex token (IMPORTANT)
    const token = await getAccessToken();

    // STEP 3: Delete from Airwallex first
    if (mongoRecord.beneficiary_id) {
      try {
        const deleteUrl = `${BASE_URL}/api/v1/beneficiaries/${mongoRecord.beneficiary_id}/delete`;

        const response = await axios.post(
          deleteUrl,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Airwallex deleted:", response.data);
      } catch (airwallexErr) {
        console.log(
          "Airwallex delete failed (ignored):",
          airwallexErr.response?.data || airwallexErr.message
        );
      }
    }

    // STEP 4: Always delete from MongoDB
    await Beneficiary.findByIdAndDelete(req.params.id);

    console.log("MongoDB deleted");

    return res.redirect("/");

  } catch (error) {
    console.log("Delete error:", error.response?.data || error.message);
    return res.status(500).send("Delete failed");
  }
});


// Update beneficiary (Airwallex + MongoDB)

router.post("/beneficiary/update/:id", async (req, res) => {
  try {
    // STEP 1: Find Mongo record
    const record = await Beneficiary.findById(req.params.id);

    if (!record) {
      return res.status(404).send("Beneficiary not found");
    }

    // STEP 2: Get Airwallex token
    const token = await getAccessToken();

    // STEP 3: Build updated payload
    const payload = {
      beneficiary: {
        address: {
          city: req.body.address.city,
          country_code: req.body.address.country_code,
          postcode: req.body.address.postcode,
          state: req.body.address.state,
          street_address: req.body.address.street_address,
        },

        bank_details: {
          account_currency: req.body.bank_details.account_currency,
          account_name: req.body.bank_details.account_name,
          account_number: req.body.bank_details.account_number,
          bank_country_code: req.body.bank_details.bank_country_code,
          bank_name: req.body.bank_details.bank_name,
          swift_code: req.body.bank_details.swift_code,
        },

        company_name: req.body.company_name,
        entity_type: req.body.entity_type,
        type: req.body.type,
      },

      transfer_methods: Array.isArray(req.body.transfer_methods)
        ? req.body.transfer_methods
        : [req.body.transfer_methods],
    };

    // STEP 4: Update on Airwallex (if supported)
    try {
      const airwallexRes = await axios.post(
        `${BASE_URL}/api/v1/beneficiaries/${record.beneficiary_id}/update`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      record.airwallex_response = airwallexRes.data;
    } catch (airErr) {
      console.log(
        "Airwallex update failed:",
        airErr.response?.data || airErr.message
      );
    }

    // STEP 5: Update MongoDB
    record.beneficiary = payload.beneficiary;
    record.transfer_methods = payload.transfer_methods;

    await record.save();

    return res.json({
      message: "Beneficiary updated",
      data: record,
    });

  } catch (err) {
    console.log("Update error:", err.message);
    return res.status(500).send("Update failed");
  }
});


module.exports = router;