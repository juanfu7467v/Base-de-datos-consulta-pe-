import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Variables de entorno (debes configurarlas en Fly.io)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Token personal con permisos de escritura
const GITHUB_REPO = process.env.GITHUB_REPO;   // Ejemplo: "usuario/repositorio"

// 🧠 Función para guardar datos directamente en GitHub
async function saveToGitHub(tipo, data) {
  const filePath = `storage/${tipo}.json`;
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;

  // 📦 Obtener el archivo actual en GitHub
  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  let existing = [];
  let sha = null;

  if (res.ok) {
    const json = await res.json();
    sha = json.sha;
    const content = Buffer.from(json.content, "base64").toString();
    existing = JSON.parse(content);
  }

  // 🔖 Agregar nuevo registro con ID y fecha
  existing.push({
    id: data.id || Date.now(),
    ...data,
    fecha: new Date().toISOString(),
  });

  // 🧬 Codificar y subir a GitHub
  const newContent = Buffer.from(JSON.stringify(existing, null, 2)).toString("base64");
  const message = `Guardar datos tipo ${tipo}`;

  const saveRes = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      message,
      content: newContent,
      sha, // se incluye solo si ya existía el archivo
    }),
  });

  if (!saveRes.ok) throw new Error("Error al guardar en GitHub");
}

// 📌 Ruta universal para GUARDAR usando GET
app.get("/guardar/:tipo", async (req, res) => {
  const tipo = req.params.tipo;
  const data = req.query; // los datos vienen en la URL como ?clave=valor

  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Faltan parámetros en la URL" });
  }

  try {
    await saveToGitHub(tipo, data);
    res.json({ ok: true, mensaje: `Datos de tipo '${tipo}' guardados correctamente en GitHub`, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar los datos en GitHub" });
  }
});

// 📄 Ruta para obtener historial (GET)
app.get("/historial/:tipo", async (req, res) => {
  const tipo = req.params.tipo;
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/storage/${tipo}.json`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) return res.json([]);

    const json = await response.json();
    const content = Buffer.from(json.content, "base64").toString();
    res.json(JSON.parse(content));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener los datos desde GitHub" });
  }
});

// 🧩 Ruta raíz
app.get("/", (req, res) => {
  res.send(`
    ✅ API dinámica de almacenamiento — Consulta PE (GET compatible)
    <br><br>Ejemplo para guardar:
    <br>https://base-datos-consulta-pe.fly.dev/guardar/ruc?ruc=10456789012&razon_social=Tienda+Prueba+SAC&direccion=Av+Principal+999&estado=Activo&id=1
    <br><br>Ejemplo para ver historial:
    <br>https://base-datos-consulta-pe.fly.dev/historial/ruc
  `);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Servidor activo en puerto ${PORT}`));
