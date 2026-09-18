# WebFacta CPF API

API privada que autentica no WebFacta, mantém os cookies de sessão e consulta CPFs sequencialmente.

## Uso local

1. Copie `.env.example` para `.env` e preencha os segredos.
2. Rode `npm install`.
3. Rode `npm start`.

Exemplo JSON:

```bash
curl -X POST http://localhost:3000/consultar \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_API_KEY" \
  -d '{"cpfs":["12345678912","2855325536","5325536"]}'
```

Para CSV, use `POST /consultar?formato=csv`.

## EasyPanel

- Crie um app a partir deste repositório usando o `Dockerfile`.
- Exponha a porta `3000`.
- Cadastre como variáveis/segredos: `API_KEY`, `WEBFACTA_USER`, `WEBFACTA_PASSWORD` e `WEBFACTA_BASE_URL`.
- Opcionalmente ajuste `REQUEST_DELAY_MS` e `MAX_CPFS_PER_REQUEST`.

Não publique a API sem `x-api-key`. CPFs e respostas podem conter dados pessoais; use HTTPS, controle de acesso e retenção mínima.

O serviço não contorna CAPTCHA, 2FA nem restrições de VPN/IP. Se o WebFacta passar a exigir algum deles, a API responde com um erro explícito para intervenção humana ou configuração de rede autorizada.
