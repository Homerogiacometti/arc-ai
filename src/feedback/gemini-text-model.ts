import { MODELS } from '../config/models';
import type { JsonModel } from './generate-feedback';

/**
 * Gemini com saída JSON. O SDK é carregado sob demanda. Raciocínio no nível baixo: o
 * feedback é uma análise direta e o nível padrão (médio) só deixa a resposta mais lenta.
 */
export class GeminiTextModel implements JsonModel {
  readonly name: string;

  constructor(name: string = MODELS.text) {
    this.name = name;
  }

  async generateJson(
    apiKey: string,
    prompt: string,
    jsonSchema: Record<string, unknown>,
  ): Promise<string> {
    const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: this.name,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: jsonSchema,
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    const text = response.text;
    if (!text) throw new Error('Resposta vazia do modelo');
    return text;
  }
}
