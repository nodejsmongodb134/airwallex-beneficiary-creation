const express = require("express");
const axios = require("axios");
const Beneficiary = require("../models/Beneficiary");
const { BASE_URL, getAccessToken } = require("../utils/airwallex");

const router = express.Router();


// GET → render form + beneficiaries
router.get("/", async (req, res) => {
  try {
    const beneficiaries = await Beneficiary.find().sort({
      createdAt: -1,
    });

    res.render("index", {
      beneficiaries,
      user: req.session.user, // 👈 ADD THIS
    });

  } catch (error) {
    console.log(error);

    res.render("index", {
      beneficiaries: [],
      user: req.session.user,
    });
  }
});

// POST → create beneficiary on Airwallex
router.post("/beneficiary/create", async (req, res) => {
  try {
    const token = await getAccessToken();

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
          account_currency:
            req.body.bank_details.account_currency,
          account_name:
            req.body.bank_details.account_name,
          account_number:
            req.body.bank_details.account_number,
          bank_country_code:
            req.body.bank_details.bank_country_code,
          bank_name:
            req.body.bank_details.bank_name,
          swift_code:
            req.body.bank_details.swift_code,
        },

        company_name: req.body.company_name,
        entity_type: req.body.entity_type,
        type: req.body.type,
      },

      transfer_methods: Array.isArray(
        req.body.transfer_methods
      )
        ? req.body.transfer_methods
        : [req.body.transfer_methods],
    };

    // Create beneficiary on Airwallex
    const response = await axios.post(
      `${BASE_URL}/api/v1/beneficiaries/create`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Save to MongoDB
    const beneficiary = new Beneficiary({
      beneficiary_id: response.data.id || "",

      beneficiary: payload.beneficiary,

      transfer_methods: payload.transfer_methods,

      airwallex_response: response.data,
    });

    await beneficiary.save();

    console.log("Beneficiary saved to MongoDB");

    res.send(`
      <h2>✅ Beneficiary Created & Saved</h2>

      <pre>${JSON.stringify(response.data, null, 2)}</pre>

      <a href="/">Go Back</a>
    `);

  } catch (error) {
    console.error(
      "Airwallex Error:",
      error.response?.data || error.message
    );

    res.status(500).send(`
      <h2>❌ Failed to Create Beneficiary</h2>

      <pre>${JSON.stringify(
        error.response?.data || error.message,
        null,
        2
      )}</pre>

      <a href="/">Go Back</a>
    `);
  }
});


module.exports = router;