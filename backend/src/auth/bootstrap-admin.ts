import 'dotenv/config';
import { UsersService } from './users.service.js';
const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_NAME) throw new Error('Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_NAME for this one-time command.');
const result = await new UsersService().create({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, fullName: ADMIN_NAME, role: 'ADMIN', isActive: true }, true);
console.log('message' in result ? result.message : `Administrateur créé : ${result.email}`);
