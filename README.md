# Diagnóstico Tributário Empresarial

Sistema de comparação de regimes tributários (Simples Nacional, Lucro Presumido e Lucro Real) com controle de usuários,
permissões por tela e assinatura paga via **Banco Cora** (boleto + PIX).

## Estrutura

```
server/   API Node.js (Express + SQLite via sql.js) — autenticação, permissões, empresas, assinaturas e integração Cora
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

Os dados ficam em `server/data/app.sqlite`. Faça backup dessa pasta e do arquivo `data/.secret` (ou defina `APP_SECRET`).
Sem o segredo, as credenciais da Cora não podem ser descriptografadas.

## Perfis e permissões

- **Administrador**: acesso a todas as telas e à área de Administração (usuários, planos, faturas, integração Cora,
  sistema). Não precisa de assinatura.
- **Usuário**: vê apenas as telas liberadas pelo admin em *Administração › Usuários e Permissões*. As permissões padrão
  de novos cadastros ficam em *Administração › Sistema*.

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

## Deploy no Render

O arquivo `render.yaml` (Blueprint) já define tudo: build, start, health check, disco persistente em `/var/data` e
variáveis de ambiente.

1. Envie este repositório para o GitHub.
2. No Render: **New › Blueprint**, selecione o repositório e confirme.
3. Nenhuma credencial é configurada no Render. O `APP_SECRET` é gerado automaticamente.
4. Após o deploy, acesse `https://<servico>.onrender.com` e entre com o administrador pré-cadastrado. Em seguida configure a Cora. A URL do webhook já
   usa o endereço público do Render (`RENDER_EXTERNAL_URL`).

> O plano **Starter** é necessário por causa do disco persistente. No plano Free o sistema de arquivos é apagado a cada
> deploy/reinício e todos os dados (usuários, empresas, faturas) seriam perdidos.
