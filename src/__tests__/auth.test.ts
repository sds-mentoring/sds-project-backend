// jest.mock calls are hoisted before imports by Jest.
// - redis.js: prevents top-level `await redis.connect()` from running.
// - logger.js: prevents log-file creation and the node:fs interop issue in CJS mode.
jest.mock("../redis.js", () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock("../logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import fs from "fs";
import app from "../app.js";
import { issueAccessToken, issueRefreshToken } from "../auth.js";
import { redis } from "../redis.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const FAKE_USER_ID = "naver-user-123";
const FAKE_NAVER_ACCESS_TOKEN = "fake-naver-at";
const FAKE_NAVER_REFRESH_TOKEN = "fake-naver-rt";

const FAKE_PROFILE = {
  resultcode: "00",
  message: "success",
  response: {
    id: FAKE_USER_ID,
    name: "홍길동",
    email: "test@naver.com",
    mobile: "010-1234-5678",
    profile_image: "https://example.com/photo.jpg",
  },
};

function makeFetchMock() {
  return jest.fn().mockImplementation((url: string | URL) => {
    const urlStr = String(url);

    if (urlStr.includes("oauth2.0/token")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: FAKE_NAVER_ACCESS_TOKEN,
            refresh_token: FAKE_NAVER_REFRESH_TOKEN,
          }),
        ),
      );
    }

    if (urlStr.includes("nid/me")) {
      return Promise.resolve(new Response(JSON.stringify(FAKE_PROFILE)));
    }

    return Promise.reject(new Error(`Unmocked fetch call: ${urlStr}`));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Auth API", () => {
  beforeEach(() => {
    global.fetch = makeFetchMock() as typeof fetch;

    (redis.set as jest.Mock).mockResolvedValue("OK");
    (redis.get as jest.Mock).mockResolvedValue(
      JSON.stringify({
        accessToken: FAKE_NAVER_ACCESS_TOKEN,
        refreshToken: FAKE_NAVER_REFRESH_TOKEN,
      }),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("1. POST /auth/login returns access and refresh tokens for a valid code", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ provider: "naver", code: "valid-code" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
  });

  test("2. GET /me returns user information with a valid access token", async () => {
    const accessToken = issueAccessToken(FAKE_USER_ID);

    const res = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: FAKE_PROFILE.response.name,
      email: FAKE_PROFILE.response.email,
      phoneNumber: FAKE_PROFILE.response.mobile,
      profileImageUrl: FAKE_PROFILE.response.profile_image,
    });
  });

  test("3. GET /me rejects requests with an invalid access token", async () => {
    const res = await request(app)
      .get("/me")
      .set("Authorization", "Bearer this.is.not.a.valid.token");

    expect(res.status).toBe(403);
  });

  test("4. Valid refresh token issues an access token that can reach /me", async () => {
    const refreshToken = issueRefreshToken(FAKE_USER_ID);

    const refreshRes = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty("accessToken");

    const newAccessToken: string = refreshRes.body.accessToken;

    const meRes = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${newAccessToken}`);

    expect(meRes.status).toBe(200);
  });

  test("5. Expired refresh token is rejected by /auth/refresh", async () => {
    const privateKey = fs.readFileSync("private.pem", "utf8");

    // Set exp directly to 1 hour in the past so the token is already expired.
    const expiredRefreshToken = jwt.sign(
      {
        userId: FAKE_USER_ID,
        type: "refresh",
        exp: Math.floor(Date.now() / 1000) - 3600,
      },
      privateKey,
      { algorithm: "RS256" },
    );

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: expiredRefreshToken });

    expect(res.status).toBe(403);
  });
});
