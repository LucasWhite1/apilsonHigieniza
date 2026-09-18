import 'dotenv/config';

export function loadConfig() {
  return {
    port: Number(process.env.PORT || 4545),
    apiKey: process.env.API_KEY || '',
    baseUrl: process.env.WEBFACTA_BASE_URL || 'https://desenv.facta.com.br/sistemaNovo',
    username: process.env.WEBFACTA_USER || '',
    password: process.env.WEBFACTA_PASSWORD || '',
    delayMs: Number(process.env.REQUEST_DELAY_MS || 1000),
    maxCpfs: Number(process.env.MAX_CPFS_PER_REQUEST || 100)
  };
}
