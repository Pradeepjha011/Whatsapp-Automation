import { Router } from "express";

import { sendMessage } from "../controllers/sendMessageController.js";

const router = Router();

router.post("/", sendMessage);

export default router;
