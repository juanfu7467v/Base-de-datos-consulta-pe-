import express from "express";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import qrcode from "qrcode";
import baileys from "@whiskeysockets/baileys";

const { makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;

const app = express();
app.use(express.json());
app.use(cors()); // ✅ Habilita CORS

const SESSION_DIR = "./session";
const QR_FILE = path.join(SESSION_DIR, "last_qr.png");

fs.ensureDirSync(SESSION_DIR);

let latestQR = null;
let connected = false;
let sock = null;
let connectionInfo = { status: "starting" };

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["Fly.io WhatsApp Bot", "Chrome", "1.0.0"],
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        latestQR = qr;
        await qrcode.toFile(QR_FILE, qr);
        connectionInfo = { status: "qr_generated", message: "Escanea el código QR para vincular WhatsApp" };
        console.log("📲 QR generado. Escanéalo desde /qr");
      }

      if (connection === "open") {
        connected = true;
        connectionInfo = { status: "connected", message: "✅ Conectado correctamente a WhatsApp" };
        console.log("✅ Bot vinculado correctamente");
        if (fs.existsSync(QR_FILE)) fs.removeSync(QR_FILE);
      }

      if (connection === "close") {
        connected = false;
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log("❌ Conexión cerrada. Reintentando...");
        if (reason !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
      }
    });

    sock.ev.on("messages.upsert", async (m) => {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;
      const from = msg.key.remoteJid;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

      console.log(`📩 Mensaje recibido de ${from}: ${text}`);

      if (text.toLowerCase() === "hola") {
        await sock.sendMessage(from, { text: "👋 ¡Hola! Soy tu bot conectado a Fly.io 🚀" });
      } else {
        await sock.sendMessage(from, { text: "🤖 Escribe 'hola' para comenzar." });
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error("❌ Error al iniciar el bot:", err);
    connectionInfo = { status: "error", message: err.message };
  }
}

startBot();

// ✅ Página principal
app.get("/", (req, res) => {
  res.send(`
    <h2>🤖 WhatsApp Bot - Fly.io</h2>
    <p>Estado actual: ${connectionInfo.status}</p>
    <p>${connectionInfo.message || ""}</p>
    <a href="/qr" target="_blank">📱 Ver QR</a>
  `);
});

// ✅ Endpoint del QR
app.get("/qr", async (req, res) => {
  try {
    if (connected) return res.json({ status: "connected" });
    if (fs.existsSync(QR_FILE)) {
      const image = await fs.readFile(QR_FILE, { encoding: "base64" });
      res.json({ status: "qr", qr: `data:image/png;base64,${image}` });
    } else {
      res.json({ status: connectionInfo.status || "waiting" });
    }
  } catch (err) {
    res.status(500).json({ error: "Error al generar QR", details: err.message });
  }
});

// ✅ Estado del bot
app.get("/status", (req, res) => {
  res.json({
    connected,
    info: connectionInfo,
  });
});

// ✅ Enviar mensaje
app.get("/send", async (req, res) => {
  const { phone, text } = req.query;
  if (!phone || !text) return res.json({ error: "Faltan parámetros: ?phone=519xxxxxxx&text=Hola" });

  if (!connected || !sock) return res.json({ error: "Bot no conectado aún" });

  try {
    await sock.sendMessage(`${phone}@s.whatsapp.net`, { text });
    res.json({ success: true, to: phone, message: text });
  } catch (err) {
    res.json({ error: "Error al enviar el mensaje", details: err.message });
  }
});

// ✅ Eliminar sesión
app.get("/logout", async (req, res) => {
  try {
    await fs.remove(SESSION_DIR);
    res.json({ status: "ok", message: "Sesión eliminada. Reinicia para generar nuevo QR." });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar sesión" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
