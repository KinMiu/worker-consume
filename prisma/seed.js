import "dotenv/config";
import bcrypt from "bcrypt";
import logger from "../src/utils/logger.js";
import {prisma} from "../src/config/prisma.js";

async function main() {
  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: "SUPER_ADMIN",
    },
  });

  if (existingSuperAdmin) {
    logger.info("SUPER_ADMIN already exists");
  } else {
    const hashPassword = await bcrypt.hash("superadmin123", 10);

    await prisma.user.create({
      data: {
        name: "Super Admin",
        email: "superadmin@GH.com",
        password: hashPassword,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });

    logger.info("SUPER_ADMIN created successfully");
  }

  const ownerEmail = "owner@GH.com";
  let ownerUser = await prisma.user.findUnique({
    where: {email: ownerEmail},
  });

  if (!ownerUser) {
    const hashPassword = await bcrypt.hash("owner123", 10);

    ownerUser = await prisma.user.create({
      data: {
        name: "Kinmiu",
        email: ownerEmail,
        password: hashPassword,
        role: "OWNER",
        isActive: true,
      },
    });
    logger.info("OWNER created successfully");
  } else {
    logger.info("OWNER already exists");
  }

  let greenhouse = await prisma.greenhouse.findFirst({
    where: {
      ownerId: ownerUser.id,
    },
  });

  if (!greenhouse) {
    greenhouse = await prisma.greenhouse.create({
      data: {
        name: "Greenhouse Alpha",
        location: "Bandar Lampung",
        ownerId: ownerUser.id,
      },
    });
    logger.info("GREENHOUSE created successfully");
  } else {
    logger.info("GREENHOUSE already exists");
  }

  let area = await prisma.area.findFirst({
    where: {
      greenhouseId: greenhouse.id,
    },
  });

  if (!area) {
    area = await prisma.area.create({
      data: {
        name: "Blok A (Hidroponik)",
        description: "Area khusus sayuran daun",
        greenhouseId: greenhouse.id,
      },
    });
    logger.info("AREA created successfully");
  } else {
    logger.info("AREA already exists");
  }

  const dummyMAC = "AA:BB:CC:DD:EE:FF";
  let device = await prisma.device.findUnique({
    where: {macAddress: dummyMAC},
  });

  if (!device) {
    device = await prisma.device.create({
      data: {
        name: "ESP32 Node Center",
        macAddress: dummyMAC,
        status: "ONLINE",
        greenhouseId: greenhouse.id,
        areaId: area.id,
        components: {
          create: [
            {
              name: "Sensor Suhu Ruangan",
              type: "SENSOR",
              category: "TEMPERATURE",
              unit: "°C",
              pin: "D4",
            },
            {
              name: "Pompa Nutrisi Utama",
              type: "ACTUATOR",
              category: "PUMP",
              pin: "D4",
            },
          ],
        },
      },
    });
    logger.info("DEVICE & COMPONENTS created successfully");
  } else {
    logger.info("DEVICE already exists");
  }
}

main()
  .catch((e) => {
    logger.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
