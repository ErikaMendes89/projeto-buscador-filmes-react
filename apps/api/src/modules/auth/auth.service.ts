import { NotFoundError } from '../../shared/errors.js';
import type { UsersRepository } from '../users/users.repository.js';

export class AuthService {
  constructor(private readonly users: UsersRepository) {}

  async getSession(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuário da sessão não encontrado');
    return { user };
  }
}
