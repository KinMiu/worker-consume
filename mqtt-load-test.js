import mqtt from "mqtt";
import fs from "fs";

// 1. Baca data dari hasil seeder
const rawData = fs.readFileSync("test-devices.json");
const devices = JSON.parse(rawData);

// 2. Konek ke MQTT pakai protokol TCP (mqtt://) biar lebih ngebut dan stabil
const client = mqtt.connect("mqtt://195.35.23.135:1883", {
  username: "/smk2pkl:smk2iot",
  password: "smk2iot",
  clientId: `load_tester_${Math.random().toString(16).slice(3)}`,
});

let messageCount = 0;

// --- KONFIGURASI SIKSAAN ---
// 500 artinya ngirim data tiap 0.5 detik (Total 10 pesan/detik untuk 5 device)
// Kalau mau lebih brutal, turunin angkanya jadi 100 atau 50!
const INTERVAL_MS = 500;

client.on("connect", () => {
  console.log("🚀 Load Tester Connected to MQTT Broker!");
  console.log(
    `📡 Menyiapkan tembakan brutal untuk ${devices.length} device...\n`,
  );

  setInterval(() => {
    devices.forEach((device) => {
      // Base payload
      const payload = {
        status: "ONLINE",
      };

      // Isi nilai random untuk 5 sensor berdasarkan UUID-nya
      for (const [name, id] of Object.entries(device.components)) {
        if (name.includes("Suhu")) {
          // Suhu random antara 25.0 - 35.0
          payload[id] = (25 + Math.random() * 10).toFixed(1);
        } else if (name.includes("Kelembaban")) {
          // Kelembaban random antara 60.0 - 90.0
          payload[id] = (60 + Math.random() * 30).toFixed(1);
        } else if (name.includes("Cahaya")) {
          // Cahaya random antara 800 - 1200 Lux
          payload[id] = Math.floor(800 + Math.random() * 400);
        }
      }

      // Tembak ke broker secepat kilat (QoS 0)
      client.publish(`sensor/${device.macAddress}`, JSON.stringify(payload), {
        qos: 0,
      });
      messageCount++;
    });
  }, INTERVAL_MS);
});

// 3. Monitor kecepatan tembakan setiap 1 detik
setInterval(() => {
  if (messageCount > 0) {
    console.log(`🔥 Kecepatan tembakan: ${messageCount} pesan / detik`);
    messageCount = 0; // Reset counter
  }
}, 1000);

client.on("error", (err) => {
  console.error("🔴 MQTT Error:", err.message);
});
