import { MODELS } from '../config/models';
import type { JsonModel } from './generate-feedback';

/** Gemini Flash com saída JSON. O SDK é carregado sob demanda. */
export class GeminiTextModel implements JsonModel {
  readonly name = MODELS.text;

  async generateJson(
    apiKey: string,
    prompt: string,
    jsonSchema: Record<string, unknown>,
  ): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: this.name,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: jsonSchema,
        temperature: 0.2,
      },
    });
    const text = response.text;
    if (!text) throw new Error('Resposta vazia do modelo');
    return text;
  }
}
