import {getChannel} from "../utils/mqtt.js";
import logger from "../utils/logger.js";
import {processSensorData} from "./aggregatorData.js";

export const startSensorConsumer = async () => {
  try {
    const channel = getChannel();
    const queueName = process.env.AMQP_SENSOR_QUEUE || "sensor-tes";

    await channel.assertQueue(queueName, {durable: true});

    channel.prefetch(200);

    logger.info(`[SensorConsumer] Standby listening on queue: ${queueName}`);

    channel.consume(queueName, async (message) => {
      if (!message) return;

      try {
        const content = message.content.toString();
        let parsedData;

        try {
          parsedData = JSON.parse(content);
        } catch (jsonErr) {
          const routingKey = message.fields?.routingKey || "unknown";
          logger.warn(
            `[SensorConsumer] Non-JSON payload dropped on '${routingKey}': "${content.slice(0, 100)}" (${jsonErr.message})`,
          );
          channel.ack(message);
          return;
        }

        if (typeof parsedData !== "object" || parsedData === null) {
          logger.warn(
            `[SensorConsumer] Ignored non-object payload: "${content.slice(0, 100)}"`,
          );
          channel.ack(message);
          return;
        }

        // Extract MAC address from routingKey if not present in payload
        if (!parsedData.macAddress && !parsedData.mac && !parsedData.macaddress) {
          const routingKey = message.fields?.routingKey || "";
          const parts = routingKey.split(/[./]/);
          if (parts.length >= 2) {
            parsedData.macAddress = parts[1];
          } else if (routingKey) {
            parsedData.macAddress = routingKey;
          }
        }

        await processSensorData(parsedData);
        channel.ack(message);
      } catch (error) {
        logger.error("[SensorConsumer] Error processing sensor payload:", error.message || error);
        channel.ack(message);
      }
    });
  } catch (error) {
    logger.error("[SensorConsumer] Failed to start Sensor Consumer:", error.message || error);
  }
};
