import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
import StatBadge from '../components/StatBadge.jsx';
import StrengthHistoryChart from '../components/StrengthHistoryChart.jsx';
import { getStudentEvolution, listExecutionsByStudent, listStudents } from '../api/client.js';

export default function ProfessorReports() {
  const [studentId, setStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [evolution, setEvolution] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    listStudents().then(setStudents).catch(() => {});
  }, []);

  function resolveStudentId() {
    if (selectedStudent) return selectedStudent.id;
    const term = (studentSearch || studentId).trim();
    if (!term) return '';
    const byId = students.find((s) => String(s.id) === term);
    if (byId) return byId.id;
    const termLower = term.toLowerCase();
    const byNameEmail = students.filter(
      (s) => s.name.toLowerCase().includes(termLower) || s.email.toLowerCase().includes(termLower),
    );
    if (byNameEmail.length === 1) return byNameEmail[0].id;
    if (!Number.isNaN(Number(term))) return Number(term);
    return '';
  }

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

  async function handleFetch() {
    setError('');
    const resolvedId = resolveStudentId();
    if (!resolvedId) {
      setError('Informe ou selecione um aluno (ID, nome ou email).');
      return;
    }
    try {
      const [data, evo] = await Promise.all([
        listExecutionsByStudent(resolvedId),
        getStudentEvolution(resolvedId),
      ]);
      setExecutions(data);
      setEvolution(evo);
    } catch (err) {
      setError('Erro ao carregar histórico do aluno.');
    }
  }

  const aggregates = useMemo(() => {
    const total = executions.length;
    const completed = executions.filter((e) => e.status === 'CONCLUIDO').length;
    const partial = executions.filter((e) => e.status === 'PARCIAL').length;
    const nao = executions.filter((e) => e.status === 'NAO_REALIZADO').length;
    const rpeMedia =
      executions.length > 0
        ? (executions.reduce((acc, cur) => acc + (cur.rpe || 0), 0) / executions.length).toFixed(1)
        : '0.0';
    return { total, completed, partial, nao, rpeMedia };
  }, [executions]);

  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Relatórios simples</p>
        <h1 className="text-2xl font-bold text-slate-900">Acompanhamento</h1>
        <p className="text-sm text-slate-600">
          Volumes básicos por aluno. O backend traz execuções com os exercícios da sessão para consulta rápida.
        </p>
      </div>

      <SectionCard
        title="Selecionar aluno"
        description="Busque por ID, nome ou email para trazer execuções registradas."
        actions={
          <button
            onClick={handleFetch}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold"
          >
            Buscar execuções
          </button>
        }
      >
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-700">Aluno (ID, nome ou email)</label>
            <input
              className="border rounded-lg px-3 py-2 text-sm"
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setSelectedStudent(null);
                setStudentId(e.target.value);
              }}
              placeholder="Digite para buscar ou cole o ID"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[240px]">
            <label className="text-sm text-slate-700">Ou selecione abaixo</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={selectedStudent ? selectedStudent.id : ''}
              onChange={(e) => {
                const found = students.find((s) => String(s.id) === e.target.value);
                setSelectedStudent(found || null);
                setStudentId(e.target.value);
              }}
            >
              <option value="">-- buscar na lista --</option>
              {students
                .filter((s) => {
                  if (!studentSearch) return true;
                  const term = studentSearch.toLowerCase();
                  return s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term) || String(s.id) === studentSearch;
                })
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email}) - ID {s.id}
                  </option>
                ))}
            </select>
          </div>
          {error && <span className="text-red-600 text-sm">{error}</span>}
          {selectedStudent && (
            <span className="text-xs text-emerald-700">
              Selecionado: {selectedStudent.name} ({selectedStudent.email}) - ID {selectedStudent.id}
            </span>
          )}
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatBadge label="Execuções" value={aggregates.total} tone="blue" />
        <StatBadge label="Concluídos" value={aggregates.completed} tone="green" />
        <StatBadge label="Parciais" value={aggregates.partial} tone="orange" />
        <StatBadge label="Não realizados" value={aggregates.nao} tone="gray" />
        <StatBadge label="RPE médio" value={aggregates.rpeMedia} tone="purple" />
      </div>

      <SectionCard
        title="Evolução de cargas e repetições"
        description="Resumo do melhor/último registro (máximo por sessão) de carga e repetições por exercício."
      >
        <div className="overflow-auto">
          <table className="w-full text-xs sm:text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-slate-500 uppercase text-xs">
                <th className="py-2">Exercício</th>
                <th>Grupo</th>
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
                  <td className="text-xs text-slate-700">{row.group || '-'}</td>
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
                  <td colSpan={7} className="text-sm text-slate-500 py-3">
                    Sem dados de carga/repetições para este aluno.
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

      <SectionCard title="Histórico do aluno">
        <div className="overflow-auto">
          <table className="w-full text-xs sm:text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-slate-500 uppercase text-xs">
                <th className="py-2">Execução ID</th>
                <th>Sessão</th>
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
                  <td className="py-2">{e.id}</td>
                  <td>
                    <div className="text-sm text-slate-800">{e.session_name || `Sessão ${e.session_id}`}</div>
                    <div className="text-[11px] text-slate-500">{e.plan_name || '-'}</div>
                  </td>
                  <td className="text-xs text-slate-700">
                    {e.exercises && e.exercises.length > 0
                      ? e.exercises
                          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
                          .map((ex) => `${ex.order || '?'} - ${ex.name} (${ex.type})`)
                          .join(' • ')
                      : 'Sem exercícios vinculados'}
                  </td>
                  <td>{e.status}</td>
                  <td>{e.rpe ?? '-'}</td>
                  <td className="max-w-xs truncate">{e.comment || '-'}</td>
                  <td>{e.executed_at?.slice(0, 10)}</td>
                </tr>
              ))}
              {executions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-sm text-slate-500 py-3">
                    Sem execuções para este aluno.
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
