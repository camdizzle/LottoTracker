import Ball from './Ball.jsx';
import { getSpecialValue } from '../prizes.js';

const GAME_LABELS = {
  megaMillions: 'Mega Millions',
  powerball: 'Powerball',
  superLotto: 'Super Lotto Plus',
};

const GAME_GRADIENTS = {
  megaMillions: 'from-blue-700 to-blue-900',
  powerball: 'from-red-700 to-red-900',
  superLotto: 'from-green-700 to-green-900',
};

const MULT_LABELS = {
  megaMillions: 'Megaplier',
  powerball: 'Power Play',
};

export default function ResultCard({ game, result }) {
  if (!result) {
    return (
      <div className={`rounded-xl p-4 bg-gradient-to-br ${GAME_GRADIENTS[game]} shadow-lg opacity-60`}>
        <h3 className="text-lg font-bold">{GAME_LABELS[game]}</h3>
        <div className="text-sm mt-2 opacity-80">No results available yet.</div>
      </div>
    );
  }
  const special = getSpecialValue(game, result);
  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${GAME_GRADIENTS[game]} shadow-lg`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold">{GAME_LABELS[game]}</h3>
        <span className="text-xs opacity-80">{result.drawDate}</span>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        {result.whiteNumbers.map((n, i) => (
          <Ball key={i} number={n} game={game} size="sm" />
        ))}
        <span className="text-xl opacity-60 px-1">+</span>
        {special != null && <Ball number={special} game={game} isSpecial size="sm" />}
      </div>
      {result.multiplier && MULT_LABELS[game] && (
        <div className="mt-2 text-xs">
          <span className="bg-black/30 px-2 py-1 rounded">
            {MULT_LABELS[game]} ×{result.multiplier}
          </span>
        </div>
      )}
    </div>
  );
}
