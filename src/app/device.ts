import { Capacitor } from '@capacitor/core';

/** Ações que saem do app: compartilhar um arquivo e abrir links externos (e-mail). */
export interface Device {
  /** Grava o texto num arquivo e abre o menu de compartilhar do Android (salvar, Drive...). */
  shareFile(fileName: string, text: string): Promise<void>;
  /** Abre um link fora do app (ex.: `mailto:` no app de e-mail). */
  openUrl(url: string): void;
}

export function createDevice(): Device {
  return {
    shareFile: async (fileName, text) => {
      if (!Capacitor.isNativePlatform()) {
        downloadInBrowser(fileName, text);
        return;
      }
      const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
      ]);
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: text,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      try {
        await Share.share({ title: fileName, files: [uri] });
      } catch (error) {
        // Fechar o menu sem escolher nada não é erro.
        if (!(error instanceof Error && /cancel/i.test(error.message))) throw error;
      }
    },
    openUrl: (url) => {
      // No Capacitor, links de outros esquemas (mailto:) abrem no app do sistema.
      window.location.href = url;
    },
  };
}

/** Desenvolvimento no navegador: baixa o arquivo. */
function downloadInBrowser(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
