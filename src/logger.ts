import { FileTransport, Logger } from "@origranot/ts-logger";
import fs from "node:fs";

if (!fs.existsSync("log")) fs.mkdirSync("log");

const date = new Date();
const transport = new FileTransport({
  path: `log/${date.toISOString()}.log`,
});

export const logger = new Logger({
  timestamps: true,
  transports: [transport],
});
