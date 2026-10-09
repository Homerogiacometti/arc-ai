import { MISTAKE_CATEGORIES, type Feedback } from '../../feedback/schema';
import './Feedback.css';

/** Conteúdo do feedback de fim de sessão (RF10). */
export function FeedbackView({ feedback }: { feedback: Feedback }) {
  return (
    <div className="feedback">
      <section className="feedback__section">
        <h2 className="feedback__heading">Resumo</h2>
        <p className="feedback__text">{feedback.summary}</p>
      </section>

      {feedback.strengths.length > 0 && (
        <section className="feedback__section">
          <h2 className="feedback__heading">Pontos fortes</h2>
          <ul className="feedback__bullets">
            {feedback.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="feedback__section">
        <h2 className="feedback__heading">Erros</h2>
        {feedback.mistakes.length === 0 ? (
          <p className="feedback__text">Nenhum erro relevante nesta conversa.</p>
        ) : (
          <ul className="feedback__cards">
            {feedback.mistakes.map((mistake, index) => (
              <li key={index} className="card">
                <span className="card__tag">{MISTAKE_CATEGORIES[mistake.category]}</span>
                <p className="card__original">{mistake.original}</p>
                <p className="card__correction">{mistake.correction}</p>
                <p className="card__explanation">{mistake.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {feedback.vocabulary.length > 0 && (
        <section className="feedback__section">
          <h2 className="feedback__heading">Mais natural</h2>
          <ul className="feedback__cards">
            {feedback.vocabulary.map((item, index) => (
              <li key={index} className="card">
                <p className="card__original card__original--plain">{item.original}</p>
                <p className="card__correction">→ {item.suggestion}</p>
                <p className="card__explanation">{item.explanation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="feedback__section">
        <h2 className="feedback__heading">Nível estimado</h2>
        <p className="feedback__level">{feedback.level.cefr}</p>
        <p className="feedback__text">{feedback.level.comment}</p>
      </section>
    </div>
  );
}
