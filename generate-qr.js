const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");
const { characters } = require("./data/pokemon");

const qrDir = path.join(__dirname, "public", "qr");
if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

async function generate() {
  for (const c of characters) {
    const filename = `${c.id}-${c.name.replace(/[^a-zA-Z]/g, '_')}.png`;
    const filepath = path.join(qrDir, filename);
    if (fs.existsSync(filepath)) continue;
    await QRCode.toFile(filepath, `/scan/${c.id}`, {
      width: 300,
      margin: 2,
      color: { dark: c.color || "#000", light: "#ffffff" }
    });
    console.log(`✅ ${filename}`);
  }
  console.log(`\n🎉 ${characters.length} QR codes générés !`);
}

generate();
