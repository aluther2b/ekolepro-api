//src/routes/callbacks.routes.js
import express from "express";
import { paydunyaCallback } from "../controllers/callbacks.controller.js";

const router = express.Router();

router.post("/paydunya", paydunyaCallback);

export default router;
