import "dotenv/config";
import bcrypt from "bcrypt";
import logger from "../src/utils/logger.js";
import {prisma} from "../src/config/prisma.js";

async function main() {
  // ==========================================
  // 1. VALIDASI ENV (Wajib Ada)
  // ==========================================
  const superAdminEmail = process.env.SEED_ADMIN_EMAIL;
  const superAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;

  if (
    !superAdminEmail ||
    !superAdminPassword ||
    !ownerEmail ||
    !ownerPassword
  ) {
    logger.error(
      "Gagal menjalankan seed: Variabel lingkungan SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_OWNER_EMAIL, dan SEED_OWNER_PASSWORD wajib diisi di file .env!",
    );
    process.exit(1);
  }

  // ==========================================
  // 2. SEED SUPER_ADMIN
  // ==========================================
  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: "SUPER_ADMIN",
    },
  });

  if (existingSuperAdmin) {
    logger.info("SUPER_ADMIN already exists");
  } else {
    const hashPassword = await bcrypt.hash(superAdminPassword, 10);

    await prisma.user.create({
      data: {
        name: "Super Admin",
        email: superAdminEmail,
        password: hashPassword,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });

    logger.info("SUPER_ADMIN created successfully");
  }

  // ==========================================
  // 3. SEED OWNER
  // ==========================================
  let ownerUser = await prisma.user.findUnique({
    where: {email: ownerEmail},
  });

  if (!ownerUser) {
    const hashPassword = await bcrypt.hash(ownerPassword, 10);

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

  // ==========================================
  // 4. SEED GREENHOUSE
  // ==========================================
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

  // ==========================================
  // 5. SEED AREA
  // ==========================================
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

  // ==========================================
  // 6. SEED DEVICE & COMPONENTS
  // ==========================================
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
