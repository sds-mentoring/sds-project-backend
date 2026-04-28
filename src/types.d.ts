import type { JwtPayload } from "jsonwebtoken";

declare global {
  type TokenType = "access" | "refresh";

  type TokenPayload = JwtPayload & {
    userId: string;
    type: TokenType;
  };

  namespace Express {
    interface Request {
      jwtPayload?: TokenPayload;
    }
  }

  type OAuthProvider = "naver";
}

export {};
