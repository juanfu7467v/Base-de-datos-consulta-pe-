import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

// 📦 Configuración GitHub
const GITHUB_OWNER = "TU_USUARIO"; // 👉 cámbialo por tu usuario GitHub
const GITHUB_REPO = "TU_REPOSITORIO"; // 👉 cámbialo por el nombre de tu repo
const GITHUB_BRANCH = "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// 📁 Carpeta temporal local
const STORAGE_DIR = path.join(process.cwd(), "storage");
await fs.ensureDir(STORAGE_DIR);

// ✅ Función: guarda local y sincroniza con GitHub
async function saveAndPushToGitHub(tipo, data) {
  const fileName = `${tipo}.json`;
  const filePath = path.join(STORAGE_DIR, fileName);

  // Leer archivo existente o crear nuevo
  const existing = (await fs.readJson(filePath, { throws: false })) || [];
  existing.push({ ...data, fecha: new Date().toISOString() });
  await fs.writeJson(filePath, existing, { spaces: 2 });

  // Convertir a Base64 para enviar a GitHub
  const contentBase64 = Buffer.from(JSON.stringify(existing, null, 2)).toString("base64");

  // Verificar si el archivo ya existe en GitHub
  const getUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${fileName}`;
  let sha = null;

  try {
    const getResp = await fetch(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const getData = await getResp.json();
    if (getData.sha) sha = getData.sha;
  } catch (e) {
    console.warn("⚠️ No se encontró archivo anterior, se creará uno nuevo.");
  }

  // Subir archivo actualizado a GitHub
  const pushResp = await fetch(getUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `Actualizar ${fileName} automáticamente`,
      content: contentBase64,
      branch: GITHUB_BRANCH,
      sha
    })
  });

  if (!pushResp.ok) {
    const errorText = await pushResp.text();
    console.error("❌ Error subiendo a GitHub:", errorText);
    throw new Error("Error al guardar en GitHub");
  }
}

// 🧠 Ruta universal
app.post("/guardar/:tipo", async (req, res) => {
  const tipo = req.params.tipo;
  const data = req.body;

  if (!data || Object.keys(data).length === 0)
    return res.status(400).json({ error: "Faltan datos en el cuerpo del request" });

  try {
    await saveAndPushToGitHub(tipo, data);
    res.json({ ok: true, mensaje: `✅ Datos de tipo '${tipo}' guardados y sincronizados con GitHub` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al guardar los datos en GitHub" });
  }
});

// 🔍 Obtener historial desde GitHub
app.get("/historial/:tipo", async (req, res) => {
  const tipo = req.params.tipo;
  const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${tipo}.json`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return res.json([]);
    const data = await resp.json();
    res.json(data);
  } catch {
    res.json([]);
  }
});

// 📂 Obtener tipos disponibles
app.get("/tipos", async (req, res) => {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/`;
  const resp = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  const files = await resp.json();
  const tipos = files
    .filter(f => f.name.endsWith(".json"))
    .map(f => f.name.replace(".json", ""));
  res.json(tipos);
});

// 🧩 Ruta raíz
app.get("/", (req, res) => {
  res.send("✅ API dinámica de almacenamiento — integrada con GitHub");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Servidor activo en puerto ${PORT}`));
