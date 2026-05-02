import {getChannel} from "../utils/mqtt.js";
import logger from "../utils/logger.js";
import {processSensorData} from "./aggregatorData.js";

export const startSensorConsumer = async () => {
  try {
    // console.log("tes");
    const channel = getChannel();
    const queueName = "sensor-tes";

    await channel.assertQueue(queueName, {durable: true});

    channel.prefetch(200);

    logger.info(`Consumer standby! Antrean: ${queueName}`);

    channel.consume(queueName, (message) => {
      if (!message) return;
      try {
        const content = message.content.toString();

        const parsedData = JSON.parse(content);
        // console.log(parsedData);
        const routingKey = message.fields.routingKey;

        const macAddress = routingKey.split(/[./]/)[1];
        // console.log(macAddress);

        if (macAddress) {
          parsedData.macAddress = macAddress;
        }

        // console.log(parsedData);

        processSensorData(parsedData, message, channel);
      } catch (error) {
        logger.error("JSON Format error, message removed");
        channel.ack(message);
      }
    });
  } catch (error) {
    logger.error("Gagal menjalankan Sensor Consumer: ", error.message);
  }
};
