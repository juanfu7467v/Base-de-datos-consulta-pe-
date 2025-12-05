import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
// Middleware para parsear JSON en las peticiones POST/PUT/PATCH
app.use(express.json()); 
// Middleware para parsear datos de formularios (url-encoded)
app.use(express.urlencoded({ extended: true }));

// 🔑 Variables de entorno (debes configurarlas en Fly.io)
// Token personal con permisos de escritura
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
// Ejemplo: "usuario/repositorio"
const GITHUB_REPO = process.env.GITHUB_REPO; 

// 🧠 Función para guardar datos directamente en GitHub
async function saveToGitHub(tipo, data) {
    // La ruta es 'storage/tipo.json'
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
        // Puede fallar si el contenido no es JSON, por lo que se usa un try/catch
        try {
            existing = JSON.parse(content);
        } catch (e) {
            console.warn(`[WARN] El archivo ${filePath} no es un JSON válido. Sobrescribiendo.`);
            existing = [];
        }
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
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            message,
            content: newContent,
            // Se incluye solo si ya existía el archivo
            sha, 
        }),
    });

    if (!saveRes.ok) {
        const errorText = await saveRes.text();
        throw new Error(`Error al guardar en GitHub: ${saveRes.status} - ${errorText}`);
    }
}

---

### 📥 Ruta para Guardar **Datos Sensibles/Largos** (POST)

Esta ruta usa el **cuerpo de la petición (req.body)** para guardar los datos. Es ideal para la `session string` de Telegram.

```javascript
// 📌 Ruta para GUARDAR datos sensibles o largos usando POST
app.post("/guardar-post/:tipo", async (req, res) => {
    const tipo = req.params.tipo;
    // Los datos vienen en el cuerpo de la petición (JSON)
    const data = req.body; 

    if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({ error: "Faltan datos en el cuerpo de la petición (JSON)" });
    }

    try {
        await saveToGitHub(tipo, data);
        res.json({ 
            ok: true, 
            mensaje: `Datos de tipo '${tipo}' guardados correctamente en GitHub vía POST`, 
            data: { id: data.id || Date.now(), ...data, fecha: new Date().toISOString() } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al guardar los datos en GitHub", detalle: err.message });
    }
});
