const mongoose = require("mongoose");

const BeneficiarySchema = new mongoose.Schema(
  {
    beneficiary_id: {
      type: String,
      default: "",
    },

    beneficiary: {
      address: {
        city: {
          type: String,
          default: "",
        },

        country_code: {
          type: String,
          default: "",
        },

        postcode: {
          type: String,
          default: "",
        },

        state: {
          type: String,
          default: "",
        },

        street_address: {
          type: String,
          default: "",
        },
      },

      bank_details: {
        account_currency: {
          type: String,
          default: "",
        },

        account_name: {
          type: String,
          default: "",
        },

        account_number: {
          type: String,
          default: "",
        },

        bank_country_code: {
          type: String,
          default: "",
        },

        bank_name: {
          type: String,
          default: "",
        },

        swift_code: {
          type: String,
          default: "",
        },
      },

      company_name: {
        type: String,
        default: "",
      },

      entity_type: {
        type: String,
        default: "",
      },

      type: {
        type: String,
        default: "",
      },
    },

    transfer_methods: [
      {
        type: String,
      },
    ],

    airwallex_response: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Beneficiary",
  BeneficiarySchema
);