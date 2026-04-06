import { getPg } from '@infrastructure/db/postgres';

export class UserRepository {
  private get db() { return getPg(); }

  async createUser(id: string, email: string, passwordHash: string, name: string) {
    await this.db.query(
      `INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)`,
      [id, email, passwordHash, name]
    );
  }

  async findByEmail(email: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );
    return rows[0];
  }
}