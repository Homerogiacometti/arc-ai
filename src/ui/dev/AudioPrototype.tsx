import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { useEffect, useRef, useState } from 'react';
import { useServices } from '../../app/services-context';
import { Microphone } from '../../audio/microphone';
import { base64ToPcm16, INPUT_MIME_TYPE, pcm16ToBase64 } from '../../audio/pcm';
import { PcmPlayer } from '../../audio/player';
import { MODELS } from '../../config/models';
import { PAUSE_LEVELS } from '../../config/pause-levels';
import './AudioPrototype.css';

/**
 * Protótipo do início do M3: valida no aparelho real o cancelamento de eco no alto-falante,
 * a interrupção e a latência antes de construir o ConversationProvider. Será removido.
 */

const INSTRUCTION = `You are a friendly conversation partner helping a Brazilian adult practice spoken English.
Speak naturally, like a person, with short replies (one to three sentences) and ask questions.
Start by greeting the user and asking how their day is going.`;

/** RMS acima disto conta como voz (para a latência, RNF01). */
const VOICE_THRESHOLD = 0.02;

type Status = 'idle' | 'connecting' | 'live' | 'closed' | 'error';

interface Line {
  id: number;
  who: 'Você' | 'IA';
  text: string;
}

export function AudioPrototype({ onExit }: { onExit: () => void }) {
  const { apiKeyStore } = useServices();
  const [status, setStatus] = useState<Status>('idle');
  const [detail, setDetail] = useState('');
  const [level, setLevel] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [interruptions, setInterruptions] = useState(0);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  const sessionRef = useRef<Session | null>(null);
  const micRef = useRef<Microphone | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const turnRef = useRef({ user: '', ai: '', audioStarted: false, lastVoiceAt: 0, nextId: 0 });

  async function stop() {
    sessionRef.current?.close();
    sessionRef.current = null;
    await micRef.current?.stop();
    micRef.current = null;
    await playerRef.current?.close();
    playerRef.current = null;
    setAiSpeaking(false);
    setLevel(0);
  }

  useEffect(
    () => () => {
      void stop();
    },

    [],
  );

  function flushTurn() {
    const turn = turnRef.current;
    const finished: Line[] = [];
    if (turn.user.trim()) finished.push({ id: turn.nextId++, who: 'Você', text: turn.user.trim() });
    if (turn.ai.trim()) finished.push({ id: turn.nextId++, who: 'IA', text: turn.ai.trim() });
    turn.user = '';
    turn.ai = '';
    turn.audioStarted = false;
    if (finished.length) setLines((current) => [...current, ...finished].slice(-30));
  }

  function handleMessage(message: LiveServerMessage) {
    const content = message.serverContent;
    const turn = turnRef.current;
    if (!content) {
      if (message.goAway) setDetail(`goAway: ${message.goAway.timeLeft ?? '?'}`);
      return;
    }
    if (content.inputTranscription?.text) turn.user += content.inputTranscription.text;
    if (content.outputTranscription?.text) turn.ai += content.outputTranscription.text;

    for (const part of content.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (!data) continue;
      if (!turn.audioStarted) {
        turn.audioStarted = true;
        if (turn.lastVoiceAt > 0) {
          const latency = Math.round(performance.now() - turn.lastVoiceAt);
          setLatencies((current) => [...current, latency].slice(-10));
          turn.lastVoiceAt = 0;
        }
      }
      playerRef.current?.enqueue(base64ToPcm16(data));
      setAiSpeaking(true);
    }

    if (content.interrupted) {
      playerRef.current?.interrupt();
      setInterruptions((count) => count + 1);
      flushTurn();
    }
    if (content.turnComplete) flushTurn();
  }

  async function start() {
    // Criado no gesto do usuário para o navegador liberar o áudio.
    const player = new PcmPlayer({
      onIdle: () => {
        setAiSpeaking(false);
      },
    });
    playerRef.current = player;
    void player.resume();
    setStatus('connecting');
    setDetail('');
    setLines([]);
    setLatencies([]);
    setInterruptions(0);

    try {
      const apiKey = await apiKeyStore.get();
      if (!apiKey) throw new Error('Sem chave de API');
      const ai = new GoogleGenAI({ apiKey });
      const session = await ai.live.connect({
        model: MODELS.live,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: {
            automaticActivityDetection: {
              silenceDurationMs: PAUSE_LEVELS.medium.silenceDurationMs,
            },
          },
        },
        callbacks: {
          onmessage: handleMessage,
          onerror: () => {
            setStatus('error');
            setDetail('Erro na conexão');
          },
          onclose: (event: CloseEvent) => {
            setStatus((current) => (current === 'error' ? current : 'closed'));
            if (event.reason) setDetail(`Fechou: ${event.reason}`);
          },
        },
      });
      sessionRef.current = session;

      const mic = new Microphone();
      micRef.current = mic;
      await mic.start(({ pcm, level: chunkLevel }) => {
        setLevel(chunkLevel);
        if (chunkLevel > VOICE_THRESHOLD) turnRef.current.lastVoiceAt = performance.now();
        sessionRef.current?.sendRealtimeInput({
          audio: { data: pcm16ToBase64(pcm), mimeType: INPUT_MIME_TYPE },
        });
      });

      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: 'Start the conversation.' }] }],
        turnComplete: true,
      });
      setStatus('live');
    } catch (error) {
      await stop();
      setStatus('error');
      setDetail(error instanceof Error ? error.message : 'Falha ao iniciar');
    }
  }

  const running = status === 'connecting' || status === 'live';
  const average = latencies.length
    ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
    : null;

  return (
    <main className="screen proto">
      <header className="proto__bar">
        <button
          className="proto__link"
          type="button"
          onClick={() => {
            void stop().then(onExit);
          }}
        >
          ← Voltar
        </button>
        <span className="proto__tag">protótipo de áudio</span>
      </header>

      <button
        className="button"
        type="button"
        onClick={() => {
          void (running
            ? stop().then(() => {
                setStatus('idle');
              })
            : start());
        }}
      >
        {running ? 'Parar' : 'Iniciar conversa'}
      </button>

      <dl className="proto__stats">
        <dt>Status</dt>
        <dd>
          {status}
          {detail && ` — ${detail}`}
        </dd>
        <dt>Microfone</dt>
        <dd>
          <span className="proto__meter">
            <span style={{ width: `${String(Math.min(100, level * 400))}%` }} />
          </span>
        </dd>
        <dt>IA falando</dt>
        <dd>{aiSpeaking ? 'sim' : 'não'}</dd>
        <dt>Interrupções</dt>
        <dd>{interruptions}</dd>
        <dt>Latência</dt>
        <dd>
          {average === null
            ? '—'
            : `média ${String(average)} ms · últimas: ${latencies.join(', ')}`}
        </dd>
      </dl>

      <ol className="proto__lines">
        {lines.map((line) => (
          <li key={line.id} className={line.who === 'IA' ? 'proto__ai' : 'proto__user'}>
            <strong>{line.who}:</strong> {line.text}
          </li>
        ))}
      </ol>
    </main>
  );
}
