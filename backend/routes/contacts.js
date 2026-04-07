import { Router } from "express";

import { listContacts } from "../controllers/contactController.js";

const router = Router();

router.get("/", listContacts);

export default router;
