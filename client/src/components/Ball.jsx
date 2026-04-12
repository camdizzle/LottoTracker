const GAME_STYLES = {
  megaMillions: {
    white: 'bg-blue-500 text-white border-blue-300',
    special: 'bg-yellow-400 text-slate-900 border-yellow-200',
  },
  powerball: {
    white: 'bg-white text-slate-900 border-slate-300',
    special: 'bg-red-600 text-white border-red-300',
  },
  superLotto: {
    white: 'bg-green-600 text-white border-green-300',
    special: 'bg-yellow-400 text-slate-900 border-yellow-200',
  },
};

const SIZES = {
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-14 h-14 text-lg',
};

export default function Ball({
  number,
  game,
  isSpecial = false,
  matched = false,
  size = 'md',
}) {
  const styles = GAME_STYLES[game] || GAME_STYLES.megaMillions;
  const base = isSpecial ? styles.special : styles.white;
  return (
    <div
      className={`${SIZES[size]} ${base} rounded-full border-2 flex items-center justify-center font-bold shadow-md shrink-0 ${
        matched ? 'ring-4 ring-green-400 animate-glow-green' : ''
      }`}
    >
      {number}
    </div>
  );
}
