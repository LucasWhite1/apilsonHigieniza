import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const LOGIN_PATH = '/login.php';
const QUERY_PATH = '/regrasProposta.php';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class WebFactaError extends Error {
  constructor(message, code = 'WEBFACTA_ERROR', status = 502) {
    super(message);
    this.name = 'WebFactaError';
    this.code = code;
    this.status = status;
  }
}

export function normalizeCpf(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits || digits.length > 11) {
    throw new WebFactaError('CPF deve conter entre 1 e 11 dígitos.', 'CPF_INVALIDO', 400);
  }
  return digits.padStart(11, '0');
}

function isLoginPage(response) {
  const finalUrl = response?.request?.res?.responseUrl || '';
  const body = typeof response?.data === 'string' ? response.data : '';
  return finalUrl.includes('/login.php') || /id=["'](?:login|btnLogin)["']/i.test(body);
}

export class WebFactaClient {
  constructor({ baseUrl, username, password, delayMs = 1000 }) {
    if (!baseUrl || !username || !password) {
      throw new Error('WEBFACTA_BASE_URL, WEBFACTA_USER e WEBFACTA_PASSWORD são obrigatórios.');
    }

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.username = username;
    this.password = password;
    this.delayMs = Math.max(0, Number(delayMs) || 0);
    this.jar = new CookieJar();
    this.authenticated = false;
    this.loginPromise = null;
    this.queue = Promise.resolve();

    this.http = wrapper(axios.create({
      baseURL: this.baseUrl,
      jar: this.jar,
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/145 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    }));
  }

  async login({ force = false } = {}) {
    if (this.authenticated && !force) return;
    if (this.loginPromise) return this.loginPromise;

    this.loginPromise = this.#performLogin();
    try {
      await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  async #performLogin() {
    await this.http.get(LOGIN_PATH, { headers: { Accept: 'text/html' } });

    const payload = new URLSearchParams({
      login: this.username,
      senha: this.password,
      grecaptcha_response: '',
      api_ip_1: '',
      api_ip_2: '',
      api_ip_3: ''
    });

    const response = await this.http.post(LOGIN_PATH, payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
    });
    const data = response.data ?? {};

    if (data.recaptcha_required) {
      throw new WebFactaError(
        'O WebFacta exigiu reCAPTCHA. Faça uma autenticação humana; a API não tenta contornar CAPTCHA.',
        'RECAPTCHA_REQUIRED',
        409
      );
    }
    if (data.token) {
      throw new WebFactaError(
        'O WebFacta exigiu código de autenticação em duas etapas.',
        'TWO_FACTOR_REQUIRED',
        409
      );
    }
    if (data.probe) {
      throw new WebFactaError(
        'O WebFacta solicitou validação de rede/VPN. Configure a VPS na rede autorizada.',
        'VPN_PROBE_REQUIRED',
        409
      );
    }

    const accepted = data.logado === true || (data.erro === false && data.logado !== undefined);
    if (!accepted) {
      throw new WebFactaError(data.mensagem || 'Usuário ou senha rejeitados pelo WebFacta.', 'LOGIN_FAILED', 401);
    }

    const check = await this.http.get('/dashboard.php', { headers: { Accept: 'text/html' } });
    if (isLoginPage(check)) {
      throw new WebFactaError('O WebFacta não manteve a sessão após o login.', 'SESSION_FAILED', 502);
    }
    this.authenticated = true;
  }

  async consultarCpf(cpf, retry = true) {
    await this.login();
    const normalizedCpf = normalizeCpf(cpf);
    const body = new URLSearchParams({ cpf: normalizedCpf, acao: 'CPF' });
    const response = await this.http.post(QUERY_PATH, body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: `${this.baseUrl}/propostaDigitadasBanco.php`
      },
      responseType: 'text',
      transformResponse: [(data) => data]
    });

    if (isLoginPage(response) && retry) {
      this.authenticated = false;
      await this.login({ force: true });
      return this.consultarCpf(normalizedCpf, false);
    }

    return {
      cpf: normalizedCpf,
      sucesso: response.status >= 200 && response.status < 300,
      resposta: String(response.data).replace(/[\r\n]+/g, ' ')
    };
  }

  async consultarLista(cpfs) {
    const run = this.queue.then(() => this.#consultarListaSequencial(cpfs));
    this.queue = run.catch(() => undefined);
    return run;
  }

  async #consultarListaSequencial(cpfs) {
    const results = [];
    for (let index = 0; index < cpfs.length; index += 1) {
      try {
        results.push(await this.consultarCpf(cpfs[index]));
      } catch (error) {
        results.push({
          cpf: normalizeCpf(cpfs[index]),
          sucesso: false,
          resposta: `ERRO: ${error.message}`
        });
      }
      if (index < cpfs.length - 1 && this.delayMs > 0) await sleep(this.delayMs);
    }
    return results;
  }
}

export function toCsv(results) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = ['CPF;Sucesso;Resposta'];
  for (const row of results) {
    rows.push([row.cpf, row.sucesso, row.resposta].map(escape).join(';'));
  }
  return `\uFEFF${rows.join('\n')}\n`;
}
