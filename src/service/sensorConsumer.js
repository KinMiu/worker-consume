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

    channel.consume(queueName, (message) => {
      if (!message) return;

      try {
        const content = message.content.toString();
        const parsedData = JSON.parse(content);

        // Extract MAC address from routingKey if not present in payload
        if (!parsedData.macAddress && !parsedData.mac && !parsedData.macaddress) {
          const routingKey = message.fields.routingKey || "";
          const parts = routingKey.split(/[./]/);
          if (parts.length >= 2) {
            parsedData.macAddress = parts[1];
          } else if (routingKey) {
            parsedData.macAddress = routingKey;
          }
        }

        processSensorData(parsedData, message, channel);
      } catch (error) {
        logger.error("[SensorConsumer] Malformed JSON payload received, removing message:", error.message);
        channel.ack(message);
      }
    });
  } catch (error) {
    logger.error("[SensorConsumer] Failed to start Sensor Consumer:", error.message);
  }
};
