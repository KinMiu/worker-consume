import "dotenv/config";
import {prisma} from "../src/config/prisma.js";
import fs from "fs";

async function main() {
  const greenhouseId = "6e0e2104-8b8f-47de-a8bb-f2ef7aaf1a20";
  const areaId = "1001004f-0338-4c63-a663-eb300c7ac5ae";

  console.log("🌱 Memulai seeding untuk Load Test...");

  const createdDevices = [];

  // Loop untuk membuat 5 Device
  for (let i = 1; i <= 5; i++) {
    // Generate MAC Address buatan yang gampang dikenali (Format: FF:EE:DD:CC:BB:0X)
    const macAddress = `FF:EE:DD:CC:BB:0${i}`;

    const device = await prisma.device.create({
      data: {
        name: `Node Load Test ${i}`,
        macAddress: macAddress,
        status: "OFFLINE", // Default offline sebelum di-test
        greenhouseId: greenhouseId,
        areaId: areaId,
        // Buat 3 komponen sekaligus pakai Nested Create Prisma
        components: {
          create: [
            {
              name: "Suhu Udara",
              type: "SENSOR",
              unit: "°C",
              category: "Temperature",
            },
            {
              name: "Kelembaban Udara",
              type: "SENSOR",
              unit: "%",
              category: "Humidity",
            },
            {
              name: "Suhu Tanah",
              type: "SENSOR",
              unit: "°C",
              category: "Temperature",
            },
            {
              name: "Kelembaban Tanah",
              type: "SENSOR",
              unit: "%",
              category: "Moisture",
            },
            {
              name: "Intensitas Cahaya",
              type: "SENSOR",
              unit: "Lux",
              category: "Light",
            },
          ],
        },
      },
      include: {
        components: true, // Ambil data komponen yang baru dibuat (untuk dapat UUID-nya)
      },
    });

    createdDevices.push(device);
    console.log(`✅ Berhasil membuat device: ${device.name} (${macAddress})`);
  }

  // Siapkan data untuk diekstrak menjadi JSON
  const extractData = createdDevices.map((d) => {
    return {
      deviceId: d.id,
      macAddress: d.macAddress,
      // Kita mapping komponennya agar script load test nanti gampang akses ID-nya
      components: d.components.reduce((acc, comp) => {
        acc[comp.name] = comp.id;
        return acc;
      }, {}),
    };
  });

  // Tulis ke dalam file test-devices.json
  fs.writeFileSync("test-devices.json", JSON.stringify(extractData, null, 2));

  console.log("\n🎉 Seeding Selesai!");
  console.log("📁 File test-devices.json berhasil dibuat!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
