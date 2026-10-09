import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.arctechnologies.arcai',
  appName: 'Arc AI',
  webDir: 'dist',
  backgroundColor: '#000000',
  // O bridge registra no logcat os resultados dos plugins (inclui transcrições). Só em build
  // debug; o build de release (Play Store) não registra nada (RNF02, RNF06).
  loggingBehavior: 'debug',
};

export default config;
