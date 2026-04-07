import { Router } from "express";

import { getDefaultTemplate, updateDefaultTemplate } from "../controllers/settingsController.js";

const router = Router();

router.get("/default-template", getDefaultTemplate);
router.put("/default-template", updateDefaultTemplate);

export default router;
