// src/controllers/payments.controller.js
import { PAYMENT_CONFIG } from "../config/payments.config.js";
import { createPayment } from "../services/payments.service.js";
import { createPaydunyaInvoice } from "../services/paydunya.service.js";

/* =====================================================
   INITIALISATION PAIEMENT
===================================================== */
export async function initPayment(req, res) {
  try {
    // ✅ Récupérer ecoleId depuis plusieurs sources
    const ecoleId = req.ecoleId || req.user?.ecole_id || req.body?.ecole_id;
    
    // ✅ LOGS DÉTAILLÉS POUR DÉBOGUER
    console.log("📊 [initPayment] Données reçues:", {
      ecoleId: ecoleId,
      userId: req.user?.id,
      userLogin: req.user?.login,
      userRole: req.user?.role,
      hasUser: !!req.user
    });

    if (!ecoleId) {
      console.error("❌ [initPayment] ecoleId manquant");
      console.error("📋 req.user:", JSON.stringify(req.user, null, 2));
      
      return res.status(400).json({
        success: false,
        message: "Votre compte n'est pas associé à une école. Contactez l'administrateur.",
        details: "ecole_id manquant"
      });
    }

    const amount = PAYMENT_CONFIG.AMOUNT_YEARLY;
    console.log(`💰 Montant: ${amount} FCFA`);

    // 1️⃣ Création du paiement en base
    let payment;
    try {
      payment = await createPayment({
        ecole_id: ecoleId,
        amount,
        phone: null,
        duration_days: PAYMENT_CONFIG.DURATION_YEARLY,
      });
      console.log("✅ Paiement créé:", payment.id, payment.transaction_ref);
    } catch (paymentError) {
      console.error("❌ Erreur création paiement:", paymentError);
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la création du paiement",
      });
    }

    // 2️⃣ Création de la facture PayDunya
    const callbackUrl = process.env.PAYDUNYA_CALLBACK_URL || PAYMENT_CONFIG.PAYDUNYA.CALLBACK_URL;
    console.log("📡 Callback URL:", callbackUrl);

    let invoice;
    try {
      invoice = await createPaydunyaInvoice({
        amount,
        reference: payment.transaction_ref,
        callback_url: callbackUrl,
      });
      console.log("✅ Facture PayDunya créée");
    } catch (invoiceError) {
      console.error("❌ Erreur création facture PayDunya:", invoiceError);
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la création de la facture PayDunya",
      });
    }

    if (!invoice?.payment_url) {
      console.error("❌ payment_url manquant dans la réponse PayDunya");
      return res.status(500).json({
        success: false,
        message: "Lien de paiement invalide",
      });
    }

    console.log("🔗 Payment URL:", invoice.payment_url);

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
      message: "Erreur initialisation paiement: " + (err.message || "Erreur inconnue"),
    });
  }
}