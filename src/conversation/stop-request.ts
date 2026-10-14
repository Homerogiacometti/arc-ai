/**
 * Pedidos claros para encerrar a conversa (RF07). A IA só encerra pela ferramenta `end_session`
 * quando a última fala do usuário traz um destes pedidos, em português ou no idioma praticado;
 * sem isso o app recusa a chamada. Despedidas soltas ("tchau") e fim de assunto não contam.
 * Escritos como se fala; a comparação ignora maiúsculas, acentos e pontuação.
 */
const STOP_PHRASES: readonly string[] = [
  // Português
  'vamos parar',
  'pode parar',
  'podemos parar',
  'quero parar',
  'preciso parar',
  'tenho que parar',
  'vou parar',
  'parar por aqui',
  'parar por hoje',
  'parar a conversa',
  'para a conversa',
  'encerrar',
  'encerra',
  'encerre',
  'encerramos',
  'vamos encerrar',
  'terminar a conversa',
  'terminar por aqui',
  'terminar por hoje',
  'vamos terminar',
  'acabar a conversa',
  'vamos acabar',
  'finalizar',
  'finaliza',
  'finalize',
  'chega por hoje',
  'por hoje é só',
  'por hoje chega',
  'preciso ir',
  'tenho que ir',
  // English
  "let's stop",
  'can we stop',
  'i want to stop',
  'i need to stop',
  'i have to stop',
  'stop the conversation',
  'stop the session',
  'stop here',
  'stop for today',
  "let's end",
  'end the conversation',
  'end the session',
  "let's finish",
  "let's wrap up",
  'finish the conversation',
  "that's enough for today",
  "that's all for today",
  "let's call it a day",
  "i'm done for today",
  'i have to go',
  'i need to go',
  'i gotta go',
  // Español
  'vamos a parar',
  'paremos',
  'quiero parar',
  'tengo que parar',
  'terminemos',
  'vamos a terminar',
  'terminar la conversación',
  'acabemos',
  'vamos a acabar',
  'tengo que irme',
  'me tengo que ir',
  'basta por hoy',
  'es todo por hoy',
  'finalizar',
  // Français
  'arrêtons',
  'on arrête',
  'je veux arrêter',
  'je dois arrêter',
  'on peut arrêter',
  'arrêter la conversation',
  'terminons',
  'on termine',
  'finissons',
  'je dois partir',
  'je dois y aller',
  "c'est tout pour aujourd'hui",
  "ça suffit pour aujourd'hui",
  // Deutsch
  'lass uns aufhören',
  'lassen sie uns aufhören',
  'hören wir auf',
  'ich will aufhören',
  'ich möchte aufhören',
  'ich muss aufhören',
  'beenden',
  'beenden wir',
  'schluss für heute',
  "das war's für heute",
  'das wars für heute',
  'ich muss gehen',
  'ich muss los',
  // Italiano
  'fermiamoci',
  'smettiamo',
  'basta per oggi',
  'voglio smettere',
  'devo smettere',
  'finiamo',
  'terminiamo',
  'chiudiamo',
  'devo andare',
  'è tutto per oggi',
  // Nederlands
  'laten we stoppen',
  'ik wil stoppen',
  'ik moet stoppen',
  'stoppen',
  'laten we eindigen',
  'genoeg voor vandaag',
  'ik moet gaan',
  // Polski
  'skończmy',
  'zakończmy',
  'przestańmy',
  'koniec na dziś',
  'koniec rozmowy',
  'chcę skończyć',
  'muszę kończyć',
  'muszę iść',
  // Türkçe
  'duralım',
  'bitirelim',
  'bitirmek istiyorum',
  'bugünlük bu kadar',
  'bugünlük yeter',
  'gitmem lazım',
  'gitmem gerek',
  // Русский
  'давай закончим',
  'давайте закончим',
  'закончим',
  'заканчиваем',
  'давай остановимся',
  'остановимся',
  'хватит на сегодня',
  'я хочу закончить',
  'мне пора',
  // العربية
  'لنتوقف',
  'دعنا نتوقف',
  'لننهي',
  'أريد التوقف',
  'يكفي اليوم',
  'علي الذهاب',
  'يجب أن أذهب',
  // हिन्दी (e romanizado, como a transcrição às vezes vem)
  'चलो रुकते हैं',
  'रुक जाते हैं',
  'बातचीत खत्म',
  'खत्म करते हैं',
  'बंद करते हैं',
  'आज के लिए इतना',
  'मुझे जाना है',
  'chalo rukte hain',
  'bas aaj ke liye',
  'mujhe jana hai',
  // 日本語 (sem espaços: comparação por trecho)
  '終わりにしよう',
  '終わりにしましょう',
  'おわりにしよう',
  '終わろう',
  '終わりましょう',
  'やめよう',
  'やめましょう',
  'やめたい',
  '今日はここまで',
  'もう行かなきゃ',
  // 한국어
  '그만하자',
  '그만할게',
  '그만합시다',
  '그만하고 싶어',
  '끝내자',
  '끝냅시다',
  '여기까지 하자',
  '오늘은 여기까지',
  '가야 해',
  // 中文
  '停下来吧',
  '我们停吧',
  '到此为止',
  '今天就到这里',
  '结束对话',
  '结束吧',
  '不聊了',
  '我得走了',
  '我要走了',
];

/** Escritas sem espaço entre palavras (e o coreano, que a transcrição espaça de qualquer jeito). */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

const PHRASES = STOP_PHRASES.map((phrase) => {
  const normalized = normalize(phrase);
  return UNSPACED.test(phrase)
    ? { unspaced: true, text: normalized.replace(/ /g, '') }
    : { unspaced: false, text: ` ${normalized} ` };
});

/** A fala pede claramente para encerrar a conversa? */
export function isStopRequest(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  const spaced = ` ${normalized} `;
  const unspaced = normalized.replace(/ /g, '');
  return PHRASES.some((phrase) =>
    phrase.unspaced ? unspaced.includes(phrase.text) : spaced.includes(phrase.text),
  );
}
