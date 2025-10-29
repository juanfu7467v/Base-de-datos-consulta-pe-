import express from "express";
import cors from "cors";
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import fs from "fs-extra";
import qrcode from "qrcode";
import path from "path";

const app = express();
app.use(express.json());
app.use(cors()); // ✅ Permite solicitudes desde AppCreator24 y otros dominios

const SESSION_DIR = "./session";
const QR_FILE = path.join(SESSION_DIR, "last_qr.png");

fs.ensureDirSync(SESSION_DIR);

let connected = false;
let sock = null;
let connectionInfo = { status: "starting", message: "Inicializando bot..." };

// 🔹 FUNCIÓN PRINCIPAL
async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        await qrcode.toFile(QR_FILE, qr);
        connectionInfo = { status: "qr_generated", message: "Escanea el QR para vincular tu WhatsApp" };
        console.log("📲 Nuevo código QR generado. Escanéalo en /qr");
      }

      if (connection === "open") {
        connected = true;
        connectionInfo = { status: "connected", message: "✅ Conectado correctamente a WhatsApp" };
        console.log("✅ Bot conectado correctamente a WhatsApp");
        if (fs.existsSync(QR_FILE)) fs.removeSync(QR_FILE);
      }

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;
        connected = false;
        console.log("❌ Conexión cerrada. Intentando reconectar...");
        connectionInfo = { status: "reconnecting", message: "Reconectando a WhatsApp..." };
        if (reason !== DisconnectReason.loggedOut) setTimeout(startBot, 5000);
      }
    });

    sock.ev.on("messages.upsert", async (m) => {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

      console.log(`📩 Mensaje de ${from}: ${text}`);

      if (text.toLowerCase() === "hola") {
        await sock.sendMessage(from, { text: "👋 ¡Hola! Soy tu bot conectado con Fly.io 🚀" });
      } else {
        await sock.sendMessage(from, { text: "🤖 No entiendo ese comando. Escribe 'hola' para comenzar." });
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error("❌ Error al iniciar el bot:", err);
    connectionInfo = { status: "error", message: err.message };
  }
}

startBot();

// 🌐 ENDPOINT PRINCIPAL
app.get("/", (req, res) => {
  res.send(`
    <h2>🤖 WhatsApp Bot - Fly.io</h2>
    <p>Estado: ${connectionInfo.status}</p>
    <p>${connectionInfo.message}</p>
    <a href="/qr" target="_blank">📱 Ver QR</a>
  `);
});

// 📲 ENDPOINT QR (para AppCreator24)
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
    console.error(err);
    res.status(500).json({ error: "Error al generar QR", details: err.message });
  }
});

// 📡 ENDPOINT ESTADO GENERAL
app.get("/status", (req, res) => {
  res.json({ connected, info: connectionInfo });
});

// 💬 ENDPOINT ENVIAR MENSAJE
app.get("/send", async (req, res) => {
  const { phone, text } = req.query;
  if (!phone || !text) return res.json({ error: "Faltan parámetros: ?phone=519xxxxxxx&text=Hola" });

  if (!connected || !sock) return res.json({ error: "Bot no conectado a WhatsApp aún" });

  try {
    await sock.sendMessage(`${phone}@s.whatsapp.net`, { text });
    res.json({ success: true, to: phone, message: text });
  } catch (err) {
    res.json({ error: "Error al enviar mensaje", details: err.message });
  }
});

// 🧹 ENDPOINT ELIMINAR SESIÓN (logout)
app.get("/logout", async (req, res) => {
  try {
    await fs.remove(SESSION_DIR);
    connected = false;
    connectionInfo = { status: "logged_out", message: "Sesión eliminada correctamente" };
    res.json({ status: "ok", message: "Sesión cerrada. Reinicia para generar nuevo QR." });
    process.exit(0);
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar sesión" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
