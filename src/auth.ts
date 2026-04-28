import jwt from "jsonwebtoken";
import fs from "node:fs";
import "dotenv/config";
import type { Request, Response, NextFunction } from "express";

type OAuthProvider = "naver";
type UserInfo = { userId: string };

const privateKey = fs.readFileSync("private.pem", "utf8");
const publicKey = fs.readFileSync("public.pem", "utf8");

if (!privateKey || !publicKey) {
  throw new Error("private.pem or public.pem is empty");
}

export function issueToken(userId: string, type: TokenType): string {
  const expiresIn = type === "access" ? "10m" : "1d";

  return jwt.sign(
    {
      userId: userId,
      type: type,
    },
    privateKey,
    {
      expiresIn: expiresIn,
      algorithm: "RS256",
    },
  );
}

export async function verifyOAuthLogin(
  oauthProvider: OAuthProvider,
  accessToken: string,
): Promise<UserInfo | undefined> {
  let url: string | undefined = undefined;

  if (oauthProvider === "naver") {
    url = process.env.NAVER_OAUTH_URL;
  }

  if (url === undefined) {
    return undefined;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return undefined;
  }

  return {
    userId: (await res.json()).response.id,
  };
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

export function verifyRefreshToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as TokenPayload;

    if (decoded.type !== "refresh") return res.status(403).json({ message: "Not an access token" });

    req.jwtPayload = decoded;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid token" });
  }
}
