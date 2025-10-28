import express from "express";
import cors from "cors";
import fs from "fs-extra";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

// 📁 Carpeta principal de almacenamiento
const STORAGE_DIR = path.join(process.cwd(), "storage");
await fs.ensureDir(STORAGE_DIR);

// ✅ Función genérica: crea o actualiza archivos automáticamente
async function saveDynamicData(tipo, data) {
  const fileName = `${tipo}.json`;
  const filePath = path.join(STORAGE_DIR, fileName);
  const existing = (await fs.readJson(filePath, { throws: false })) || [];
  existing.push({ ...data, fecha: new Date().toISOString() });
  await fs.writeJson(filePath, existing, { spaces: 2 });
}

// 🧠 Ruta universal para guardar cualquier tipo de dato
app.post("/guardar/:tipo", async (req, res) => {
  const tipo = req.params.tipo; // Ejemplo: "dni_nombres", "ruc", "telefonos", etc.
  const data = req.body;

  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Faltan datos en el cuerpo del request" });
  }

  try {
    await saveDynamicData(tipo, data);
    res.json({ ok: true, mensaje: `Datos de tipo '${tipo}' guardados correctamente` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al guardar los datos" });
  }
});

// 🔍 Obtener historial según tipo
app.get("/historial/:tipo", async (req, res) => {
  const tipo = req.params.tipo;
  const filePath = path.join(STORAGE_DIR, `${tipo}.json`);
  if (!(await fs.pathExists(filePath))) {
    return res.json([]);
  }

  const data = await fs.readJson(filePath);
  res.json(data);
});

// 📂 Obtener todos los tipos de archivos disponibles
app.get("/tipos", async (req, res) => {
  const files = await fs.readdir(STORAGE_DIR);
  const tipos = files.filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
  res.json(tipos);
});

// 🧩 Ruta raíz
app.get("/", (req, res) => {
  res.send("✅ API dinámica de almacenamiento — Consulta PE");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Servidor activo en puerto ${PORT}`));
