import fs from 'node:fs/promises';
import { loadConfig } from './config.js';
import { toCsv, WebFactaClient } from './webfacta.js';

const cpfs = process.argv.slice(2);
if (cpfs.length === 0) {
  console.error('Uso: npm run consulta -- 12345678912 2855325536 5325536');
  process.exit(1);
}

const config = loadConfig();
const client = new WebFactaClient({
  baseUrl: config.baseUrl,
  username: config.username,
  password: config.password,
  delayMs: config.delayMs
});

const results = await client.consultarLista(cpfs);
const output = `resultado_consultas_${Date.now()}.csv`;
await fs.writeFile(output, toCsv(results), 'utf8');
console.log(output);
