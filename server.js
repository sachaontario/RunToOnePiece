const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const QRCode = require("qrcode");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const { characters } = require("./data/pokemon");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const db = new Database(path.join(__dirname, "data", "onepiece.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS captures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    character_id INTEGER NOT NULL,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, character_id)
  );
`);

const createUser = db.prepare("INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)");
const getUser = db.prepare("SELECT * FROM users WHERE email = ?");
const captureCharacter = db.prepare(
  "INSERT OR IGNORE INTO captures (user_id, character_id) VALUES (?, ?)"
);
const getUserCaptures = db.prepare(
  "SELECT character_id FROM captures WHERE user_id = ?"
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/roster", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "roster.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/scan/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const c = characters.find(ch => ch.id === id);
  if (!c) return res.status(404).send("Personnage non trouvé");
  res.sendFile(path.join(__dirname, "public", "scan.html"));
});

app.get("/api/characters", (req, res) => {
  res.json(characters);
});

app.get("/api/characters/:id", (req, res) => {
  const c = characters.find(ch => ch.id === parseInt(req.params.id));
  if (!c) return res.status(404).json({ error: "Non trouvé" });
  res.json(c);
});

app.post("/api/auth", (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Email invalide" });
  }
  let user = getUser.get(email);
  if (!user) {
    const id = uuidv4();
    createUser.run(id, email);
    user = { id, email };
  }
  res.cookie("userId", user.id, { httpOnly: true, maxAge: 365 * 24 * 60 * 60 * 1000, sameSite: 'lax' });

  if (email === "xxwarkelxx@gmail.com") {
    characters.forEach(c => captureCharacter.run(user.id, c.id));
  }

  res.json({ userId: user.id, email: user.email });
});

app.post("/api/capture", (req, res) => {
  const userId = req.cookies.userId;
  const { characterId, lat, lon } = req.body;
  if (!userId || !characterId) {
    return res.status(400).json({ error: "Données manquantes" });
  }

  if (lat && lon) {
    const c = characters.find(ch => ch.id === characterId);
    const R = 6371e3;
    const φ1 = lat * Math.PI / 180;
    const φ2 = c.lat * Math.PI / 180;
    const Δφ = (c.lat - lat) * Math.PI / 180;
    const Δλ = (c.lon - lon) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (distance > 30) {
      return res.status(403).json({ error: "Trop loin ! Approche du personnage." });
    }
  }

  const existing = db.prepare("SELECT id FROM captures WHERE user_id = ? AND character_id = ?").get(userId, characterId);
  captureCharacter.run(userId, characterId);
  const c = characters.find(ch => ch.id === characterId);
  res.json({ success: !existing, character: c });
});

app.get("/api/user/captures", (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) return res.json([]);
  const captures = getUserCaptures.all(userId);
  res.json(captures.map(c => c.character_id));
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("userId");
  res.json({ success: true });
});

app.get("/api/admin/users", (req, res) => {
  const userId = req.cookies.userId;
  const user = getUser.get(userId);
  
  if (!user || user.email !== "xxwarkelxx@gmail.com") {
    return res.status(403).json({ error: "Accès non autorisé" });
  }
  
  const allUsers = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  const usersData = allUsers.map(u => {
    const captures = db.prepare("SELECT COUNT(*) as count FROM captures WHERE user_id = ?").get(u.id);
    return {
      email: u.email,
      captures: captures.count,
      created_at: u.created_at
    };
  });
  
  res.json(usersData);
});

app.listen(PORT, () => {
  console.log(`🏴‍☠️ RunToOnePiece actif sur http://localhost:${PORT}`);
});
