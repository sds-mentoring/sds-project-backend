import { createClient } from "redis";
import "dotenv/config";

export const redis = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

redis.on("error", (err) => console.error("Redis client error:", err));

await redis.connect();
