// src/config/payments.config.js
// Configuration centrale des paiements EcolePro

const isProduction = process.env.NODE_ENV === "production";

export const PAYMENT_CONFIG = {
  /* =====================================================
     💰 TARIFICATION
  ===================================================== */
  AMOUNT_YEARLY: Number(process.env.AMOUNT_YEARLY) || 25000, // FCFA
  DURATION_YEARLY: 365,
  CURRENCY: "XOF",

  /* =====================================================
     🏪 CODES MARCHANDS
  ===================================================== */
  MERCHANT_CODES: {
    MTN: process.env.MTN_MERCHANT_CODE || null,
    ORANGE: process.env.ORANGE_MERCHANT_CODE || null,
    WAVE: process.env.WAVE_MERCHANT_CODE || null,
  },

  /* =====================================================
     📡 OPERATEURS AUTORISÉS
  ===================================================== */
  OPERATORS: ["MTN", "ORANGE", "WAVE"],

  /* =====================================================
     🌊 WAVE CI - LIENS DE PAIEMENT DIRECTS
  ===================================================== */
  WAVE_CI: {
    PAYMENT_URL: process.env.WAVE_CI_PAYMENT_URL || 
      "https://pay.wave.com/m/M_ci_crF18ru0EB0K/c/ci/?amount=50",
    MERCHANT_ID: process.env.WAVE_CI_MERCHANT_ID || "M_ci_crF18ru0EB0K",
    SUPPORT_WHATSAPP: process.env.WAVE_CI_SUPPORT_WHATSAPP || "2250700000000",
  },

  /* =====================================================
     🔁 CALLBACK URLS
  ===================================================== */
  CALLBACK_URLS: {
    MTN:
      process.env.MTN_CALLBACK_URL ||
      (isProduction
        ? null
        : "http://localhost:5000/api/callbacks/mtn"),

    ORANGE:
      process.env.ORANGE_CALLBACK_URL ||
      (isProduction
        ? null
        : "http://localhost:5000/api/callbacks/orange"),

    WAVE:
      process.env.WAVE_CALLBACK_URL ||
      (isProduction
        ? null
        : "https://ekolepro-api.onrender.com/api/callbacks/wave"),
  },

  /* =====================================================
     🔐 API KEYS
  ===================================================== */
  API_KEYS: {
    MTN: process.env.MTN_API_KEY || null,
    ORANGE: process.env.ORANGE_API_KEY || null,
    WAVE: process.env.WAVE_API_KEY || null,
  },

  /* =====================================================
     💳 PAYDUNYA
  ===================================================== */
  PAYDUNYA: {
    MASTER_KEY: process.env.PAYDUNYA_MASTER_KEY || null,
    PRIVATE_KEY: process.env.PAYDUNYA_PRIVATE_KEY || null,
    PUBLIC_KEY: process.env.PAYDUNYA_PUBLIC_KEY || null,
    TOKEN: process.env.PAYDUNYA_TOKEN || null,

    MODE: process.env.PAYDUNYA_MODE || "test",

    CALLBACK_URL:
      process.env.PAYDUNYA_CALLBACK_URL ||
      (isProduction
        ? null
        : "https://ekolepro-api.onrender.com/api/callbacks/paydunya"),
  },
};