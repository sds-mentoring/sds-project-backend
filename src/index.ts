import app from "./app.js";
import { logger } from "./logger.js";

const port = 3000;
app.listen(port, () => {
  logger.info(`Listening port ${port}`);
});
