# Diagnóstico Tributário Empresarial

Sistema de comparação de regimes tributários (Simples Nacional, Lucro Presumido e Lucro Real) com controle de usuários,
permissões por tela e assinatura paga via **Banco Cora** (boleto + PIX).

## Estrutura

```
server/   API Node.js (Express + PostgreSQL) — autenticação, permissões, empresas, assinaturas e integração Cora
web/      Frontend React + Vite + Tailwind — telas do sistema e área administrativa
```

## Como rodar

```bash
npm run install:all        # instala dependências da raiz, server e web
npm run dev                # API em :3333 e frontend em http://localhost:5173
```

Produção (a API serve o frontend compilado na mesma porta):

```bash
npm run build
npm start                  # http://localhost:3333
```

**Administrador:** o sistema já vem com o administrador pré-cadastrado definido em `server/src/admin-seed.ts` (o código guarda apenas o e-mail e o hash bcrypt da senha). Ele é criado na primeira inicialização e nunca é sobrescrito — troque a senha em *Meu Perfil*. Para mudar o admin padrão, gere um hash com `npm --prefix server run hash-senha -- "nova senha"` e substitua no arquivo. Se não houver nenhum administrador, o primeiro acesso exibe a tela `/setup` para criá-lo. Copie `server/.env.example` para `server/.env` para configurar.

O banco é **PostgreSQL** (defina `DATABASE_URL` em `server/.env`). As tabelas são criadas automaticamente na inicialização pelas migrações em `server/src/migrations` (cada arquivo `.sql` é aplicado uma única vez, em ordem). Para mudar o banco, crie um novo arquivo numerado (ex.: `002_....sql`) — nunca edite um já aplicado. Guarde o `APP_SECRET` (ou o arquivo `data/.secret`).
Sem o segredo, as credenciais da Cora não podem ser descriptografadas.

## Perfis e permissões

As permissões são por **módulo**. Cada módulo libera um conjunto de telas:

| Módulo            | Telas                                              |
| ----------------- | -------------------------------------------------- |
| Principal         | Dashboard, Nova Análise, Empresas                  |
| Dados Financeiros | Faturamento, Folha, Custos e Despesas, Créditos    |
| Simulações        | Simples Nacional, Lucro Presumido, Lucro Real      |
| Análise           | Comparativo, Cenários, Diagnóstico                 |
| Relatórios        | Relatórios                                         |
| Configurações     | Parâmetros tributários do usuário                  |

- **Administrador**: acesso a todos os módulos e à área de Administração (usuários, planos, faturas, integração Cora,
  sistema). Não precisa de assinatura.
- **Usuário (membro)**: vê apenas os módulos liberados pelo admin em *Administração › Usuários e Permissões*. Novos
  cadastros começam **sem módulos** (o admin libera); isso pode ser alterado em *Administração › Sistema*.
- As permissões também são aplicadas na API: cadastrar/excluir empresas exige *Principal*, editar dados exige
  *Principal* ou *Dados Financeiros* e alterar parâmetros tributários exige *Configurações*.

## Assinaturas com a Cora

1. Em *Administração › Integração Cora*, informe o **Client ID**, o **certificado** e a **chave privada** (Integração
   Direta, mTLS) e clique em *Testar conexão*. A chave é armazenada com criptografia AES-256-GCM.
2. Defina `PUBLIC_URL` (HTTPS público) e clique em *Registrar webhook na Cora*. Os pagamentos passam a liberar o acesso
   na hora. Sem webhook, o sistema consulta as faturas abertas a cada 30 minutos.
3. Cadastre os planos em *Administração › Planos* (valor mínimo de R$ 5,00).

Fluxo do usuário: cadastro → *Assinatura* → escolhe o plano → recebe boleto + PIX (QR Code e copia-e-cola) → pagamento
confirmado (webhook ou consulta) → acesso liberado pelo período do plano. A renovação é emitida automaticamente alguns
dias antes do vencimento, e há tolerância configurável após o vencimento.

O admin também pode dar baixa manual, cancelar cobranças, emitir cobranças, liberar acesso por cortesia e, no ambiente
Stage, simular o pagamento de um boleto.

## Aviso

Os cálculos tributários têm caráter estimativo e gerencial. Recomenda-se validação por profissional contábil.

## Deploy na VPS (Docker)

Produção roda na VPS com Docker Compose (`docker-compose.vps.yml`): um container da aplicação e um PostgreSQL 16
próprio (sem porta exposta; dados no volume `gestaocontabil-pg`). O Easypanel/Traefik da VPS cuida do domínio e HTTPS.

Primeira instalação (em `/opt/gestaocontabil`):

```bash
git clone <repositório> /opt/gestaocontabil && cd /opt/gestaocontabil
cp .env.vps.example .env.vps && chmod 600 .env.vps   # preencha POSTGRES_PASSWORD e APP_SECRET
docker compose -f docker-compose.vps.yml --env-file .env.vps up -d --build
```

Atualizar:

```bash
cd /opt/gestaocontabil && git pull && docker compose -f docker-compose.vps.yml --env-file .env.vps up -d --build
```

- Sem domínio: `http://IP-DA-VPS:3500`. Com domínio: no Easypanel, aponte o domínio para a porta `3500` do host e
  defina `PUBLIC_URL=https://seu-dominio` no `.env.vps` (necessário para o webhook da Cora).
- Backup do banco:
  `docker compose -f docker-compose.vps.yml exec -T postgres pg_dump -U gestaocontabil gestaocontabil | gzip > backups/$(date +%F).sql.gz`
- Logs: `docker compose -f docker-compose.vps.yml logs -f app`
