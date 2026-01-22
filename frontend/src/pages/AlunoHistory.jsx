import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
import StrengthHistoryChart from '../components/StrengthHistoryChart.jsx';
import { getMyEvolution, listMyExecutions } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AlunoHistory() {
  const { user } = useAuth();
  const [executions, setExecutions] = useState([]);
  const [evolution, setEvolution] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function formatMetric(raw, value) {
    if (raw !== null && raw !== undefined && String(raw).trim() !== '') return String(raw);
    if (value !== null && value !== undefined) return String(value);
    return '-';
  }

  function formatDelta(value, decimals = 1) {
    if (value === null || value === undefined) return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return '-';
    const sign = num > 0 ? '+' : '';
    const fixed = num.toFixed(decimals);
    const clean = decimals > 0 ? fixed.replace(/\\.0+$/, '') : fixed;
    return `${sign}${clean}`;
  }

  async function fetchHistory() {
    setError('');
    setLoading(true);
    try {
      const [data, evo] = await Promise.all([
        listMyExecutions(),
        getMyEvolution(),
      ]);
      setExecutions(data);
      setEvolution(evo);
    } catch (err) {
      setError('Não foi possível carregar seu histórico.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Histórico</p>
        <h1 className="text-2xl font-bold text-slate-900">Minhas execuções</h1>
        <p className="text-sm text-slate-600">Acompanhe suas sessões registradas. Olá, {user?.name || 'aluno'}.</p>
      </div>

      <SectionCard
        title="Atualizar"
        actions={
          <button
            onClick={fetchHistory}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold w-full sm:w-auto"
            disabled={loading}
          >
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        }
      >
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </SectionCard>

      <SectionCard title="Evolução de cargas e repetições">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 uppercase text-xs">
                <th className="py-2">Exercício</th>
                <th>Último</th>
                <th>Melhor</th>
                <th>Δ</th>
                <th>Execuções</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {evolution.map((row) => (
                <tr key={row.exercise_id} className="border-b">
                  <td className="py-2">
                    <div className="text-sm text-slate-800">{row.name}</div>
                    <div className="text-[11px] text-slate-500">{row.type}</div>
                  </td>
                  <td className="text-xs text-slate-700">
                    <div>Carga: {formatMetric(row.last_load, row.last_load_value)}</div>
                    <div>Reps: {formatMetric(row.last_reps, row.last_reps_value)}</div>
                  </td>
                  <td className="text-xs text-slate-700">
                    <div>Carga: {formatMetric(row.best_load, row.best_load_value)}</div>
                    <div>Reps: {formatMetric(row.best_reps, row.best_reps_value)}</div>
                  </td>
                  <td className="text-xs text-slate-700">
                    <div>Carga: {formatDelta(row.delta_load_value, 1)}</div>
                    <div>Reps: {formatDelta(row.delta_reps_value, 0)}</div>
                  </td>
                  <td className="text-xs text-slate-700">{row.total_executions ?? 0}</td>
                  <td className="text-xs text-slate-700">{row.last_executed_at?.slice(0, 10) || '-'}</td>
                </tr>
              ))}
              {evolution.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-sm text-slate-500 py-3">
                    Sem dados de carga/repetições.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <StrengthHistoryChart
        executions={executions}
        title="Grafico de cargas e repeticoes"
        description="Selecione um exercicio de musculacao para ver a tendencia de carga e reps."
      />

      <SectionCard title="Execuções">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 uppercase text-xs">
                <th className="py-2">Sessão</th>
                <th>Exercícios</th>
                <th>Status</th>
                <th>RPE</th>
                <th>Comentário</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="py-2">{e.session_name || `Sessão ${e.session_id}`}</td>
                  <td className="py-2 text-xs text-slate-700">
                    {e.exercises && e.exercises.length > 0 ? (
                      <details>
                        <summary className="cursor-pointer text-blue-700">
                          Ver exercícios ({e.exercises.length})
                        </summary>
                        <div className="mt-2 space-y-1">
                          {[...e.exercises]
                            .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
                            .map((ex) => {
                              const details = Array.isArray(ex.performed?.set_details) ? ex.performed.set_details : [];
                              const line =
                                details.length > 0
                                  ? details
                                      .map((row) => `${row.reps || '?'}x${row.load || '?'}`)
                                      .join(' · ')
                                  : '-';
                              return (
                                <div key={`${e.id}-${ex.id}`} className="text-[11px] text-slate-700">
                                  {ex.order || '?'}. <span className="font-semibold">{ex.name}</span>{' '}
                                  <span className="text-slate-500">({ex.type})</span>{' '}
                                  <span className="text-slate-600">→ {line}</span>
                                </div>
                              );
                            })}
                        </div>
                      </details>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{e.status}</td>
                  <td>{e.rpe ?? '-'}</td>
                  <td className="max-w-xs truncate">{e.comment || '-'}</td>
                  <td>{e.executed_at?.slice(0, 10)}</td>
                </tr>
              ))}
              {executions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-sm text-slate-500 py-3">
                    Nenhuma execução encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
