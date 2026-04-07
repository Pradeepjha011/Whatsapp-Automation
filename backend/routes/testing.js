import { Router } from "express";

import { resetTestingData } from "../controllers/testingController.js";

const router = Router();

router.post("/reset", resetTestingData);

export default router;
