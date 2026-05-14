const express = require("express");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");

const Beneficiary = require("./models/Beneficiary");

const app = express();
const PORT = 3000;

// MongoDB Connection
mongoose
  .connect("mongodb://127.0.0.1:27017/airwallex-create")
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => {
    console.log("MongoDB Error:", err);
  });


// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Airwallex Config
const BASE_URL = "https://api-demo.airwallex.com";

// ✅ Correct plaintext credentials
const AIRWALLEX_API_KEY = "9be5b8f444cb76510061feaf371d7621ccaaf75da67fdc02ea0b7b6aeb6d54b87e94082fea624ad56f12cf16dcd51532";
const AIRWALLEX_CLIENT_ID ="arr-_yFsSaKZS6-zfxjiUw";

// 👉 Get Airwallex token
async function getAccessToken() {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/v1/authentication/login`,
      {},
      {
        headers: {
          "x-api-key": AIRWALLEX_API_KEY,
          "x-client-id": AIRWALLEX_CLIENT_ID,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      }
    );

    console.log("AUTH STATUS:", response.status);
    console.log("AUTH RESPONSE:", response.data);

    if (!response.data?.token) {
      throw new Error("No token returned from Airwallex");
    }

    return response.data.token;
  } catch (err) {
    console.error(
      "LOGIN ERROR:",
      err.response?.data || err.message
    );
    throw err;
  }
}

// GET → render form
app.get("/", (req, res) => {
  res.render("index");
});

// POST → create beneficiary on Airwallex
app.post("/beneficiary/create", async (req, res) => {
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


// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});