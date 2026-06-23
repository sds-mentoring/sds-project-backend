import { Router } from "express";
import { logger } from "./logger.js";
import {
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyTokenBody,
  exchangeNaverCode,
  storeOAuthTokens,
  getOAuthTokens,
  fetchNaverProfile,
  refreshNaverTokens,
} from "./auth.js";
import "dotenv/config";

export const router = Router();

router.get("/auth/callback", async (req, res) => {
  const code = typeof req.query["code"] === "string" ? req.query["code"] : undefined;
  const state = typeof req.query["state"] === "string" ? req.query["state"] : undefined;

  const errorRedirect = (msg: string) =>
    res.redirect(`com.example.sdsproject://oauth2callback?error=${encodeURIComponent(msg)}`);

  if (!code) return errorRedirect("missing_code");

  const result = await exchangeNaverCode(code);
  if (!result) return errorRedirect("oauth_failed");

  const { userId, accessToken: naverAccessToken, refreshToken: naverRefreshToken } = result;
  await storeOAuthTokens(userId, {
    accessToken: naverAccessToken,
    refreshToken: naverRefreshToken,
  });

  const params = new URLSearchParams({
    id: userId,
    accessToken: issueAccessToken(userId),
    refreshToken: issueRefreshToken(userId),
  });
  if (state) params.set("state", state);

  logger.info(`GET /auth/callback user=${userId}`);

  return res.redirect(`com.example.sdsproject://oauth2callback?${params.toString()}`);
});

router.post("/auth/login", async (req, res) => {
  const { provider, code } = req.body as { provider?: string; code?: string };

  if (provider !== "naver" || !code) {
    return res.status(400).json({ message: "Invalid provider or missing code" });
  }

  const result = await exchangeNaverCode(code);
  if (!result) {
    return res.status(403).json({ message: "OAuth authorization failed" });
  }

  const { userId, accessToken: naverAccessToken, refreshToken: naverRefreshToken } = result;
  await storeOAuthTokens(userId, {
    accessToken: naverAccessToken,
    refreshToken: naverRefreshToken,
  });

  logger.info(`POST /auth/login user=${userId}`);

  return res.status(200).json({
    id: userId,
    accessToken: issueAccessToken(userId),
    refreshToken: issueRefreshToken(userId),
  });
});

router.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(401).json({ message: "No refresh token provided" });

  const payload = verifyTokenBody(refreshToken, "refresh");
  if (!payload) return res.status(403).json({ message: "Invalid refresh token" });

  const { userId } = payload;

  return res.status(200).json({
    id: userId,
    accessToken: issueAccessToken(userId),
    refreshToken: issueRefreshToken(userId),
  });
});

router.get("/me", verifyAccessToken, async (req, res) => {
  const jwtPayload = req.jwtPayload;
  if (!jwtPayload) return res.status(403).json({ message: "User information not found" });

  const { userId } = jwtPayload;

  let tokens = await getOAuthTokens(userId);
  if (!tokens) return res.status(401).json({ message: "Session expired, please login again" });

  let profile = await fetchNaverProfile(tokens.accessToken);

  if (!profile) {
    const refreshed = await refreshNaverTokens(userId, tokens.refreshToken);
    if (!refreshed) return res.status(401).json({ message: "Session expired, please login again" });
    profile = await fetchNaverProfile(refreshed.accessToken);
  }

  if (!profile) return res.status(500).json({ message: "Failed to fetch user info" });

  logger.info(`GET /me user=${userId}`);
  logger.info(profile);

  return res.status(200).json({
    name: profile.name,
    phoneNumber: profile.mobile,
    email: profile.email,
    profileImageUrl: profile.profile_image,
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
    payload: {},
  });
});
