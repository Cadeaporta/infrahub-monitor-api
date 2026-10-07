# infrahub-monitor-api

API intermediária entre a extensão (nas TVs) e o Supabase. A extensão nunca
fala direto com o banco — só com estas rotas.

## Deploy

1. `vercel --prod` dentro desta pasta (novo projeto, separado do InfraHub).
2. No painel da Vercel, em **Settings → Environment Variables**, adicione:
   - `SUPABASE_URL` — URL do projeto `infrahub` no Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY` — pegue em Supabase → Project Settings →
     API → `service_role` (secret). **Nunca** coloque essa key em código ou
     na extensão.
   - `ADMIN_SECRET` — qualquer string longa e aleatória, só sua.
3. Redeploy pra aplicar as variáveis.

## Cadastrar uma TV (uma vez por máquina)

```bash
curl -X POST https://SEU-DOMINIO.vercel.app/api/admin/cadastrar-maquina \
  -H "x-admin-secret: SEU_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"id":"tv-recepcao","nome":"TV Recepção","url_esperada":"https://infrahub-tv-plantao-5.vercel.app"}'
```

A resposta traz um `token` — copie, ele só aparece uma vez. É o valor que
vai no `chrome.storage.local` da extensão dessa TV específica.

## Rotas

- `POST /api/heartbeat` — body `{ maquina_id, token, url_atual }`. A
  extensão chama a cada ~30s.
- `GET /api/comandos?maquina_id=X&token=Y` — retorna comandos pendentes
  (ex.: `reload`) e já marca como executados.

## Por que assim

Cada TV carrega só o próprio token. Se vazar, dá pra forjar heartbeat ou
receber comando só daquela máquina — nunca escrever direto no banco nem
mexer nas outras TVs. A `service_role key` nunca sai do servidor.
