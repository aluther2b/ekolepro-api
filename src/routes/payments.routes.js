// src/routes/payments.routes.ts
import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { initPayment } from "../controllers/payments.controller.js";

const router = express.Router();

router.post("/init", requireAuth, initPayment);


export default router;
