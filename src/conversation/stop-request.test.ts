import { isStopRequest } from './stop-request';

describe('isStopRequest', () => {
  it.each([
    'Vamos parar por hoje.',
    'Ok, pode encerrar.',
    'Por hoje é só, obrigado!',
    "Okay, let's stop here.",
    'Lets stop',
    'I have to go now, bye!',
    'Bueno, terminemos aquí.',
    'Tengo que irme.',
    "D'accord, on arrête.",
    'Ich möchte aufhören.',
    'Devo andare, ciao!',
    'Bugünlük bu kadar.',
    'Давай закончим.',
    '今日はここまでにしましょう。',
    '오늘은 여기까지 하자',
    '今天就到这里吧',
  ])('reconhece "%s"', (text) => {
    expect(isStopRequest(text)).toBe(true);
  });

  it.each([
    '',
    'I went to the beach last weekend.',
    'Tchau!',
    'The bus stops here every day.',
    'I spent the weekend there, this was fun.',
    'Meu chefe quer encerrado o projeto até sexta.',
    'Je veux terminer mes études.',
  ])('ignora "%s"', (text) => {
    expect(isStopRequest(text)).toBe(false);
  });
});
