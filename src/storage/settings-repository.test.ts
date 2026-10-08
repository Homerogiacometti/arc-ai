import { DEFAULT_SETTINGS } from '../config/settings';
import { SqlSettingsRepository } from './settings-repository';
import { createTestDatabase } from './test-database';

describe('SqlSettingsRepository', () => {
  it('devolve os padrões quando nada foi salvo', async () => {
    const repository = new SqlSettingsRepository(await createTestDatabase());
    expect(await repository.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('salva alterações parciais', async () => {
    const repository = new SqlSettingsRepository(await createTestDatabase());
    await repository.update({ languageCode: 'fr-FR' });
    await repository.update({ pauseLevel: 'long' });
    expect(await repository.get()).toEqual({
      ...DEFAULT_SETTINGS,
      languageCode: 'fr-FR',
      pauseLevel: 'long',
    });
  });

  it('volta ao padrão se o valor salvo não existe mais na configuração', async () => {
    const db = await createTestDatabase();
    await db.run(
      "INSERT INTO settings (id, language_code, response_mode, pause_level) VALUES (1, 'xx-XX', 'quick', 'short')",
    );
    expect(await new SqlSettingsRepository(db).get()).toEqual(DEFAULT_SETTINGS);
  });
});
