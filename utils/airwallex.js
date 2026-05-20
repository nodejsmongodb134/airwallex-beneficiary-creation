const axios = require("axios");
require("dotenv").config();

// Load env vars correctly
const BASE_URL = process.env.BASE_URL;
const AIRWALLEX_API_KEY = process.env.AIRWALLEX_API_KEY;
const AIRWALLEX_CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID;

// Safety check (VERY useful for debugging)
if (!BASE_URL || !AIRWALLEX_API_KEY || !AIRWALLEX_CLIENT_ID) {
  console.log("❌ Missing Airwallex env variables");
  console.log({
    BASE_URL,
    AIRWALLEX_API_KEY: !!AIRWALLEX_API_KEY,
    AIRWALLEX_CLIENT_ID: !!AIRWALLEX_CLIENT_ID,
  });
}

// Get Airwallex token
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
      }
    );

    if (!response.data?.token) {
      throw new Error("No token returned from Airwallex");
    }

    return response.data.token;
  } catch (err) {
    console.log("LOGIN ERROR:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  BASE_URL,
  getAccessToken,
};