const mongoose = require("mongoose");

const TransferSchema = new mongoose.Schema(
  {
    transfer_id: {
      type: String,
      default: "",
    },

    beneficiary_id: {
      type: String,
      required: true,
    },

    transfer_amount: {
      type: Number,
      required: true,
    },

    transfer_currency: {
      type: String,
      required: true,
    },

    transfer_method: {
      type: String,
      required: true,
    },

    reason: {
      type: String,
      default: "",
    },

    reference: {
      type: String,
      default: "",
    },

    request_id: {
      type: String,
      default: "",
    },

    source_currency: {
      type: String,
      default: "",
    },

    source_amount: {
      type: Number,
      default: null,
    },

    swift_charge_option: {
      type: String,
      default: "SHARED",
    },

    status: {
      type: String,
      default: "PENDING",
    },

    airwallex_response: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Transfer", TransferSchema);