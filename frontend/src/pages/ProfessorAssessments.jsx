import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
import {
  createStudentAssessment,
  deleteStudentAssessment,
  listStudentAssessments,
  listStudents,
  updateStudentAssessment,
} from '../api/client.js';

const numericFields = [
  'weight_kg',
  'height_cm',
  'bmi',
  'body_fat_percent',
  'muscle_mass_kg',
  'lean_mass_kg',
  'fat_mass_kg',
  'bone_mass_kg',
  'body_water_percent',
  'visceral_fat_level',
  'basal_metabolism_kcal',
  'shoulder_cm',
  'chest_cm',
  'waist_cm',
  'abdomen_cm',
  'hip_cm',
  'neck_cm',
  'right_arm_relaxed_cm',
  'left_arm_relaxed_cm',
  'right_arm_flexed_cm',
  'left_arm_flexed_cm',
  'right_forearm_cm',
  'left_forearm_cm',
  'right_thigh_cm',
  'left_thigh_cm',
  'right_calf_cm',
  'left_calf_cm',
];

const compositionFields = [
  { key: 'body_fat_percent', label: '% Gordura', step: '0.1' },
  { key: 'muscle_mass_kg', label: 'Massa muscular (kg)', step: '0.1' },
  { key: 'lean_mass_kg', label: 'Massa magra (kg)', step: '0.1' },
  { key: 'fat_mass_kg', label: 'Massa gorda (kg)', step: '0.1' },
  { key: 'bone_mass_kg', label: 'Massa ossea (kg)', step: '0.1' },
  { key: 'body_water_percent', label: '% Agua corporal', step: '0.1' },
  { key: 'visceral_fat_level', label: 'Gordura visceral', step: '0.1' },
  { key: 'basal_metabolism_kcal', label: 'Metabolismo basal (kcal)', step: '1' },
];

const anthropometryFields = [
  { key: 'shoulder_cm', label: 'Ombro (cm)' },
  { key: 'chest_cm', label: 'Torax (cm)' },
  { key: 'waist_cm', label: 'Cintura (cm)' },
  { key: 'abdomen_cm', label: 'Abdomen (cm)' },
  { key: 'hip_cm', label: 'Quadril (cm)' },
  { key: 'neck_cm', label: 'Pescoco (cm)' },
  { key: 'right_arm_relaxed_cm', label: 'Braco dir. relaxado (cm)' },
  { key: 'left_arm_relaxed_cm', label: 'Braco esq. relaxado (cm)' },
  { key: 'right_arm_flexed_cm', label: 'Braco dir. flexionado (cm)' },
  { key: 'left_arm_flexed_cm', label: 'Braco esq. flexionado (cm)' },
  { key: 'right_forearm_cm', label: 'Antebraco dir. (cm)' },
  { key: 'left_forearm_cm', label: 'Antebraco esq. (cm)' },
  { key: 'right_thigh_cm', label: 'Coxa dir. (cm)' },
  { key: 'left_thigh_cm', label: 'Coxa esq. (cm)' },
  { key: 'right_calf_cm', label: 'Panturrilha dir. (cm)' },
  { key: 'left_calf_cm', label: 'Panturrilha esq. (cm)' },
];

const comparisonMetrics = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg', decimals: 1 },
  { key: 'bmi', label: 'IMC', decimals: 2 },
  { key: 'body_fat_percent', label: '% Gordura', suffix: '%', decimals: 1 },
  { key: 'muscle_mass_kg', label: 'Massa muscular', unit: 'kg', decimals: 1 },
  { key: 'chest_cm', label: 'Torax', unit: 'cm', decimals: 1 },
  { key: 'waist_cm', label: 'Cintura', unit: 'cm', decimals: 1 },
  { key: 'abdomen_cm', label: 'Abdomen', unit: 'cm', decimals: 1 },
  { key: 'hip_cm', label: 'Quadril', unit: 'cm', decimals: 1 },
];

const defaultForm = {
  evaluated_at: '',
  notes: '',
  ...numericFields.reduce((acc, key) => ({ ...acc, [key]: '' }), {}),
};

function getLocalDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}

function formatMetric(value, decimals = 1) {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  return num.toFixed(decimals).replace(/\.0+$/, '');
}

