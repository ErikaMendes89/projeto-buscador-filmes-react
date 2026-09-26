import { AppError, NotFoundError } from '../../shared/errors.js';
import type { UsersRepository } from './users.repository.js';

export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async getProfile(username: string) {
    const user = await this.users.findByUsername(username);
    if (!user) throw new NotFoundError('Perfil não encontrado');
    return user;
  }

  async updateProfile(userId: string, input: { username: string; displayName: string; bio: string | null }) {
    try {
      const user = await this.users.updateProfile(userId, input);
      if (!user) throw new NotFoundError('Perfil não encontrado');
      return user;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new AppError('Username indisponível', 409, 'username_unavailable');
      }
      throw error;
    }
  }
}
