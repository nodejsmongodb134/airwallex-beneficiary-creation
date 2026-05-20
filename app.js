const express = require("express");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");
const Beneficiary = require("./models/Beneficiary");
const Transfer = require("./models/Transfer");

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



// ==========================================
// TRANSFER STATUS SYNC
// ==========================================
async function syncTransferStatus(transferId, mongoId) {

  const token = await getAccessToken();

  const res = await axios.get(
    `${BASE_URL}/api/v1/transfers/${transferId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const status = res.data.status;

  await Transfer.findByIdAndUpdate(mongoId, {
    status,
    airwallex_response: res.data,
  });

  return status;
}





// GET → render form + beneficiaries
app.get("/", async (req, res) => {

  try {

    const beneficiaries =
      await Beneficiary.find().sort({
        createdAt: -1,
      });

    res.render("index", {
      beneficiaries,
    });

  } catch (error) {

    console.log(error);

    res.render("index", {
      beneficiaries: [],
    });
  }
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

// Delete beneficiary (Airwallex + MongoDB)

app.post("/beneficiary/delete/:id", async (req, res) => {
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

app.post("/beneficiary/update/:id", async (req, res) => {
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


//get transfer page with beneficiary details
/*
app.get("/transfer/page/:beneficiary_id", async (req, res) => {
  const beneficiary_id = req.params.beneficiary_id;

  const beneficiaries = await Beneficiary.find();

  res.render("transfer", {
    beneficiary_id,
    beneficiaries,
  });
});
*/

app.get("/transfer/page/:beneficiary_id", async (req, res) => {
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

// POST → create transfer on Airwallex + save to MongoDB
/*
const Transfer = require("./models/Transfer");
const Beneficiary = require("./models/Beneficiary");
*/

app.post("/transfer/create", async (req, res) => {
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

app.post("/transfer/cancel/:id", async (req, res) => {
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

app.post("/transfer/resend/:id", async (req, res) => {
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



// ==========================================
// AUTO SYNC LOOP (NODEMON SAFE + PRODUCTION SAFE)
// ==========================================

if (!global.__SYNC_LOOP_STARTED__) {
  global.__SYNC_LOOP_STARTED__ = true;

  let isRunning = false;

  setInterval(async () => {
    if (isRunning) return; // prevents overlap if slow API calls
    isRunning = true;

    console.log("🔄 Syncing transfers with Airwallex...");

    try {
      const transfers = await Transfer.find({
        status: { $in: ["PENDING", "PROCESSING"] }
      });

      if (!transfers.length) {
        isRunning = false;
        return;
      }

      const token = await getAccessToken();

      for (const t of transfers) {
        if (!t.transfer_id) continue;

        try {
          const res = await axios.get(
            `${BASE_URL}/api/v1/transfers/${t.transfer_id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          const newStatus = res.data.status;

          if (t.status !== newStatus) {
            t.status = newStatus;
            t.airwallex_response = res.data;
            await t.save();

            console.log(`✅ Updated ${t.transfer_id} → ${newStatus}`);
          }

        } catch (err) {
          console.log("Sync error:", err.message);
        }
      }

    } catch (err) {
      console.log("Polling loop error:", err.message);
    }

    isRunning = false;

  }, 120000);
}


// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});