function formatDelta(current, previous, decimals = 1, suffix = '') {
  if (current === null || current === undefined || previous === null || previous === undefined) return '-';
  const currentNum = Number(current);
  const previousNum = Number(previous);
  if (Number.isNaN(currentNum) || Number.isNaN(previousNum)) return '-';
  const delta = currentNum - previousNum;
  const sign = delta > 0 ? '+' : '';
  const clean = delta.toFixed(decimals).replace(/\.0+$/, '');
  return `${sign}${clean}${suffix}`;
}

function formatMetricWithUnit(value, unit, decimals = 1) {
  const formatted = formatMetric(value, decimals);
  return formatted === '-' ? '-' : `${formatted} ${unit}`;
}

function formatPercent(value, decimals = 1) {
  const formatted = formatMetric(value, decimals);
  return formatted === '-' ? '-' : `${formatted}%`;
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function assessmentToForm(item) {
  const next = { ...defaultForm, evaluated_at: toDateTimeLocal(item.evaluated_at), notes: item.notes || '' };
  numericFields.forEach((field) => {
    const value = item[field];
    next[field] = value === null || value === undefined ? '' : String(value);
  });
  return next;
}

function formatByMetric(value, metric) {
  if (metric.unit) return formatMetricWithUnit(value, metric.unit, metric.decimals);
  if (metric.suffix === '%') return formatPercent(value, metric.decimals);
  return formatMetric(value, metric.decimals);
}

export default function ProfessorAssessments() {
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [form, setForm] = useState({ ...defaultForm, evaluated_at: getLocalDateTime() });
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingAssessmentId, setDeletingAssessmentId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listStudents()
      .then(setStudents)
      .catch(() => setError('Erro ao carregar lista de alunos.'));
  }, []);

  useEffect(() => {
    setEditingAssessmentId(null);
    setForm({ ...defaultForm, evaluated_at: getLocalDateTime() });
    if (!selectedStudentId) {
      setAssessments([]);
      return;
    }
    loadAssessments(selectedStudentId);
  }, [selectedStudentId]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const term = studentSearch.trim().toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        String(s.id) === studentSearch.trim(),
    );
  }, [studentSearch, students]);

  const selectedStudent = useMemo(
    () => students.find((s) => String(s.id) === String(selectedStudentId)) || null,
    [students, selectedStudentId],
  );

  const calculatedBmi = useMemo(() => {
    const weight = Number(form.weight_kg);
    const heightCm = Number(form.height_cm);
    if (Number.isNaN(weight) || Number.isNaN(heightCm) || weight <= 0 || heightCm <= 0) return null;
    const heightM = heightCm / 100;
    return Number((weight / (heightM * heightM)).toFixed(2));
  }, [form.height_cm, form.weight_kg]);

  const comparisonRows = useMemo(() => {
    if (assessments.length < 2) return [];
    const latest = assessments[0];
    const previous = assessments[1];
    return comparisonMetrics.map((metric) => ({
      label: metric.label,
      current: formatByMetric(latest[metric.key], metric),
      previous: formatByMetric(previous[metric.key], metric),
      delta: formatDelta(
        latest[metric.key],
        previous[metric.key],
        metric.decimals || 1,
        metric.suffix || (metric.unit ? ` ${metric.unit}` : ''),
      ),
    }));
  }, [assessments]);

  async function loadAssessments(studentId) {
    setLoadingHistory(true);
    setError('');
    try {
      const data = await listStudentAssessments(studentId);
      setAssessments(data);
    } catch (err) {
      setError('Erro ao carregar historico de avaliacoes.');
    } finally {
      setLoadingHistory(false);
    }
  }

  function buildCreatePayload() {
    const payload = {
      student_id: Number(selectedStudentId),
      notes: form.notes.trim() || undefined,
    };

    if (form.evaluated_at) {
      payload.evaluated_at = new Date(form.evaluated_at).toISOString();
    }

    numericFields.forEach((field) => {
      const raw = String(form[field] ?? '').trim();
      if (!raw) return;
      const numeric = Number(raw);
      if (!Number.isNaN(numeric)) payload[field] = numeric;
    });

    if (payload.bmi === undefined && calculatedBmi !== null) {
      payload.bmi = calculatedBmi;
    }

    return payload;
  }

  function buildUpdatePayload() {
    const payload = {
      evaluated_at: form.evaluated_at ? new Date(form.evaluated_at).toISOString() : null,
      notes: form.notes.trim() || null,
    };

    numericFields.forEach((field) => {
      const raw = String(form[field] ?? '').trim();
      if (!raw) {
        payload[field] = null;
        return;
      }
      const numeric = Number(raw);
      if (!Number.isNaN(numeric)) payload[field] = numeric;
    });

    if (payload.bmi === null && calculatedBmi !== null) {
      payload.bmi = calculatedBmi;
    }

    return payload;
  }

  function resetFormState() {
    setEditingAssessmentId(null);
    setForm({ ...defaultForm, evaluated_at: getLocalDateTime() });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!selectedStudentId) {
      setError('Selecione um aluno para salvar a avaliacao.');
      return;
    }

    setSaving(true);
    try {
      if (editingAssessmentId) {
        await updateStudentAssessment(editingAssessmentId, buildUpdatePayload());
        setMessage('Avaliacao atualizada com sucesso.');
      } else {
        await createStudentAssessment(buildCreatePayload());
        setMessage('Avaliacao salva com sucesso.');
      }
      resetFormState();
      await loadAssessments(selectedStudentId);
    } catch (err) {
      setError(editingAssessmentId ? 'Nao foi possivel atualizar a avaliacao.' : 'Nao foi possivel salvar a avaliacao.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item) {
    setMessage('');
    setError('');
    setEditingAssessmentId(item.id);
    setForm(assessmentToForm(item));
  }

  async function handleDelete(item) {
    if (!selectedStudentId) return;
    const confirmMessage = `Excluir avaliacao de ${formatDate(item.evaluated_at)}?`;
    if (!window.confirm(confirmMessage)) return;

    setMessage('');
    setError('');
    setDeletingAssessmentId(item.id);
    try {
      await deleteStudentAssessment(item.id);
      if (editingAssessmentId === item.id) {
        resetFormState();
      }
      setMessage('Avaliacao excluida com sucesso.');
      await loadAssessments(selectedStudentId);
    } catch (err) {
      setError('Nao foi possivel excluir a avaliacao.');
    } finally {
      setDeletingAssessmentId(null);
    }
  }

  function renderNumberField(field, step = '0.1') {
    return (
      <div key={field.key}>
        <label className="block text-sm font-medium mb-1">{field.label}</label>
        <input
          type="number"
          min="0"
          step={step}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={form[field.key]}
          onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
        />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Avaliacao fisica</p>
        <h1 className="text-2xl font-bold text-slate-900">Composicao e antropometria</h1>
        <p className="text-sm text-slate-600">
          Selecione um aluno e registre uma avaliacao completa: peso, IMC, composicao corporal e medidas.
        </p>
      </div>

      <SectionCard title="Selecionar aluno" description="Busque por ID, nome ou email para abrir o prontuario.">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Buscar aluno</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Digite nome, email ou ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Aluno</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">-- selecione --</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.email}) - ID {student.id}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedStudent && (
          <p className="text-xs text-emerald-700 mt-2">
            Prontuario ativo: {selectedStudent.name} ({selectedStudent.email}) - ID {selectedStudent.id}
          </p>
        )}
      </SectionCard>

      <SectionCard
        title={editingAssessmentId ? 'Editar avaliacao' : 'Nova avaliacao'}
        description={
          editingAssessmentId
            ? 'Altere os dados e salve para atualizar o registro.'
            : 'Preencha os campos necessarios. Campos em branco ficam opcionais.'
        }
      >
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {message && <p className="text-sm text-emerald-600 mb-2">{message}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-2">Dados principais</p>
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Data da avaliacao</label>
                <input
                  type="datetime-local"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.evaluated_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, evaluated_at: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Peso (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.weight_kg}
                  onChange={(e) => setForm((prev) => ({ ...prev, weight_kg: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Altura (cm)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.height_cm}
                  onChange={(e) => setForm((prev) => ({ ...prev, height_cm: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">IMC</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.bmi}
                  onChange={(e) => setForm((prev) => ({ ...prev, bmi: e.target.value }))}
                  placeholder={calculatedBmi !== null ? `Auto: ${calculatedBmi}` : ''}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800 mb-2">Composicao corporal</p>
            <div className="grid md:grid-cols-4 gap-3">
              {compositionFields.map((field) => renderNumberField(field, field.step))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800 mb-2">Antropometria completa</p>
            <div className="grid md:grid-cols-4 gap-3">
              {anthropometryFields.map((field) => renderNumberField(field))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observacoes</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[96px]"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Ex.: protocolo usado, dobra cutanea, observacoes posturais..."
            />
          </div>

          <div className="flex justify-end">
            {editingAssessmentId && (
              <button
                type="button"
                onClick={resetFormState}
                className="mr-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-100"
              >
                Cancelar edicao
              </button>
            )}
            <button
              type="submit"
              disabled={!selectedStudentId || saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvando...' : editingAssessmentId ? 'Atualizar avaliacao' : 'Salvar avaliacao'}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Comparativo automatico"
        description="Comparacao da ultima avaliacao com a imediatamente anterior."
      >
        {!selectedStudentId && (
          <p className="text-sm text-slate-500">Selecione um aluno para visualizar o comparativo.</p>
        )}
        {selectedStudentId && assessments.length < 2 && (
          <p className="text-sm text-slate-500">Sao necessarias pelo menos 2 avaliacoes para comparar.</p>
        )}
        {selectedStudentId && assessments.length >= 2 && (
          <>
            <p className="text-xs text-slate-600 mb-2">
              Ultima: {formatDate(assessments[0]?.evaluated_at)} | Anterior: {formatDate(assessments[1]?.evaluated_at)}
            </p>
            <div className="overflow-auto">
              <table className="w-full text-xs sm:text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-slate-500 uppercase text-xs">
                    <th className="py-2">Indicador</th>
                    <th>Atual</th>
                    <th>Anterior</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="border-b">
                      <td className="py-2 font-medium text-slate-800">{row.label}</td>
                      <td>{row.current}</td>
                      <td>{row.previous}</td>
                      <td className="font-semibold">{row.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Historico de avaliacoes"
        description="Ultimos registros do aluno selecionado para comparacao de evolucao."
      >
        {!selectedStudentId && (
          <p className="text-sm text-slate-500">Selecione um aluno para visualizar o historico.</p>
        )}
        {selectedStudentId && loadingHistory && (
          <p className="text-sm text-slate-500">Carregando avaliacoes...</p>
        )}
        {selectedStudentId && !loadingHistory && (
          <div className="overflow-auto">
            <table className="w-full text-xs sm:text-sm min-w-[980px]">
              <thead>
                <tr className="text-left text-slate-500 uppercase text-xs">
                  <th className="py-2">Data</th>
                  <th>Peso</th>
                  <th>Altura</th>
                  <th>IMC</th>
                  <th>% Gordura</th>
                  <th>Massa muscular</th>
                  <th>Torax</th>
                  <th>Abdomen</th>
                  <th>Cintura</th>
                  <th>Quadril</th>
                  <th>Observacoes</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2 whitespace-nowrap">{formatDate(item.evaluated_at)}</td>
                    <td>{formatMetricWithUnit(item.weight_kg, 'kg')}</td>
                    <td>{formatMetricWithUnit(item.height_cm, 'cm')}</td>
                    <td>{formatMetric(item.bmi, 2)}</td>
                    <td>{formatPercent(item.body_fat_percent)}</td>
                    <td>{formatMetricWithUnit(item.muscle_mass_kg, 'kg')}</td>
                    <td>{formatMetricWithUnit(item.chest_cm, 'cm')}</td>
                    <td>{formatMetricWithUnit(item.abdomen_cm, 'cm')}</td>
                    <td>{formatMetricWithUnit(item.waist_cm, 'cm')}</td>
                    <td>{formatMetricWithUnit(item.hip_cm, 'cm')}</td>
                    <td className="max-w-[280px] truncate">{item.notes || '-'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="text-blue-700 text-xs font-semibold hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={deletingAssessmentId === item.id}
                          className="text-red-700 text-xs font-semibold hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {deletingAssessmentId === item.id ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {assessments.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-sm text-slate-500 py-3">
                      Nenhuma avaliacao registrada para este aluno.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
