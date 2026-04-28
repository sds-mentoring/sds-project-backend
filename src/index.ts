import express from "express";
import { logger } from "./logger.js";
import { router } from "./route.js";

const app = express();
const port = 3000;

app.use(express.json());
app.use(router);
app.listen(port, () => {
  logger.info(`Listening port ${port}`);
});
