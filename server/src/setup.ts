import { get } from './db.js';
import { deleteSetting } from './settings.js';

// Configuração inicial: enquanto não existir administrador, o primeiro acesso cria a conta pela tela /setup.
// Assim que o administrador é criado, a tela deixa de existir.

export async function needsSetup() {
  return !(await get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`));
}

export async function announceSetup() {
  // Remove resquícios da versão anterior, que exigia código de configuração.
  await deleteSetting('setup');
  console.log('');
  console.log('================================================================');
  console.log(' CONFIGURAÇÃO INICIAL — nenhum administrador cadastrado.');
  console.log(' Acesse o sistema no navegador para criar a conta de administrador.');
  console.log('================================================================');
  console.log('');
}
