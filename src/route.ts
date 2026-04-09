import { Router } from "express";
import { privateKey } from "./auth.js";

import jwt from "jsonwebtoken";
import { verifyToken } from "./auth.js";

export const router = Router();

router.post("/auth/login", (req, res) => {
  const payload = {};
  const token = jwt.sign(payload, privateKey, {
    expiresIn: "1h",
    algorithm: "RS256",
  });

  res.status(200).json({
    message: "Login successful",
    token: token,
  });
});

router.get("/me", verifyToken, (req, res) => {
  return res.status(200).json({
    message: "Verification succeeded",
  });
});
