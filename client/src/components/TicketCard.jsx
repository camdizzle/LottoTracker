import Ball from './Ball.jsx';
import { evaluateTicket, getSpecialValue } from '../prizes.js';

const GAME_LABELS = {
  megaMillions: 'Mega Millions',
  powerball: 'Powerball',
  superLotto: 'Super Lotto Plus',
};

const MULT_LABELS = {
  megaMillions: 'Megaplier',
  powerball: 'Power Play',
};

export default function TicketCard({ ticket, result, onDelete }) {
  const { matchedWhite, specialMatched, prize } = evaluateTicket(ticket, result);
  const isJackpot = !!prize.isJackpot;
  const won = isJackpot || (prize.amount && prize.amount > 0);
  const specialValue = getSpecialValue(ticket.game, result);

  return (
    <div
      className={`rounded-lg p-4 bg-slate-800 border ${
        isJackpot
          ? 'border-yellow-400 animate-pulse-yellow'
          : won
          ? 'border-green-500'
          : 'border-slate-700'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">
            {GAME_LABELS[ticket.game]}
          </div>
          {ticket.label && (
            <div className="text-sm text-slate-200">{ticket.label}</div>
          )}
        </div>
        <div className="text-xs text-slate-400 text-right">
          Draw<br />
          {ticket.drawDate}
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        {ticket.numbers.map((n, i) => {
          const matched = result && result.whiteNumbers.includes(n);
          return <Ball key={i} number={n} game={ticket.game} matched={!!matched} size="sm" />;
        })}
        <span className="text-slate-500 px-1">+</span>
        {ticket.specialNumber != null && (
          <Ball
            number={ticket.specialNumber}
            game={ticket.game}
            isSpecial
            matched={!!specialMatched}
            size="sm"
          />
        )}
        {ticket.multiplier && MULT_LABELS[ticket.game] && (
          <span className="text-xs bg-slate-700 px-2 py-1 rounded ml-1">
            {MULT_LABELS[ticket.game]} ×{ticket.multiplier}
          </span>
        )}
      </div>

      {result && (
        <div className="mt-3 text-sm">
          {isJackpot ? (
            <div className="text-yellow-300 font-bold text-base">🎉 JACKPOT WINNER! 🎉</div>
          ) : won ? (
            <div className="text-green-400 font-semibold">
              Won ${prize.amount.toLocaleString()}
              <span className="text-slate-400 font-normal ml-2">
                ({matchedWhite.length}/5{specialMatched ? ' + special' : ''})
              </span>
            </div>
          ) : (
            <div className="text-slate-500">
              {matchedWhite.length}/5 {specialMatched ? '+ special' : ''} — no prize
            </div>
          )}
        </div>
      )}

      {onDelete && (
        <button
          onClick={() => onDelete(ticket.id)}
          className="mt-3 text-xs text-red-400 hover:text-red-300"
        >
          Delete
        </button>
      )}
    </div>
  );
}
