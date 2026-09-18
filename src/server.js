import express from 'express';
import cors from "cors";
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { loadConfig } from './config.js';
import { normalizeCpf, toCsv, WebFactaClient, WebFactaError } from './webfacta.js';

const config = loadConfig();
if (!config.apiKey) throw new Error('API_KEY é obrigatória.');

const client = new WebFactaClient({
  baseUrl: config.baseUrl,
  username: config.username,
  password: config.password,
  delayMs: config.delayMs
});

const app = express();

app.set("trust proxy", 1);

app.use(cors({
  origin: ["*"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"]
}));

app.use(helmet());
app.use(express.json({ limit: "100kb" }));


app.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use((req, res, next) => {
  const supplied = req.get('x-api-key');
  if (!supplied || supplied !== config.apiKey) {
    return res.status(401).json({ erro: 'Não autorizado.' });
  }
  next();
});

app.post('/consultar', async (req, res, next) => {
  try {
    if (!Array.isArray(req.body?.cpfs) || req.body.cpfs.length === 0) {
      return res.status(400).json({ erro: 'Envie { "cpfs": ["..."] }.' });
    }
    if (req.body.cpfs.length > config.maxCpfs) {
      return res.status(413).json({ erro: `Limite de ${config.maxCpfs} CPFs por requisição.` });
    }

    const cpfs = req.body.cpfs.map(normalizeCpf);
    const results = await client.consultarLista(cpfs);
    const wantsCsv = req.query.formato === 'csv' || req.accepts(['json', 'text/csv']) === 'text/csv';
    if (wantsCsv) {
      const filename = `resultado_consultas_${Date.now()}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(toCsv(results));
    }
    res.json({ total: results.length, resultados: results });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error instanceof WebFactaError ? error.status : 500;
  const code = error instanceof WebFactaError ? error.code : 'INTERNAL_ERROR';
  console.error(`[${code}] ${error.message}`);
  res.status(status).json({ erro: error.message, codigo: code });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`API ouvindo em 0.0.0.0:${config.port}`);
});
