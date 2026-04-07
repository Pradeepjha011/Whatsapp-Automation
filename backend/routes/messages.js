import { Router } from "express";

import { listMessages } from "../controllers/messageController.js";

const router = Router();

router.get("/:phone", listMessages);

export default router;
