import jwt from "jsonwebtoken";
import fs from "fs";
import "dotenv/config";
import type { Request, Response, NextFunction } from "express";
import { redis } from "./redis.js";

const privateKey = fs.readFileSync("private.pem", "utf8");
const publicKey = fs.readFileSync("public.pem", "utf8");

if (!privateKey || !publicKey) {
  throw new Error("private.pem or public.pem is empty");
}

export function issueAccessToken(userId: string): string {
  return jwt.sign({ userId, type: "access" }, privateKey, {
    expiresIn: "10m",
    algorithm: "RS256",
  });
}

export function issueRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, privateKey, {
    expiresIn: "1d",
    algorithm: "RS256",
  });
}

export function verifyTokenBody(token: string, expectedType: TokenType): TokenPayload | undefined {
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as TokenPayload;
    if (decoded.type !== expectedType) return undefined;
    return decoded;
  } catch {
    return undefined;
  }
}

export function verifyAccessToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as TokenPayload;
    if (decoded.type !== "access") return res.status(403).json({ message: "Not an access token" });
    req.jwtPayload = decoded;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid token" });
  }
}

type NaverTokens = { accessToken: string; refreshToken: string };

type NaverTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
};

type NaverProfileResponse = {
  resultcode: string;
  message: string;
  response: {
    id: string;
    name: string;
    email: string;
    mobile: string;
    profile_image: string;
  };
};

export async function exchangeNaverCode(
  code: string,
): Promise<({ userId: string } & NaverTokens) | undefined> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.NAVER_CLIENT_ID ?? "",
    client_secret: process.env.NAVER_CLIENT_SECRET ?? "",
    redirect_uri: process.env.BACKEND_CALLBACK_URL ?? "",
    code,
  });

  const res = await fetch(`https://nid.naver.com/oauth2.0/token?${params.toString()}`);
  if (!res.ok) return undefined;

  const data = (await res.json()) as NaverTokenResponse;
  if (data.error || !data.access_token || !data.refresh_token) return undefined;

  const profile = await fetchNaverProfile(data.access_token);
  if (!profile) return undefined;

  return { userId: profile.id, accessToken: data.access_token, refreshToken: data.refresh_token };
}

export async function fetchNaverProfile(
  accessToken: string,
): Promise<NaverProfileResponse["response"] | undefined> {
  const res = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;

  const data = (await res.json()) as NaverProfileResponse;
  if (data.resultcode !== "00") return undefined;

  return data.response;
}

export async function storeOAuthTokens(userId: string, tokens: NaverTokens): Promise<void> {
  await redis.set(`oauth_tokens:${userId}`, JSON.stringify(tokens));
}

export async function getOAuthTokens(userId: string): Promise<NaverTokens | undefined> {
  const raw = await redis.get(`oauth_tokens:${userId}`);
  if (!raw) return undefined;
  return JSON.parse(raw) as NaverTokens;
}

export async function refreshNaverTokens(
  userId: string,
  naverRefreshToken: string,
): Promise<NaverTokens | undefined> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.NAVER_CLIENT_ID ?? "",
    client_secret: process.env.NAVER_CLIENT_SECRET ?? "",
    refresh_token: naverRefreshToken,
  });

  const res = await fetch(`https://nid.naver.com/oauth2.0/token?${params.toString()}`);
  if (!res.ok) return undefined;

  const data = (await res.json()) as NaverTokenResponse;
  if (data.error || !data.access_token) return undefined;

  const tokens: NaverTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? naverRefreshToken,
  };

  await storeOAuthTokens(userId, tokens);
  return tokens;
}
