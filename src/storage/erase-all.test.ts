import { SAMPLE_FEEDBACK } from '../feedback/fixtures';
import { eraseAllData } from './erase-all';
import { MIGRATIONS } from './migrations';
import { SqlMemoryRepository } from './memory-repository';
import { SqlProfileRepository } from './profile-repository';
import { SqlSessionRepository } from './session-repository';
import { SqlSettingsRepository } from './settings-repository';
import { createTestDatabase } from './test-database';

describe('eraseAllData', () => {
  it('esvazia todas as tabelas e mantém o esquema', async () => {
    const db = await createTestDatabase();
    await new SqlSettingsRepository(db).update({ languageCode: 'fr-FR' });
    await new SqlProfileRepository(db).save({
      languageCode: 'fr-FR',
      level: 'beginner',
      interests: '',
      goals: '',
    });
    await new SqlMemoryRepository(db).replace('fr-FR', {
      personal: ['Mora em Curitiba'],
      mistakes: ['Erro'],
      strengths: [],
    });
    const sessions = new SqlSessionRepository(db);
    const id = await sessions.create({
      languageCode: 'fr-FR',
      responseMode: 'quick',
      instructionVersion: 2,
      startedAt: new Date(),
      endedAt: new Date(),
      durationMs: 1000,
      endReason: 'user',
      totalTokens: 0,
      latenciesMs: [],
      feedbackStatus: 'pending',
      transcript: [{ speaker: 'user', text: 'Bonjour à tous' }],
    });
    await sessions.saveFeedback(id, SAMPLE_FEEDBACK, { model: 'm', promptVersion: 2 });

    await eraseAllData(db);

    const tables = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    for (const { name } of tables) {
      const [row] = await db.query(`SELECT COUNT(*) AS total FROM "${String(name)}"`);
      expect([name, row?.total]).toEqual([name, name === 'schema_version' ? MIGRATIONS.length : 0]);
    }
  });
});
