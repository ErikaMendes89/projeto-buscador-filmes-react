import { NotFoundError } from '../../shared/errors.js';
import type { UsersRepository } from './users.repository.js';

export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async getProfile(username: string) {
    const user = await this.users.findByUsername(username);
    if (!user) throw new NotFoundError('Perfil não encontrado');
    return user;
  }
}
