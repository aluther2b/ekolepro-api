// src/controllers/payments.controller.js
import { PAYMENT_CONFIG } from "../config/payments.config.js";
import { createPayment } from "../services/payments.service.js";
import { createPaydunyaInvoice } from "../services/paydunya.service.js";

/* =====================================================
   INITIALISATION PAIEMENT
===================================================== */
export async function initPayment(req, res) {
  try {
    const ecoleId = req.ecoleId || req.user?.ecole_id;

    console.log("📊 [initPayment] Données:", {
      ecoleId,
      userId: req.user?.id,
      userLogin: req.user?.login
    });

    if (!ecoleId) {
      return res.status(400).json({
        success: false,
        message: "École non identifiée",
      });
    }

    const amount = PAYMENT_CONFIG.AMOUNT_YEARLY;
    const callbackUrl = process.env.PAYDUNYA_CALLBACK_URL || PAYMENT_CONFIG.PAYDUNYA.CALLBACK_URL;

    console.log("💰 [initPayment] Configuration:", {
      amount,
      callbackUrl,
      baseUrl: process.env.PAYDUNYA_BASE_URL
    });

    // 1️⃣ Création du paiement en base
    const payment = await createPayment({
      ecole_id: ecoleId,
      amount,
      phone: null,
      duration_days: PAYMENT_CONFIG.DURATION_YEARLY,
    });

    console.log("✅ [initPayment] Paiement créé:", payment.id, payment.transaction_ref);

    // 2️⃣ Création de la facture PayDunya
    let invoice;
    try {
      invoice = await createPaydunyaInvoice({
        amount,
        reference: payment.transaction_ref,
        callback_url: callbackUrl,
      });
    } catch (paydunyaError) {
      console.error("❌ [initPayment] Erreur PayDunya:", paydunyaError.message);
      
      // Mettre à jour le paiement comme échoué
      await supabaseService
        .from("payments")
        .update({ statut: "failed", validated_at: new Date().toISOString() })
        .eq("id", payment.id);
      
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la création de la facture: " + paydunyaError.message,
      });
    }

    if (!invoice?.payment_url) {
      return res.status(500).json({
        success: false,
        message: "Lien de paiement invalide",
      });
    }

    console.log("🔗 [initPayment] Payment URL:", invoice.payment_url);

    // 3️⃣ Réponse au mobile
    return res.json({
      success: true,
      payment_id: payment.id,
      reference: payment.transaction_ref,
      payment_url: invoice.payment_url,
      status: "pending",
    });

  } catch (err) {
    console.error("❌ [initPayment] Erreur générale:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur initialisation paiement: " + err.message,
    });
  }
}