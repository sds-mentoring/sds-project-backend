import express from "express";
import { logger } from "./logger.js";

const app = express();
const port = 3000;

app.get("/health", (req, res) => {
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

app.listen(port, () => {
  logger.info(`Listening port ${port}`);
});
