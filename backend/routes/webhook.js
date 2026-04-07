import { Router } from "express";

import { receiveWebhook, verifyWebhook } from "../controllers/webhookController.js";

const router = Router();

router.get("/", verifyWebhook);
router.post("/", receiveWebhook);

export default router;
