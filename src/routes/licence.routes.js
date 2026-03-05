// src/routes/licence.route.js
import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { checkLicence } from "../controllers/licence.controller.js";

const router = express.Router();

router.get("/check", requireAuth, checkLicence);

export default router;
