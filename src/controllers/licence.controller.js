// src/controllers/licence.controller.js
import { getLicenceByEcole, isLicenceValid } from "../services/licence.service.js";
import { getDevice, registerDevice, countDevices } from "../services/devices.service.js";
import { supabaseService } from "../config/supabase.js";

export async function checkLicence(req, res) {
  try {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    const device_id = req.headers["device-id"];
    const user = req.user;

    console.log(`🔍 checkLicence - device_id: ${device_id}, user: ${user?.id}`);

    if (!device_id) {
      console.warn("⚠️ device_id manquant");
      return res.status(400).json({ statut: "device_required" });
    }

    if (!user || !user.ecole_id) {
      console.warn("⚠️ Utilisateur sans école");
      return res.status(403).json({ statut: "user_not_found" });
    }

    const ecole_id = user.ecole_id;
    console.log(`🏫 École ID: ${ecole_id}`);

    // Récupérer la licence
    const { data: licence, error: licenceError } = await getLicenceByEcole(ecole_id);

    if (licenceError) {
      console.error("❌ Erreur getLicenceByEcole:", licenceError);
      return res.status(500).json({ statut: "unknown" });
    }

    if (!licence) {
      console.log("⚠️ Aucune licence trouvée pour l'école");
      return res.json({ statut: "expired" });
    }

    console.log("📄 Licence trouvée:", { statut: licence.statut, date_fin: licence.date_fin });

    if (licence.statut === "suspended") {
      return res.json({ statut: "suspended" });
    }

    if (!isLicenceValid(licence)) {
      console.log("⚠️ Licence invalide (expirée ou statut non actif)");
      
      // Mettre à jour le statut si expirée
      if (licence.date_fin && new Date(licence.date_fin) < new Date()) {
        await supabaseService
          .from("licences")
          .update({ statut: "expired", updated_at: new Date().toISOString() })
          .eq("id", licence.id);
      }
      
      return res.json({ statut: "expired", date_fin: licence.date_fin });
    }

    // Gestion du device
    const { data: device, error: deviceError } = await getDevice(device_id);

    if (deviceError) {
      console.error("❌ Erreur getDevice:", deviceError);
      // Ne pas bloquer, continuer
    }

    if (device) {
      console.log("📱 Device déjà enregistré:", device.device_id);
      
      // ✅ CORRECTION : utiliser 'statut' pour vérifier si bloqué
      if (device.statut === "bloque") {
        return res.json({ statut: "device_blocked" });
      }

      // Mettre à jour last_seen
      await supabaseService
        .from("devices")
        .update({ last_seen: new Date().toISOString() })
        .eq("device_id", device_id);

      return res.json({
        statut: "active",
        date_fin: licence.date_fin,
        licence_key: licence.cle  // ✅ Pour la synchronisation locale
      });
    }

    // Nouveau device → vérifier la limite
    console.log("📱 Nouveau device, vérification limite");
    
    const { count, error: countError } = await countDevices(ecole_id);

    if (countError) {
      console.error("❌ Erreur countDevices:", countError);
      // Si erreur, on autorise quand même pour ne pas bloquer l'utilisateur
    }

    const currentCount = count || 0;
    const maxDevices = licence.max_devices || 10;
    
    console.log(`📊 Devices actuels: ${currentCount}/${maxDevices}`);

    if (currentCount >= maxDevices) {
      console.warn("⚠️ Limite de devices atteinte");
      return res.json({ 
        statut: "device_blocked",
        message: `Limite de ${maxDevices} appareils atteinte`
      });
    }

    // Enregistrer le nouveau device
    const { error: registerError } = await registerDevice(ecole_id, user.id, device_id);

    if (registerError) {
      console.error("❌ Erreur registerDevice:", registerError);
      
      if (registerError === "device_limit_reached") {
        return res.json({ statut: "device_blocked" });
      }
      // Ne pas bloquer l'utilisateur pour d'autres erreurs
    } else {
      console.log("✅ Nouveau device enregistré avec succès");
    }

    return res.json({
      statut: "active",
      date_fin: licence.date_fin,
      licence_key: licence.cle  // ✅ Pour la synchronisation locale
    });

  } catch (err) {
    console.error("❌ checkLicence error:", err);
    return res.status(500).json({ statut: "unknown", message: err.message });
  }
}