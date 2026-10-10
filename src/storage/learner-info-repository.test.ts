import { SqlLearnerInfoRepository } from './learner-info-repository';
import { SqlProfileRepository } from './profile-repository';
import { migrate, MIGRATIONS } from './migrations';
import { createTestDatabase } from './test-database';

describe('SqlLearnerInfoRepository', () => {
  it('devolve vazio quando não há nada salvo', async () => {
    const repository = new SqlLearnerInfoRepository(await createTestDatabase());
    expect(await repository.get()).toEqual({ interests: '', goals: '' });
  });

  it('salva e atualiza interesses e objetivos', async () => {
    const repository = new SqlLearnerInfoRepository(await createTestDatabase());
    await repository.save({ interests: 'viagens', goals: '' });
    await repository.save({ interests: 'viagens', goals: '  entrevista  ' });
    expect(await repository.get()).toEqual({ interests: 'viagens', goals: 'entrevista' });
  });

  it('a migration 6 traz os interesses do perfil do idioma atual', async () => {
    const db = await createTestDatabase({ migrate: false });
    await migrate(
      db,
      MIGRATIONS.filter((migration) => migration.version < 6),
    );
    await db.run(
      "INSERT INTO settings (id, language_code, response_mode, pause_level) VALUES (1, 'es-ES', 'balanced', 'normal')",
    );
    await db.run(
      `INSERT INTO learner_profile (language_code, level, interests, goals, updated_at) VALUES
       ('en-US', 'advanced', 'outro', '', 'x'),
       ('es-ES', 'beginner', 'futebol', 'viajar', 'x')`,
    );
    await migrate(db);

    expect(await new SqlLearnerInfoRepository(db).get()).toEqual({
      interests: 'futebol',
      goals: 'viajar',
    });
    expect(await new SqlProfileRepository(db).get('es-ES')).toEqual({
      languageCode: 'es-ES',
      level: 'beginner',
    });
  });
});
