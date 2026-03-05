// src/controllers/payments.controller.js
import { PAYMENT_CONFIG } from "../config/payments.config.js";
import { createPayment } from "../services/payments.service.js";
import { createPaydunyaInvoice } from "../services/paydunya.service.js";

/* =====================================================
   INITIALISATION PAIEMENT
===================================================== */
export async function initPayment(req, res) {
  try {
    const ecoleId = req.ecoleId; // injecté par requireAuth

    if (!ecoleId) {
      return res.status(400).json({
        success: false,
        message: "École non identifiée",
      });
    }

    const amount = PAYMENT_CONFIG.AMOUNT_YEARLY;

    // 1️⃣ Création du paiement en base (sans operator)
    const payment = await createPayment({
      ecole_id: ecoleId,
      amount,
      phone: null,
      duration_days: PAYMENT_CONFIG.DURATION_YEARLY,
    });

    // 2️⃣ Création de la facture PayDunya
    const invoice = await createPaydunyaInvoice({
      amount,
      reference: payment.transaction_ref,
      callback_url: process.env.PAYDUNYA_CALLBACK_URL,
    });

    if (!invoice?.payment_url) {
      throw new Error("Lien PayDunya invalide");
    }

    // 3️⃣ Réponse au mobile
    return res.json({
      success: true,
      payment_id: payment.id,
      reference: payment.transaction_ref,
      payment_url: invoice.payment_url,
      status: "pending",
    });

  } catch (err) {
    console.error("❌ initPayment error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur initialisation paiement",
    });
  }
}
