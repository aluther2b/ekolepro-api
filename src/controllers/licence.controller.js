// src/controllers/licence.controller.js
import { getLicenceByEcole, isLicenceValid } from "../services/licence.service.js";
import { getDevice, registerDevice, countDevices } from "../services/devices.service.js";
import { supabaseService } from "../config/supabase.js";

/**
 * Vérifie la validité de la licence pour l'école de l'utilisateur connecté
 * et gère l'enregistrement du device.
 * Route : GET /api/licence/check
 * Headers requis : Authorization: Bearer <token>, device-id: <id>
 */
export async function checkLicence(req, res) {
  try {
    // 🔥 Désactiver le cache HTTP pour cette route
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    const device_id = req.headers["device-id"];
    const user = req.user; // utilisateur injecté par requireAuth (depuis la table utilisateurs)

    console.log(`🔍 checkLicence - device_id: ${device_id}, user: ${user?.id}`);

    // 1️⃣ Vérification du device ID
    if (!device_id) {
      console.warn("⚠️ device_id manquant");
      return res.status(400).json({ statut: "device_required" });
    }

    // 2️⃣ Vérifier que l'utilisateur est bien associé à une école
    if (!user || !user.ecole_id) {
      console.warn("⚠️ Utilisateur sans école");
      return res.status(403).json({ statut: "user_not_found" });
    }

    const ecole_id = user.ecole_id;
    console.log(`🏫 École ID: ${ecole_id}`);

    // 3️⃣ Récupérer la licence de l'école
    const { data: licence, error: licenceError } = await getLicenceByEcole(ecole_id);

    if (licenceError && licenceError.code !== 'PGRST116') {
      console.error("❌ Erreur getLicenceByEcole:", licenceError);
      return res.status(500).json({ statut: "unknown" });
    }

    if (!licence) {
      console.log("⚠️ Aucune licence trouvée pour l'école");
      return res.json({ statut: "expired" });
    }

    console.log("📄 Licence trouvée:", { statut: licence.statut, date_fin: licence.date_fin });

    // 4️⃣ Vérifier le statut de la licence
    if (licence.statut === "suspended") {
      return res.json({ statut: "suspended" });
    }

    if (!isLicenceValid(licence)) {
      console.log("⚠️ Licence invalide (expirée ou statut non actif)");
      return res.json({ statut: "expired" });
    }

    // 5️⃣ Gestion du device
    const { data: device, error: deviceError } = await getDevice(device_id);

    if (deviceError) {
      console.error("❌ Erreur getDevice:", deviceError);
      return res.status(500).json({ statut: "unknown" });
    }

    if (device) {
      console.log("📱 Device déjà enregistré:", device.device_id);
      if (device.blocked) {
        return res.json({ statut: "device_blocked" });
      }

      // Mettre à jour la dernière connexion
      await supabaseService
        .from("devices")
        .update({ last_seen: new Date().toISOString() })
        .eq("device_id", device_id);

      return res.json({
        statut: "active",
        date_fin: licence.date_fin,
      });
    }

    // Nouveau device → vérifier la limite
    console.log("📱 Nouveau device, vérification limite");
    const { count, error: countError } = await countDevices(ecole_id);

    if (countError) {
      console.error("❌ Erreur countDevices:", countError);
      return res.status(500).json({ statut: "unknown" });
    }

    if (count >= licence.max_devices) {
      console.warn("⚠️ Limite de devices atteinte");
      return res.json({ statut: "device_blocked" });
    }

    // Enregistrer le nouveau device
    const { error: registerError } = await registerDevice(ecole_id, user.id, device_id);

    if (registerError) {
      console.error("❌ Erreur registerDevice:", registerError);
      return res.status(500).json({ statut: "unknown" });
    }

    console.log("✅ Nouveau device enregistré avec succès");
    return res.json({
      statut: "active",
      date_fin: licence.date_fin,
    });

  } catch (err) {
    console.error("❌ checkLicence error:", err);
    return res.status(500).json({ statut: "unknown", message: err.message });
  }
}
