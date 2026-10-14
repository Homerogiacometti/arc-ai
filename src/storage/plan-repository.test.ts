import { SqlPlanRepository } from './plan-repository';
import { createTestDatabase } from './test-database';

describe('SqlPlanRepository', () => {
  it('cria uma vigência por dia e substitui a edição do mesmo dia', async () => {
    let now = new Date(2026, 9, 1, 9);
    const repository = new SqlPlanRepository(await createTestDatabase(), () => now);
    expect(await repository.list('en-US')).toEqual([]);

    await repository.save('en-US', { daysPerWeek: 3, minutesPerDay: 20 });
    await repository.save('en-US', { daysPerWeek: 4, minutesPerDay: 20 });
    now = new Date(2026, 9, 8, 21);
    await repository.save('en-US', { daysPerWeek: 5, minutesPerDay: 15 });

    expect(await repository.list('en-US')).toEqual([
      { validFrom: '2026-10-01', daysPerWeek: 4, minutesPerDay: 20 },
      { validFrom: '2026-10-08', daysPerWeek: 5, minutesPerDay: 15 },
    ]);
  });

  it('cada idioma tem o seu plano', async () => {
    const repository = new SqlPlanRepository(
      await createTestDatabase(),
      () => new Date(2026, 9, 1),
    );
    await repository.save('en-US', { daysPerWeek: 3, minutesPerDay: 20 });
    await repository.save('es-ES', { daysPerWeek: 1, minutesPerDay: 10 });
    expect(await repository.list('en-US')).toMatchObject([{ daysPerWeek: 3 }]);
    expect(await repository.list('es-ES')).toMatchObject([{ daysPerWeek: 1 }]);
    expect(await repository.list('fr-FR')).toEqual([]);
  });

  it('recusa meta fora dos limites', async () => {
    const repository = new SqlPlanRepository(await createTestDatabase());
    await expect(repository.save('en-US', { daysPerWeek: 8, minutesPerDay: 20 })).rejects.toThrow();
    await expect(repository.save('en-US', { daysPerWeek: 3, minutesPerDay: 0 })).rejects.toThrow();
  });
});
