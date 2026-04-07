import { Router } from "express";

import { listTemplates, sendTemplate } from "../controllers/templateController.js";

const router = Router();

router.get("/", listTemplates);
router.post("/send", sendTemplate);

export default router;
