import { get, run } from './db.js';

// Configuração inicial: enquanto não existir administrador, o primeiro acesso cria a conta pela tela /setup.
// Assim que o administrador é criado, a tela deixa de existir.

export function needsSetup() {
  return !get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
}

export function announceSetup() {
  // Remove resquícios da versão anterior, que exigia código de configuração.
  run(`DELETE FROM settings WHERE key = 'setup'`);
  console.log('');
  console.log('================================================================');
  console.log(' CONFIGURAÇÃO INICIAL — nenhum administrador cadastrado.');
  console.log(' Acesse o sistema no navegador para criar a conta de administrador.');
  console.log('================================================================');
  console.log('');
}
