import dotenv from "dotenv";
import logger from "./src/utils/logger.js";
import {prisma} from "./src/config/prisma.js";
import {connectAMQP, closeAMQP} from "./src/utils/mqtt.js";
import {startSensorConsumer} from "./src/service/sensorConsumer.js";
import {initAggregator} from "./src/service/aggregatorData.js";

dotenv.config();

async function startServer() {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully");

    await connectAMQP();

    initAggregator();

    await startSensorConsumer();
    logger.info("Worker System is Running");
  } catch (error) {
    logger.error("Failed to connect to database");
    logger.error(error);
    process.exit(0);
  }
}

process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await closeAMQP();
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
