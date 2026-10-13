# infrahub-monitor-api

API intermediária entre a extensão das TVs e o Supabase. A extensão nunca acessa o banco diretamente. A chave SUPABASE_SERVICE_ROLE_KEY existe apenas no servidor.

## Variáveis da Vercel

- SUPABASE_URL: URL do projeto Supabase.
- SUPABASE_SERVICE_ROLE_KEY: chave secreta do Supabase. Nunca colocar no navegador ou na extensão.
- ADMIN_SECRET: segredo administrativo longo e aleatório, usado apenas pelas rotas servidor-servidor.
- TV_ENROLLMENT_SECRET: segredo de cadastro usado pelo helper local instalado via Atera. Não embutir na extensão.
- CRON_SECRET: segredo para autenticar a tarefa diária de retenção de eventos.

As rotas de lifecycle dependem da migration supabase/migrations/202610130001_tv_lifecycle_foundation.sql. Revise e aplique primeiro em ambiente de teste; esta PR não aplica SQL nem faz deploy.

## Rotas

### Dispositivo
- POST /api/tv/registrar: cadastro pendente. Exige x-enrollment-secret, machine_uuid e hostname. O token retornado deve ser guardado localmente pelo helper/instalador.
- POST /api/heartbeat: heartbeat autenticado; atualiza URL atual e última atividade.
- GET /api/comandos?maquina_id=X&token=Y: entrega comandos e marca recebimento.
- POST /api/tv/comando-status: atualiza status do comando para executando, concluido ou falhou.
- POST /api/tv/eventos: recebe lotes de até 50 eventos diagnósticos.
- GET /api/tv/config?maquina_id=X&token=Y: lê configuração e perfil atribuídos à TV aprovada.

### Painel
- GET /api/admin/maquinas: lista TVs ativas e seus últimos status de comando.
- PUT /api/admin/maquinas: atualiza nome, URL esperada, configuração e perfil.
- DELETE /api/admin/maquinas: revoga a TV e faz soft delete; comandos e eventos são preservados.
- POST /api/admin/aprovar-maquina: aprova ou revoga uma TV.
- POST /api/admin/comandos: cria comando com prazo de 120 segundos.

Todas as rotas /api/admin/* exigem x-admin-secret e devem ser chamadas pelo backend autenticado do painel, nunca diretamente do navegador.

## Ciclo de vida

Novos dispositivos entram como pendente. O heartbeat, a consulta de comandos, os eventos e a configuração só são aceitos depois da aprovação. TVs antigas são marcadas como aprovadas pela migration para evitar interrupção imediata.

Comandos sem confirmação expiram após 120 segundos e são marcados como falhos. A rota /api/cron/limpar-eventos-tv remove eventos com mais de 14 dias e está agendada diariamente às 03:15 UTC. Configure CRON_SECRET na Vercel e confirme que o plano do projeto permite Cron Jobs antes de promover a alteração.

## Segurança e rollout

- Uma extensão Chrome/Edge não consegue consultar o hostname do Windows de forma confiável. Use um helper local gerenciado pelo Atera; mantenha o segredo de cadastro fora da extensão.
- O status mirror maquinas_tv_status tem uma política pública existente. Não a remova até verificar que a página pública Plantão lê o status por uma rota de servidor, porque Plantão deve continuar sem login.
- Faça primeiro a migration em teste, depois deploy de API e extensão compatíveis, valide um piloto e só então libere em lotes.
- Esta branch é uma proposta em draft. Não foi publicada em produção.
