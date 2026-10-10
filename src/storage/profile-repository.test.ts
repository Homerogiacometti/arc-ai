import type { LearnerProfile } from '../config/profile';
import { SqlProfileRepository } from './profile-repository';
import { createTestDatabase } from './test-database';

const profile: LearnerProfile = {
  languageCode: 'en-US',
  level: 'intermediate',
};

describe('SqlProfileRepository', () => {
  it('devolve null quando não há perfil para o idioma', async () => {
    const repository = new SqlProfileRepository(await createTestDatabase());
    expect(await repository.get('en-US')).toBeNull();
  });

  it('salva e atualiza o perfil por idioma', async () => {
    const repository = new SqlProfileRepository(await createTestDatabase());
    await repository.save(profile);
    await repository.save({ ...profile, languageCode: 'es-ES', level: 'beginner' });
    await repository.save({ ...profile, level: 'advanced' });

    expect(await repository.get('en-US')).toEqual({ ...profile, level: 'advanced' });
    expect((await repository.get('es-ES'))?.level).toBe('beginner');
  });

  it('remove o idioma da lista', async () => {
    const repository = new SqlProfileRepository(await createTestDatabase());
    await repository.save(profile);
    await repository.save({ languageCode: 'es-ES', level: 'beginner' });
    await repository.remove('en-US');
    expect((await repository.list()).map((item) => item.languageCode)).toEqual(['es-ES']);
  });

  it('rejeita perfil inválido', async () => {
    const repository = new SqlProfileRepository(await createTestDatabase());
    await expect(
      repository.save({ ...profile, level: 'expert' as LearnerProfile['level'] }),
    ).rejects.toThrow();
  });

  it('lista os perfis e ignora idioma que saiu da configuração', async () => {
    const db = await createTestDatabase();
    const repository = new SqlProfileRepository(db);
    await repository.save({ languageCode: 'fr-FR', level: 'beginner' });
    await db.run(
      "INSERT INTO learner_profile (language_code, level, updated_at) VALUES ('xx-XX', 'beginner', 'x')",
    );
    expect((await repository.list()).map((profile) => profile.languageCode)).toEqual(['fr-FR']);
  });
});
