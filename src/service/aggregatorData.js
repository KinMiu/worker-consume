import logger from "../utils/logger.js";
import {prisma} from "../config/prisma.js";

// In-memory buffer for sliding 1-minute sensor average
let statsBuffer = {};

// In-memory cache for MAC Address -> Device ID
const deviceCache = new Map();

// Helper to resolve and cache Device ID from MAC Address
async function getDeviceIdByMac(macAddress) {
  if (!macAddress) return null;

  if (deviceCache.has(macAddress)) {
    return deviceCache.get(macAddress);
  }

  try {
    const device = await prisma.device.findUnique({
      where: {macAddress},
      select: {id: true, macAddress: true},
    });

    if (device) {
      deviceCache.set(macAddress, device.id);
      return device.id;
    }
  } catch (err) {
    logger.error(`[Aggregator] Failed to lookup device by MAC ${macAddress}:`, err.message);
  }

  return null;
}

/**
 * Ingest and accumulate incoming sensor readings in RAM
 */
export const processSensorData = async (data, message, channel) => {
  try {
    const macAddress = data.macAddress || data.mac || data.macaddress;

    if (!macAddress) {
      logger.warn("[Aggregator] Received payload without MAC address. Skipping.");
      channel.ack(message);
      return;
    }

    const deviceTime = data.deviceTime || null;

    for (const [key, value] of Object.entries(data)) {
      if (
        key === "status" ||
        key === "macAddress" ||
        key === "mac" ||
        key === "macaddress" ||
        key === "deviceTime"
      ) {
        continue;
      }

      const componentId = key;
      const numVal = parseFloat(value);

      if (isNaN(numVal)) continue;

      if (!statsBuffer[componentId]) {
        statsBuffer[componentId] = {
          macAddress: macAddress,
          sum: 0,
          count: 0,
          lastDeviceTime: deviceTime,
        };
      }

      const compStats = statsBuffer[componentId];
      compStats.sum += numVal;
      compStats.count += 1;
      if (deviceTime) {
        compStats.lastDeviceTime = deviceTime;
      }
    }

    channel.ack(message);
  } catch (error) {
    logger.error("[Aggregator] Failed to process incoming sensor message:", error);
    // Acknowledge to prevent poison pill message from choking the queue
    channel.ack(message);
  }
};

/**
 * Flush accumulated in-memory sensor averages to PostgreSQL every 60 seconds
 */
const flushBufferToDatabase = async () => {
  // Swap snapshot atomically
  const currentSnapshot = statsBuffer;
  statsBuffer = {};

  const componentKeys = Object.keys(currentSnapshot);
  if (componentKeys.length === 0) {
    return;
  }

  const now = new Date();
  const recordsToInsert = [];
  const updatedDeviceIds = new Set();

  for (const componentId of componentKeys) {
    const compStats = currentSnapshot[componentId];
    if (compStats.count === 0) continue;

    const avgValue = parseFloat((compStats.sum / compStats.count).toFixed(2));
    const deviceId = await getDeviceIdByMac(compStats.macAddress);

    if (!deviceId) {
      logger.warn(
        `[Aggregator] Device with MAC ${compStats.macAddress} not found in DB. Skipping component ${componentId}`,
      );
      continue;
    }

    updatedDeviceIds.add(deviceId);

    recordsToInsert.push({
      deviceId: deviceId,
      componentId: componentId,
      value: avgValue,
      deviceTime: compStats.lastDeviceTime
        ? new Date(compStats.lastDeviceTime)
        : null,
      createdAt: now,
    });
  }

  if (recordsToInsert.length > 0) {
    try {
      // 1. Bulk insert averaged sensor records
      await prisma.sensorData.createMany({
        data: recordsToInsert,
        skipDuplicates: true,
      });

      // 2. Batch update lastSeen for all active devices in 1 query
      if (updatedDeviceIds.size > 0) {
        await prisma.device.updateMany({
          where: {
            id: {in: Array.from(updatedDeviceIds)},
          },
          data: {
            lastSeen: now,
          },
        });
      }

      logger.info(
        `[Aggregator] Successfully flushed ${recordsToInsert.length} sensor records to DB (1-minute average for ${updatedDeviceIds.size} devices)`,
      );
    } catch (error) {
      logger.error("[Aggregator] Error executing bulk insert to database:", error);
    }
  }
};

/**
 * Initialize periodic 1-minute aggregation flush
 */
export const initAggregator = () => {
  logger.info("[Aggregator] In-Memory Sensor Aggregator Ready (60s Batch Interval)");
  setInterval(flushBufferToDatabase, 60000);
};
