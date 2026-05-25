const express = require("express");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");
const session = require("express-session");
const { BASE_URL, getAccessToken } = require("./utils/airwallex");
const Beneficiary = require("./models/Beneficiary");
const User = require("./models/User");
const Transfer = require("./models/Transfer");
require("dotenv").config();


const app = express();
const PORT = process.env.PORT;


app.use(session({
  secret: "secret",
  resave: false,
  saveUninitialized: false
}));


/*
// AUTH MIDDLEWARE
function authCheck(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}
*/  

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


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

// Auth Import
const auth = require("./middleware/auth");
app.use("/", require("./routes/auth")); // login, register, forgot, reset

const beneficiaryRoutes = require("./routes/create.beneficiary");
const deleteUpdateRoutes = require("./routes/DeleteUpdate.beneficiary");
const transferRoutes = require("./routes/Transfer.beneficiary");
const databaseRoutes = require("./routes/Database");
const userRoutes = require("./routes/user");
const authRoutes = require("./routes/auth");


// Protect Routes
app.use("/", auth, require("./routes/create.beneficiary"));
app.use("/", auth, require("./routes/DeleteUpdate.beneficiary"));
app.use("/", auth, require("./routes/Transfer.beneficiary"));
app.use("/", auth, require("./routes/Database"));



// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});