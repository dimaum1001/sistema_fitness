import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [email, setEmail] = useState('professor@test.com');
  const [password, setPassword] = useState('senha123');
  const navigate = useNavigate();
  const { login, error, setError, user } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await login(email, password);
      const role = user?.type || localStorage.getItem('last_role');
      if (role === 'ALUNO') navigate('/aluno/dashboard');
      else if (role === 'ADMIN') navigate('/admin/professores');
      else navigate('/professor/dashboard');
    } catch (err) {
      setError('Falha no login. Verifique email e senha.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-800 px-4">
      <div className="bg-white shadow-xl rounded-2xl p-6 sm:p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Sistema Fitness Total</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Login</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Entre como admin, professor ou aluno usando email e senha.</p>
        </div>
        {error && <p className="text-red-600 mb-3 text-sm text-center">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-base sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-base sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-base sm:text-sm font-semibold hover:bg-blue-700 transition"
          >
            Entrar
          </button>
        </form>
        <div className="mt-4 text-xs sm:text-sm text-slate-600 text-center">
          Ao entrar voce concorda com os{' '}
          <Link to="/termos" className="text-blue-600 font-semibold hover:underline">Termos de Uso</Link>{' '}
          e a{' '}
          <Link to="/privacidade" className="text-blue-600 font-semibold hover:underline">Politica de Privacidade</Link>.
        </div>
        <div className="mt-4 text-xs sm:text-sm text-slate-600 space-y-1">
          <p>Logins de teste:</p>
          <p>- Admin: <span className="font-semibold">admin@test.com</span> / <span className="font-semibold">senha123</span></p>
          <p>- Professor: <span className="font-semibold">professor@test.com</span> / <span className="font-semibold">senha123</span></p>
          <p>- Aluno: <span className="font-semibold">aluno@test.com</span> / <span className="font-semibold">senha123</span></p>
        </div>
      </div>
    </div>
  );
}
