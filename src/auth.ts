import jwt from "jsonwebtoken";
import fs from "node:fs";
import type { Request, Response, NextFunction } from "express";

export const privateKey = fs.readFileSync("private.pem", "utf8");
export const publicKey = fs.readFileSync("public.pem", "utf8");

if (!privateKey || !publicKey) {
  throw new Error("private.pem or public.pem is empty");
}

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["authorization"];
  const token = header && header.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "No token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, privateKey);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(403).json({
      message: "Invalid token",
    });
  }
}
