import { startPhase } from './start-phase';

describe('startPhase', () => {
  it('pede a chave primeiro, depois o perfil', () => {
    expect(startPhase({ hasApiKey: false, hasProfile: true })).toBe('api-key');
    expect(startPhase({ hasApiKey: true, hasProfile: false })).toBe('profile');
    expect(startPhase({ hasApiKey: true, hasProfile: true })).toBe('home');
  });
});
