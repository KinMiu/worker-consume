import logger from "../utils/logger.js";
import path from "path";
import cron from "node-cron";
import fs from "fs";
import {prisma} from "../config/prisma.js";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUFFER_FILE = path.join(__dirname, "../../data_buffer.json");
const THRESHOLD = 1.0;

let statsBuffer = {};

export const processSensorData = async (data, message, channel) => {
  try {
    // console.log(data);
    const macAddress = data.mac;
    const deviceTime = data.deviceTime;

    const isDeviceValid = await handleDevicePresence(macAddress);
    // console.log("isDeviceValid", isDeviceValid);

    if (!isDeviceValid) {
      channel.ack(message);
      return;
    }

    for (const [key, value] of Object.entries(data)) {
      if (key === "status" || key === "macAddress" || key === "deviceTime")
        continue;

      const componentId = key;
      const currentValue = parseFloat(value);

      if (isNaN(currentValue)) continue;

      if (!statsBuffer[componentId]) {
        statsBuffer[componentId] = {
          sum: 0,
          count: 0,
          lastSavedValue: null,
          macAddress: macAddress,
          deviceTime: deviceTime,
        };
      }

      const compStats = statsBuffer[componentId];

      const isFirstData = compStats.lastSavedValue === null;
      const diff = isFirstData
        ? 0
        : Math.abs(currentValue - compStats.lastSavedValue);
      const isSignificantChange = diff >= THRESHOLD;

      if (isFirstData || isSignificantChange) {
        compStats.sum += currentValue;
        compStats.count += 1;
        compStats.lastSavedValue = currentValue;
      } else {
      }
      // console.log(compStats);
    }

    channel.ack(message);
    // channel.nack(message, false, true);
  } catch (error) {
    logger.error("Failed to process data: ", error);
    channel.nack(message, false, true);
  }
};

export const handleDevicePresence = async (macAddress) => {
  try {
    const device = await prisma.device.findUnique({
      where: {
        macAddress: macAddress,
      },
    });
    // console.log(device);

    if (!device) {
      logger.warn(
        `Data dari MAC ${macAddress} ditolak: Device tidak terdaftar di DB`,
      );
      return false;
    }

    const now = new Date();

    await prisma.device.update({
      where: {
        macAddress: macAddress,
      },
      data: {
        lastSeen: now,
      },
    });

    return true;
  } catch (error) {
    logger.error(`Gagal memproses status presence ${macAddress}`, error);
    return false;
  }
};

const flushBufferToJson = () => {
  const timeStamp = new Date();
  const averagedData = [];

  for (const componentId in statsBuffer) {
    const compStats = statsBuffer[componentId];
    // console.log(componentId);

    if (compStats.count > 0) {
      averagedData.push({
        macAddress: compStats.macAddress,
        componentId: componentId,
        value: parseFloat((compStats.sum / compStats.count).toFixed(2)),
        createdAt: timeStamp,
        deviceTime: compStats.deviceTime,
      });

      compStats.sum = 0;
      compStats.count = 0;
    }
  }

  // console.log(averagedData);

  if (averagedData.length > 0) {
    let existingData = [];
    if (fs.existsSync(BUFFER_FILE)) {
      console.log("Ini berjalan");
      const fileContent = fs.readFileSync(BUFFER_FILE, "utf-8");
      existingData = fileContent ? JSON.parse(fileContent) : [];
    }
    // console.log("tes");
    console.log("Ini berjalan juga");
    const updateData = [...existingData, ...averagedData];
    fs.writeFileSync(BUFFER_FILE, JSON.stringify(updateData, null, 2));
  }
};

export const initAggregator = () => {
  logger.info("Aggregator Multi-Component Ready!");
  setInterval(flushBufferToJson, 60000);

  cron.schedule("00 18 * * *", async () => {
    logger.info("Midnight Sync: Memindahkan JSON ke database");

    if (!fs.existsSync(BUFFER_FILE)) return;

    try {
      const fileContent = fs.readFileSync(BUFFER_FILE, "utf-8");
      const dataBuffer = JSON.parse(fileContent);

      if (dataBuffer.length > 0) {
        const uniqueMac = [...new Set(dataBuffer.map((d) => d.macAddress))];

        const deviceInDB = await prisma.device.findMany({
          where: {macAddress: {in: uniqueMac}},
          select: {
            id: true,
            macAddress: true,
          },
        });

        const deviceMap = {};
        deviceInDB.forEach((dev) => {
          deviceMap[dev.macAddress] = dev.id;
        });

        const finalDataForDB = [];

        for (const item of dataBuffer) {
          const deviceId = deviceMap[item.macAddress];
          if (deviceId) {
            finalDataForDB.push({
              deviceId: deviceId,
              componentId: item.componentId,
              value: item.value,
              deviceTime: item.deviceTime ? new Date(item.deviceTime) : null,
              createdAt: new Date(item.createdAt),
            });
          } else {
            logger.warn(
              `Device with MAC ${item.macAddress} not found in DB. The data was skipped`,
            );
          }
        }

        if (finalDataForDB.length > 0) {
          await prisma.sensorData.createMany({
            data: finalDataForDB,
          });

          logger.info(`Success synchronize data to DB`);
        }

        fs.writeFileSync(BUFFER_FILE, JSON.stringify([]));
      }
    } catch (error) {
      console.log(error);
      logger.error("Failed to synchronize: ", error);
    }
  });
};
