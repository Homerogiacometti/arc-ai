import { SqlPlanRepository } from './plan-repository';
import { createTestDatabase } from './test-database';

describe('SqlPlanRepository', () => {
  it('cria uma vigência por dia e substitui a edição do mesmo dia', async () => {
    let now = new Date(2026, 9, 1, 9);
    const repository = new SqlPlanRepository(await createTestDatabase(), () => now);
    expect(await repository.list()).toEqual([]);

    await repository.save({ daysPerWeek: 3, minutesPerDay: 20 });
    await repository.save({ daysPerWeek: 4, minutesPerDay: 20 });
    now = new Date(2026, 9, 8, 21);
    await repository.save({ daysPerWeek: 5, minutesPerDay: 15 });

    expect(await repository.list()).toEqual([
      { validFrom: '2026-10-01', daysPerWeek: 4, minutesPerDay: 20 },
      { validFrom: '2026-10-08', daysPerWeek: 5, minutesPerDay: 15 },
    ]);
  });

  it('recusa meta fora dos limites', async () => {
    const repository = new SqlPlanRepository(await createTestDatabase());
    await expect(repository.save({ daysPerWeek: 8, minutesPerDay: 20 })).rejects.toThrow();
    await expect(repository.save({ daysPerWeek: 3, minutesPerDay: 0 })).rejects.toThrow();
  });
});
