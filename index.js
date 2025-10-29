import express from "express";
import cors from "cors";
import fetch from "node-fetch"; // asegúrate de tenerlo instalado
import fs from "fs-extra";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

// ⚙️ Variables del entorno (deben estar configuradas en Fly.io o Railway)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;

// 📁 Carpeta local temporal
const STORAGE_DIR = path.join(process.cwd(), "storage");
await fs.ensureDir(STORAGE_DIR);

// ✅ Función: guarda o actualiza datos en archivo local y luego los sube a GitHub
async function saveDynamicData(tipo, data) {
  const fileName = `${tipo}.json`;
  const filePath = path.join(STORAGE_DIR, fileName);

  // 1️⃣ Leer datos existentes (si hay)
  const existing = (await fs.readJson(filePath, { throws: false })) || [];
  existing.push({ ...data, fecha: new Date().toISOString() });

  // 2️⃣ Guardar localmente (solo por control temporal)
  await fs.writeJson(filePath, existing, { spaces: 2 });

  // 3️⃣ Subir o actualizar archivo en GitHub
  await uploadToGitHub(fileName, JSON.stringify(existing, null, 2));
}

// 🚀 Subir archivo a GitHub mediante la API
async function uploadToGitHub(fileName, content) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.error("❌ No hay variables GITHUB_TOKEN o GITHUB_REPO configuradas");
    return;
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${fileName}`;

  // Convertir a Base64 (GitHub requiere este formato)
  const base64Content = Buffer.from(content).toString("base64");

  // Verificar si el archivo ya existe para obtener su SHA
  let sha = null;
  const getResp = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
  });

  if (getResp.ok) {
    const data = await getResp.json();
    sha = data.sha;
  }

  // Crear o actualizar archivo
  const body = {
    message: `Actualización automática del archivo ${fileName}`,
    content: base64Content,
    sha
  };

  const resp = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error("❌ Error al subir archivo a GitHub:", errorText);
  } else {
    console.log(`✅ Archivo ${fileName} actualizado correctamente en GitHub`);
  }
}

// 🧠 Ruta universal para guardar cualquier tipo de dato
app.post("/guardar/:tipo", async (req, res) => {
  const tipo = req.params.tipo; // Ejemplo: dni_nombres, ruc, telefonos, etc.
  const data = req.body;

  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ error: "⚠️ Faltan datos en el cuerpo del request" });
  }

  try {
    await saveDynamicData(tipo, data);
    res.json({ ok: true, mensaje: `✅ Datos de tipo '${tipo}' guardados correctamente` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "❌ Error al guardar los datos" });
  }
});

// 🔍 Obtener historial según tipo
app.get("/historial/:tipo", async (req, res) => {
  const tipo = req.params.tipo;
  const filePath = path.join(STORAGE_DIR, `${tipo}.json`);
  if (!(await fs.pathExists(filePath))) return res.json([]);
  const data = await fs.readJson(filePath);
  res.json(data);
});

// 📂 Ver todos los tipos (archivos creados)
app.get("/tipos", async (req, res) => {
  const files = await fs.readdir(STORAGE_DIR);
  const tipos = files.filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
  res.json(tipos);
});

// 🧩 Ruta raíz
app.get("/", (req, res) => {
  res.send("✅ API dinámica con guardado en GitHub — Consulta PE");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Servidor activo en puerto ${PORT}`));
