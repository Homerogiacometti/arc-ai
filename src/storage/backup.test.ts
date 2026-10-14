import { SAMPLE_FEEDBACK } from '../feedback/fixtures';
import { BackupError, describeBackup, exportBackup, importBackup, parseBackup } from './backup';
import type { Database } from './database';
import { SqlLearnerInfoRepository } from './learner-info-repository';
import { SqlMemoryRepository } from './memory-repository';
import { MIGRATIONS } from './migrations';
import { SqlPlanRepository } from './plan-repository';
import { SqlProfileRepository } from './profile-repository';
import { SqlSessionRepository } from './session-repository';
import { SqlSettingsRepository } from './settings-repository';
import { createTestDatabase } from './test-database';

async function fill(db: Database) {
  await new SqlSettingsRepository(db).update({ languageCode: 'es-ES', voice: 'Kore' });
  await new SqlProfileRepository(db).save({
    languageCode: 'es-ES',
    level: 'beginner',
  });
  await new SqlLearnerInfoRepository(db).save({ interests: 'fútbol', goals: '' });
  await new SqlMemoryRepository(db).replace('es-ES', {
    personal: ['Mora em Recife'],
    mistakes: ['Confunde ser e estar'],
    strengths: [],
  });
  await new SqlPlanRepository(db).save('es-ES', { daysPerWeek: 3, minutesPerDay: 15 });
  const sessions = new SqlSessionRepository(db);
  const id = await sessions.create({
    languageCode: 'es-ES',
    responseMode: 'quick',
    instructionVersion: 2,
    startedAt: new Date('2026-10-08T10:00:00Z'),
    endedAt: new Date('2026-10-08T10:05:00Z'),
    durationMs: 300_000,
    endReason: 'user',
    totalTokens: 900,
    latenciesMs: [700],
    feedbackStatus: 'pending',
    transcript: [
      { speaker: 'ai', text: '¡Hola!' },
      { speaker: 'user', text: 'Hola, ¿qué tal?' },
    ],
  });
  await sessions.saveFeedback(id, SAMPLE_FEEDBACK, { model: 'm', promptVersion: 2 });
  return id;
}

async function snapshot(db: Database) {
  const sessions = new SqlSessionRepository(db);
  const [first] = await sessions.list();
  return {
    settings: await new SqlSettingsRepository(db).get(),
    profiles: await new SqlProfileRepository(db).list(),
    info: await new SqlLearnerInfoRepository(db).get(),
    memory: await new SqlMemoryRepository(db).forLanguage('es-ES'),
    plans: await new SqlPlanRepository(db).list('es-ES'),
    session: first ? await sessions.get(first.id) : null,
  };
}

describe('backup', () => {
  it('exporta e importa tudo em outro aparelho, sem perder nada', async () => {
    const source = await createTestDatabase();
    await fill(source);
    const backup = await exportBackup(source, new Date('2026-10-09T12:00:00Z'));
    expect(backup).toMatchObject({
      app: 'arc-ai',
      format: 1,
      schemaVersion: MIGRATIONS.length,
    });
    expect(describeBackup(backup)).toEqual({
      exportedAt: new Date('2026-10-09T12:00:00Z'),
      sessions: 1,
    });

    const target = await createTestDatabase();
    await importBackup(target, parseBackup(JSON.stringify(backup)));
    expect(await snapshot(target)).toEqual(await snapshot(source));
    expect((await snapshot(target)).session?.feedback).toEqual(SAMPLE_FEEDBACK);
  });

  it('importar substitui os dados que já existiam', async () => {
    const source = await createTestDatabase();
    const backup = await exportBackup(source);
    const target = await createTestDatabase();
    await fill(target);
    await importBackup(target, backup);
    expect(await new SqlSessionRepository(target).list()).toEqual([]);
    expect(await new SqlMemoryRepository(target).list()).toEqual([]);
  });

  it('recusa arquivos que não são backup', () => {
    expect(() => parseBackup('isso não é json')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"outro"}')).toThrow('não é um backup do Arc AI');
  });

  it('recusa backup de versão mais nova, tabela ou coluna desconhecida, sem mudar nada', async () => {
    const db = await createTestDatabase();
    await fill(db);
    const backup = await exportBackup(db);
    const before = await snapshot(db);

    await expect(importBackup(db, { ...backup, schemaVersion: 999 })).rejects.toThrow(
      'versão mais nova',
    );
    await expect(
      importBackup(db, { ...backup, tables: { ...backup.tables, hacker: [{ x: 1 }] } }),
    ).rejects.toThrow('não reconhece');
    await expect(
      importBackup(db, {
        ...backup,
        tables: { ...backup.tables, memory: [{ 'content" ) --': 'x' }] },
      }),
    ).rejects.toThrow('não reconhece');
    expect(await snapshot(db)).toEqual(before);
  });

  it('desfaz tudo se uma linha for recusada pelo banco', async () => {
    const db = await createTestDatabase();
    await fill(db);
    const backup = await exportBackup(db);
    const before = await snapshot(db);
    const broken = {
      ...backup,
      tables: {
        ...backup.tables,
        memory: [
          { kind: 'personal', language_code: 'en-US', position: 0, content: 'x', updated_at: 'x' },
        ],
      },
    };
    await expect(importBackup(db, broken)).rejects.toThrow('Nada foi alterado');
    expect(await snapshot(db)).toEqual(before);
  });

  it('importa backup de uma versão anterior do banco (sem a coluna da voz)', async () => {
    const db = await createTestDatabase();
    await fill(db);
    const backup = await exportBackup(db);
    const settingsRows = (backup.tables.settings ?? []).map((row) =>
      Object.fromEntries(Object.entries(row).filter(([column]) => column !== 'voice')),
    );
    await importBackup(db, {
      ...backup,
      schemaVersion: 3,
      tables: { ...backup.tables, settings: settingsRows },
    });
    expect(await new SqlSettingsRepository(db).get()).toMatchObject({
      languageCode: 'es-ES',
      voice: 'Puck',
    });
  });

  it('backup anterior aos interesses gerais traz os interesses do perfil do idioma atual', async () => {
    const db = await createTestDatabase();
    await fill(db);
    const backup = await exportBackup(db);
    const tables = Object.fromEntries(
      Object.entries(backup.tables).filter(([table]) => table !== 'learner_info'),
    );
    tables.learner_profile = (tables.learner_profile ?? []).map((row) => ({
      ...row,
      interests: 'tapas',
    }));
    await importBackup(db, { ...backup, schemaVersion: 5, tables });
    expect(await new SqlLearnerInfoRepository(db).get()).toEqual({
      interests: 'tapas',
      goals: '',
    });
  });

  it('backup anterior ao plano por idioma copia o plano para cada idioma do backup', async () => {
    const db = await createTestDatabase();
    await fill(db);
    await new SqlProfileRepository(db).save({ languageCode: 'en-US', level: 'advanced' });
    const backup = await exportBackup(db);
    const tables = {
      ...backup.tables,
      practice_plan: (backup.tables.practice_plan ?? [])
        .filter((row) => row.language_code === 'es-ES')
        .map((row) =>
          Object.fromEntries(Object.entries(row).filter(([column]) => column !== 'language_code')),
        ),
    };
    await importBackup(db, { ...backup, schemaVersion: 6, tables });
    const plans = new SqlPlanRepository(db);
    const expected = [{ daysPerWeek: 3, minutesPerDay: 15 }];
    expect(await plans.list('es-ES')).toMatchObject(expected);
    expect(await plans.list('en-US')).toMatchObject(expected);
  });
});
