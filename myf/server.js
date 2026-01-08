import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const staticRoot = process.env.STATIC_ROOT || 'dist';
const fullStaticPath = path.join(__dirname, staticRoot);

app.use(express.static(fullStaticPath));

// SPA fallback: return index.html for any non-file route
app.get('*', (req, res) => {
  res.sendFile(path.join(fullStaticPath, 'index.html'));
});

const port = process.env.PORT || 8000; // Databricks will map externally
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}, serving ${fullStaticPath}`);
});