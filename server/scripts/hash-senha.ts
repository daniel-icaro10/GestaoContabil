// Gera o hash bcrypt de uma senha para usar em src/admin-seed.ts.
// Uso: npm --prefix server run hash-senha -- "minha senha"
import bcrypt from 'bcryptjs';

const senha = process.argv[2];
if (!senha || senha.length < 8) {
  console.error('Informe a senha (mínimo 8 caracteres): npm --prefix server run hash-senha -- "minha senha"');
  process.exit(1);
}
console.log(bcrypt.hashSync(senha, 12));
