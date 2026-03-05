//backend/src/libs/licence.js
import fs from "fs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

export function loadPrivateKey() { return fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8"); }
export function loadPublicKey() { return fs.readFileSync(process.env.PUBLIC_KEY_PATH, "utf8"); }

export function generateHumanKey() {
  const part = () => crypto.randomBytes(3).toString("hex").toUpperCase().slice(0,4);
  return `EKOLE-${part()}-${part()}-${part()}`;
}

export function issueLicenceJWT({ licenceKey, schoolId, maxDevices = 0, days }) {
  const privateKey = loadPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (days || Number(process.env.JWT_EXP_DAYS || 365)) * 24 * 3600;
  const payload = {
    iss: process.env.JWT_ISSUER || "ekolepro",
    sub: "licence",
    licence_key: licenceKey,
    ecole_id: schoolId,
    max_devices: maxDevices,
    status: "active",
    iat: now,
    exp
  };
  const token = jwt.sign(payload, privateKey, { algorithm: "RS256" });
  return { token, payload, exp: new Date(exp * 1000).toISOString() };
}

export function verifyLicenceJWT(token) {
  try {
    const publicKey = loadPublicKey();
    return jwt.verify(token, publicKey, { algorithms: ["RS256"] });
  } catch (e) {
    return null;
  }
}
