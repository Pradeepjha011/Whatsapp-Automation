import { Router } from "express";

import { createContact } from "../controllers/contactUpsertController.js";

const router = Router();

router.post("/", createContact);

export default router;
