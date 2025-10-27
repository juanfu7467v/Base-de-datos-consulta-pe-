import express from "express";
import cors from "cors";
import fs from "fs-extra";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

// 📁 Carpeta donde guardaremos los datos
const STORAGE_DIR = path.join(process.cwd(), "storage");
await fs.ensureDir(STORAGE_DIR);

// ✅ Función genérica para guardar consultas
async function saveData(file, data) {
  const filePath = path.join(STORAGE_DIR, file);
  const existing = (await fs.readJson(filePath, { throws: false })) || [];
  existing.push({ ...data, fecha: new Date().toISOString() });
  await fs.writeJson(filePath, existing, { spaces: 2 });
}

// 🧠 Ejemplo 1: Guardar consultas por DNI y nombres
app.post("/guardar_dni_nombres", async (req, res) => {
  const { nombres, apellidos, dni, resultado } = req.body;
  if (!nombres || !apellidos || !dni)
    return res.status(400).json({ error: "Faltan datos" });

  await saveData("dni_nombres.json", { nombres, apellidos, dni, resultado });
  res.json({ ok: true, mensaje: "Consulta almacenada correctamente" });
});

// 🌳 Ejemplo 2: Guardar árbol genealógico
app.post("/guardar_arbol", async (req, res) => {
  const { dni, arbol } = req.body;
  if (!dni || !arbol)
    return res.status(400).json({ error: "Faltan datos" });

  await saveData("arbol.json", { dni, arbol });
  res.json({ ok: true, mensaje: "Árbol guardado exitosamente" });
});

// 🔍 Ejemplo 3: Obtener todas las consultas almacenadas
app.get("/historial/:tipo", async (req, res) => {
  const file = `${req.params.tipo}.json`;
  const filePath = path.join(STORAGE_DIR, file);
  if (!(await fs.pathExists(filePath)))
    return res.json([]);

  const data = await fs.readJson(filePath);
  res.json(data);
});

// 🧩 Ruta raíz
app.get("/", (req, res) => {
  res.send("✅ API de almacenamiento Consulta PE activa.");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Servidor activo en puerto ${PORT}`));
