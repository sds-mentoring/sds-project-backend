import { Router } from "express";
import { logger } from "./logger.js";
import { issueToken, verifyOAuthLogin } from "./auth.js";
import { verifyAccessToken, verifyRefreshToken } from "./auth.js";
import "dotenv/config";

export const router = Router();

router.post("/auth/login", async (req, res) => {
  const { oauthProvider, accessToken: oauthAccessToken } = req.body;
  const result = await verifyOAuthLogin(oauthProvider, oauthAccessToken);

  if (result === undefined) {
    return res.status(403).json({
      message: "Unauthorized",
    });
  }

  res.status(200).json({
    message: "Login successful",
    accessToken: issueToken(result.userId, "access"),
    refreshToken: issueToken(result.userId, "refresh"),
  });
});

router.post("/auth/refresh", verifyRefreshToken, (req, res) => {
  if (!req.jwtPayload) return res.status(403).json({ message: "User information not found" });

  res.status(200).json({
    message: "Refresh successful",
    accessToken: issueToken(req.jwtPayload.userId, "access"),
  });
});

router.get("/me", verifyAccessToken, (req, res) => {
  return res.status(200).json({
    message: "Verification succeeded",
  });
});

router.get("/health", (req, res) => {
  const date = new Date();

  logger.info(`GET /health ${req.ip}`);

  res.json({
    status: "UP",
    timestamp: date.toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    checks: {},
  });
});
