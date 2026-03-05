// =====================================================
// 📄 src/config/payments.config.js
// Configuration centrale des paiements EcolePro
// =====================================================

const isProduction = process.env.NODE_ENV === "production";

export const PAYMENT_CONFIG = {
  /* =====================================================
     💰 TARIFICATION
  ===================================================== */
  AMOUNT_YEARLY: Number(process.env.AMOUNT_YEARLY) || 25000, // FCFA
  DURATION_YEARLY: 365,
  CURRENCY: "XOF",

  /* =====================================================
     🏪 CODES MARCHANDS (NE PAS METTRE EN DUR EN PROD)
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
     🔁 CALLBACK URLS
     ⚠️ En prod → doivent être définis dans .env
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
        : "http://localhost:5000/api/callbacks/wave"),
  },

  /* =====================================================
     🔐 API KEYS (OBLIGATOIRE EN PROD)
  ===================================================== */
  API_KEYS: {
    MTN: process.env.MTN_API_KEY || null,
    ORANGE: process.env.ORANGE_API_KEY || null,
    WAVE: process.env.WAVE_API_KEY || null,
  },

  /* =====================================================
     💳 PAYDUNYA (RECOMMANDÉ)
  ===================================================== */
  PAYDUNYA: {
    MASTER_KEY: process.env.PAYDUNYA_MASTER_KEY || null,
    PRIVATE_KEY: process.env.PAYDUNYA_PRIVATE_KEY || null,
    PUBLIC_KEY: process.env.PAYDUNYA_PUBLIC_KEY || null,
    TOKEN: process.env.PAYDUNYA_TOKEN || null,

    MODE: process.env.PAYDUNYA_MODE || "test", // test | live

    CALLBACK_URL:
      process.env.PAYDUNYA_CALLBACK_URL ||
      (isProduction
        ? null
        : "https://ekolepro-api.onrender.com/api/callbacks/paydunya"),
  },
};