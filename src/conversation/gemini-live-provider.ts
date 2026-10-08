import {
  GoogleGenAI,
  Modality,
  type FunctionDeclaration,
  type LiveConnectConfig,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import { base64ToPcm16, INPUT_MIME_TYPE, pcm16ToBase64 } from '../audio/pcm';
import { MODELS } from '../config/models';
import type {
  ConnectOptions,
  ConversationConnection,
  ConversationEvents,
  ConversationProvider,
} from './provider';

export const END_SESSION_TOOL = 'end_session';

const endSessionDeclaration: FunctionDeclaration = {
  name: END_SESSION_TOOL,
  description:
    'Ends the practice session. Call it when the user asks to stop, in any language ' +
    '(e.g. "let\'s stop", "vamos parar"), right after saying a short goodbye.',
};

export function buildLiveConfig(options: ConnectOptions): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: options.systemInstruction,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: {
      automaticActivityDetection: { silenceDurationMs: options.silenceDurationMs },
    },
    // RF08: sessões longas.
    contextWindowCompression: { slidingWindow: {} },
    sessionResumption: options.resumeHandle ? { handle: options.resumeHandle } : {},
    tools: [{ functionDeclarations: [endSessionDeclaration] }],
  };
}

/** Traduz uma mensagem do servidor nos eventos do app. Exportada para testes. */
export function dispatchServerMessage(
  message: LiveServerMessage,
  events: ConversationEvents,
  respondToTool: (id: string | undefined, name: string) => void,
): void {
  const content = message.serverContent;
  if (content) {
    if (content.inputTranscription?.text) {
      events.onTranscript('user', content.inputTranscription.text);
    }
    if (content.outputTranscription?.text) {
      events.onTranscript('ai', content.outputTranscription.text);
    }
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) events.onAudio(base64ToPcm16(part.inlineData.data));
    }
    if (content.interrupted) events.onInterrupted();
    if (content.turnComplete) events.onTurnComplete();
  }

  for (const call of message.toolCall?.functionCalls ?? []) {
    if (call.name === END_SESSION_TOOL) {
      respondToTool(call.id, call.name);
      events.onEndRequested();
    }
  }

  const update = message.sessionResumptionUpdate;
  if (update?.resumable && update.newHandle) events.onResumeHandle(update.newHandle);
  if (message.goAway) events.onGoAway();
  if (message.usageMetadata?.totalTokenCount !== undefined) {
    events.onUsage(message.usageMetadata.totalTokenCount);
  }
}

/** Conversa por voz pela Gemini Live API (ADR-004), via `@google/genai`. */
export class GeminiLiveProvider implements ConversationProvider {
  async connect(
    options: ConnectOptions,
    events: ConversationEvents,
  ): Promise<ConversationConnection> {
    const ai = new GoogleGenAI({ apiKey: options.apiKey });
    let closedByApp = false;
    let session: Session | null = null;

    const respondToTool = (id: string | undefined, name: string) => {
      session?.sendToolResponse({
        functionResponses: [{ ...(id ? { id } : {}), name, response: { result: 'ok' } }],
      });
    };

    session = await ai.live.connect({
      model: MODELS.live,
      config: buildLiveConfig(options),
      callbacks: {
        onmessage: (message) => {
          dispatchServerMessage(message, events, respondToTool);
        },
        onclose: () => {
          if (!closedByApp) events.onDisconnected();
        },
        onerror: () => {
          if (!closedByApp) events.onDisconnected();
        },
      },
    });
    const connected = session;

    return {
      sendAudio: (pcm) => {
        connected.sendRealtimeInput({
          audio: { data: pcm16ToBase64(pcm), mimeType: INPUT_MIME_TYPE },
        });
      },
      sendText: (text) => {
        connected.sendClientContent({
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true,
        });
      },
      close: () => {
        closedByApp = true;
        connected.close();
      },
    };
  }
}
