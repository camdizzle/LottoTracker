import { Routes, Route, Link, NavLink } from 'react-router-dom';
import Results from './pages/Results.jsx';
import History from './pages/History.jsx';
import Admin from './pages/Admin.jsx';

const navClass = ({ isActive }) =>
  isActive
    ? 'text-yellow-400 font-semibold'
    : 'text-slate-300 hover:text-white';

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-yellow-400">
            🎰 Lotto Tracker
          </Link>
          <div className="flex gap-5 text-sm">
            <NavLink to="/" end className={navClass}>Results</NavLink>
            <NavLink to="/history" className={navClass}>History</NavLink>
            <NavLink to="/admin" className={navClass}>Admin</NavLink>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Results />} />
          <Route path="/history" element={<History />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  );
}
