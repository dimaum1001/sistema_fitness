import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerProfessor } from '../api/client.js';

export default function RegisterProfessor() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await registerProfessor(form);
      setMessage('Professor criado com sucesso. Agora faça login.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError('Falha ao cadastrar professor.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="bg-white shadow-xl rounded-xl p-6 sm:p-8 w-full max-w-lg">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Cadastro de Professor</h1>
        <p className="text-xs sm:text-sm text-slate-600 mb-4">Use este fluxo apenas para testes do MVP.</p>
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        {message && <p className="text-emerald-600 text-sm mb-2">{message}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-base sm:text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2 text-base sm:text-sm"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-base sm:text-sm"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-base sm:text-sm font-semibold hover:bg-blue-700"
          >
            Cadastrar
          </button>
        </form>
        <div className="text-sm text-center mt-4">
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Voltar para login
          </Link>
        </div>
      </div>
    </div>
  );
}
