import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
import {
  addSessionExercise,
  addSessionExercisesBulk,
  copySessionExercises,
  createPlan,
  createSession,
  deactivatePlan,
  deleteSession,
  deleteSessionExercise,
  getExercises,
  listPlans,
  listSessionExercises,
  listSessions,
  listStudents,
  updateSessionExercise,
} from '../api/client.js';

const SESSION_MAIN_TYPES = [
  { value: '', label: 'Selecione' },
  { value: 'MUSCULACAO', label: 'Musculacao' },
  { value: 'CORRIDA', label: 'Corrida' },
  { value: 'PEDAL', label: 'Pedal' },
  { value: 'OUTRO', label: 'Outro' },
];

const ENDURANCE_WORKOUT_TYPES = [
  { value: '', label: 'Selecione' },
  { value: 'REGENERATIVO', label: 'Regenerativo' },
  { value: 'INTERVALADO', label: 'Intervalado' },
  { value: 'PROGRESSIVO', label: 'Progressivo' },
  { value: 'LONGO', label: 'Longo' },
  { value: 'TIRO', label: 'Tiro' },
  { value: 'TEMPO_RUN', label: 'Tempo/Threshold' },
];

const SESSION_DETAIL_TEMPLATES = {
  MUSCULACAO: 'Aquecimento:\nPrincipal:\nAcessorios:\nFinalizacao:\nNotas:',
  CORRIDA: 'Aquecimento: 10 min leve\nPrincipal: 6x800m Z4 (pausa 90s)\nDesaquecimento: 10 min leve\nRitmo alvo:\nNotas:',
  PEDAL: 'Aquecimento: 10 min leve\nPrincipal:\nDesaquecimento: 10 min leve\nRitmo alvo:\nNotas:',
  OUTRO: 'Objetivo:\nEstrutura:\nNotas:',
};

const MUSCLE_PRESETS = [
  {
    key: 'hipertrofia',
    title: 'Hipertrofia guiada',
    hint: '3-4x8-12 · descanso 60-90s',
    values: {
      sets: '3-4',
      reps: '8-12',
      rest: '60-90s',
      load_progression_type: 'progressao',
      load_progression_step: '+2% se fechar as reps',
      tempo: '2-0-2',
      effort: 'RPE 8-9',
      notes: 'Busque falha tecnica faltando 1-2 reps. Cadencia controlada.',
    },
  },
  {
    key: 'forca',
    title: 'Forca 5x5',
    hint: '5x5 · descanso 120-180s',
    values: {
      sets: '4-5',
      reps: '4-6',
      rest: '120-180s',
      load: '70-85% 1RM',
      load_progression_type: 'progressao',
      load_progression_step: '+2-5kg se tecnica boa',
      tempo: '2-1-1',
      effort: 'RPE 8',
      notes: 'Pausa maior, foco em controle e postura.',
    },
  },
  {
    key: 'resistencia',
    title: 'Resistencia muscular',
    hint: '3x15-20 · descanso 45-60s',
    values: {
      sets: '3',
      reps: '15-20',
      rest: '45-60s',
      load_progression_type: 'progressao',
      load_progression_step: '+1-2 reps antes de subir carga',
      tempo: '2-0-2',
      effort: 'RPE 7-8',
      notes: 'Carga leve/moderada, pouco descanso para sensacao metabolica.',
    },
  },
  {
    key: 'iniciante',
    title: 'Base iniciante / circuito',
    hint: '2-3x12-15 · descanso 30-45s',
    values: {
      sets: '2-3',
      reps: '12-15',
      rest: '30-45s',
      load: 'peso corporal ou leve',
      reps_progression_type: 'progressao',
      reps_progression_step: '+1 rep se facil e tecnica limpa',
      tempo: '2-0-2',
      effort: 'RPE 6-7',
      notes: 'Ensine amplitude e respiracao. Ritmo continuo.',
    },
  },
];

const ENDURANCE_PRESETS = [
  {
    key: 'regenerativo',
    title: 'Regenerativo',
    hint: '20-35min Z1 | leve',
    values: {
      workout_type: 'REGENERATIVO',
      duration_min: '30',
      intensity_zone: 'Z1',
      pace_target: 'leve/confortavel',
      notes: 'Solto, foco em tecnica e economia.',
    },
  },
  {
    key: 'tempo_run',
    title: 'Tempo/Threshold',
    hint: '20-30min Z3-4 | ritmo sustentado',
    values: {
      workout_type: 'TEMPO_RUN',
      duration_min: '25',
      intensity_zone: 'Z3-4',
      pace_target: 'ritmo sustentado',
      notes: '10min aquece + 20min ritmo + 10min desaquec.',
    },
  },
  {
    key: 'intervalado',
    title: 'Intervalado',
    hint: '6x800m Z4 | pausa 90s',
    values: {
      workout_type: 'INTERVALADO',
      intensity_zone: 'Z4',
      pace_target: 'forte',
      terrain: 'pista',
      notes: '6x800m Z4, pausa 90s trote.',
    },
  },
  {
    key: 'longo',
    title: 'Longo',
    hint: '60-90min Z2 | ritmo confortavel',
    values: {
      workout_type: 'LONGO',
      duration_min: '75',
      intensity_zone: 'Z2',
      pace_target: 'confortavel',
      notes: 'Rodagem longa, foco em resistencia.',
    },
  },
  {
    key: 'progressivo',
    title: 'Progressivo',
    hint: '30-40min Z2-Z4 | acelera gradual',
    values: {
      workout_type: 'PROGRESSIVO',
      duration_min: '35',
      intensity_zone: 'Z2-Z4',
      pace_target: 'progressivo',
      notes: 'Comece leve e acelere a cada 10min.',
    },
  },
  {
    key: 'tiro',
    title: 'Tiro curto',
    hint: '10x200m Z5 | pausa 200m',
    values: {
      workout_type: 'TIRO',
      intensity_zone: 'Z5',
      pace_target: 'muito forte',
      terrain: 'pista',
      notes: '10x200m Z5, pausa 200m trote.',
    },
  },
];

const SET_DETAIL_PRESETS = [
  {
    key: 'piramide',
    title: 'Piramide 12-10-8',
    details: [
      { reps: '12', load: 'leve' },
      { reps: '10', load: '+5% ou +2kg' },
      { reps: '8', load: '+10% ou +4kg' },
    ],
    note: 'Aumente carga a cada serie para recrutar mais fibras.',
  },
  {
    key: 'top_backoff',
    title: 'Top set + backoff',
    details: [
      { reps: '6', load: 'pesado (top set)' },
      { reps: '10', load: '-15% carga' },
    ],
    note: 'Estilo powerbuilding: um set pesado + volume mais leve.',
  },
  {
    key: 'dropset',
    title: 'Drop set final',
    details: [
      { reps: '10', load: 'normal' },
      { reps: '8', load: '-20% sem pausa' },
      { reps: 'max', load: 'peso corporal' },
    ],
    note: 'Executar os drops com minimo descanso para pump.',
  },
];

const TRAINING_BLOCKS = [
  { value: '', label: 'Bloco do treino (opcional)' },
  { value: 'aquecimento', label: 'Aquecimento' },
  { value: 'principal', label: 'Bloco principal' },
  { value: 'acessorio', label: 'Acessorio/estabilidade' },
  { value: 'finalizacao', label: 'Finalizacao/metabolico' },
];

const normalizeBisetGroup = (value) => String(value || '').trim().toUpperCase();

const orderValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function getNextBisetGroup(current) {
  const normalized = normalizeBisetGroup(current).replace(/[^A-Z]/g, '');
  if (!normalized) return 'A';
  const chars = normalized.split('');
  let idx = chars.length - 1;
  while (idx >= 0 && chars[idx] === 'Z') {
    chars[idx] = 'A';
    idx -= 1;
  }
  if (idx < 0) chars.unshift('A');
  else chars[idx] = String.fromCharCode(chars[idx].charCodeAt(0) + 1);
  return chars.join('');
}

/**
 * Tela de planos/sessoes com foco em montar series detalhadas e gerenciar exercicios.
 * - Seleciona aluno vinculado.
 * - Cria/lista planos.
 * - Cria/lista sessoes (templates 3x/4x/5x).
 * - Adiciona exercicios (musculacao ou corrida/pedal) com parametros.
 * - Exclui sessao e exercicio.
 */
export default function ProfessorPlans() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [plans, setPlans] = useState([]);
  const [archivedPlans, setArchivedPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionExercises, setSessionExercises] = useState([]);
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [bulkSelection, setBulkSelection] = useState([]);
  const [showExerciseBuilder, setShowExerciseBuilder] = useState(false);
  const [bulkParams, setBulkParams] = useState({
    sets: '',
    reps: '',
    load: '',
    rest: '',
    notes: '',
    workout_type: '',
    duration_min: '',
    distance_km: '',
    pace_target: '',
    intensity_zone: '',
    terrain: '',
  });

  const [planForm, setPlanForm] = useState({ name: '', goal: '', start_date: '', end_date: '', notes: '' });
  const [sessionForm, setSessionForm] = useState({ name: '', sequence: '', main_type: '', notes: '' });
  const [sessionExerciseForm, setSessionExerciseForm] = useState({
    exercise_id: '',
    order: 1,
    params: {
      sets: '',
      reps: '',
      load: '',
      rest: '',
      biset_group: '',
      tempo: '',
      effort: '',
      block: '',
      workout_type: '',
      duration_min: '',
      distance_km: '',
      pace_target: '',
      intensity_zone: '',
      terrain: '',
      notes: '',
      load_progression_type: '',
      load_progression_step: '',
      reps_progression_type: '',
      reps_progression_step: '',
      set_details: [{ reps: '', load: '' }],
    },
    notes: '',
  });
  const [editingExerciseId, setEditingExerciseId] = useState(null);
  const [copySource, setCopySource] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function createEmptySetDetails() {
    return [{ reps: '', load: '' }];
  }

  function createEmptyParams() {
    return {
      sets: '',
      reps: '',
      load: '',
      rest: '',
      biset_group: '',
      tempo: '',
      effort: '',
      block: '',
      workout_type: '',
      duration_min: '',
      distance_km: '',
      pace_target: '',
      intensity_zone: '',
      terrain: '',
      notes: '',
      load_progression_type: '',
      load_progression_step: '',
      reps_progression_type: '',
      reps_progression_step: '',
      set_details: createEmptySetDetails(),
    };
  }

  function normalizeParams(rawParams) {
    const base = createEmptyParams();
    const next = { ...base };
    if (rawParams && typeof rawParams === 'object') {
      Object.entries(rawParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined) next[key] = value;
      });
    }
    const rawDetails = Array.isArray(rawParams?.set_details) ? rawParams.set_details : [];
    next.set_details = rawDetails.length
      ? rawDetails.map((row) => ({ reps: row?.reps ?? '', load: row?.load ?? '' }))
      : createEmptySetDetails();
    return next;
  }

  function resetSessionExerciseForm(orderValue = 1) {
    setSessionExerciseForm({
      exercise_id: '',
      order: orderValue,
      params: createEmptyParams(),
      notes: '',
    });
    setExerciseQuery('');
    setEditingExerciseId(null);
  }

  function startEditExercise(item) {
    if (!item) return;
    const selected = exerciseOptions.find((ex) => ex.id === Number(item.exercise_id));
    setSessionExerciseForm({
      exercise_id: String(item.exercise_id || ''),
      order: item.order || 1,
      params: normalizeParams(item.params || {}),
      notes: item.notes || '',
    });
    setExerciseQuery(selected?.name || '');
    setEditingExerciseId(item.id);
    setShowExerciseBuilder(true);
    setError('');
    setMessage('');
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function findBestExerciseMatch(query, options) {
    const term = normalizeText(query);
    if (!term) return null;
    const exactName = options.find((ex) => normalizeText(ex.name) === term);
    if (exactName) return exactName;
    const startsName = options.find((ex) => normalizeText(ex.name).startsWith(term));
    if (startsName) return startsName;
    const startsGroup = options.find((ex) => normalizeText(ex.group || '').startsWith(term));
    if (startsGroup) return startsGroup;
    const containsName = options.find((ex) => normalizeText(ex.name).includes(term));
    if (containsName) return containsName;
    const containsGroup = options.find((ex) => normalizeText(ex.group || '').includes(term));
    if (containsGroup) return containsGroup;
    return null;
  }

  function updateSetDetail(index, field, value) {
    setSessionExerciseForm((prev) => {
      const current = prev.params.set_details || [];
      const next = current.map((row, idx) => (idx === index ? { ...row, [field]: value } : row));
      return { ...prev, params: { ...prev.params, set_details: next } };
    });
  }

  function addSetDetail() {
    setSessionExerciseForm((prev) => ({
      ...prev,
      params: { ...prev.params, set_details: [...(prev.params.set_details || []), { reps: '', load: '' }] },
    }));
  }

  function removeSetDetail(index) {
    setSessionExerciseForm((prev) => {
      const current = prev.params.set_details || [];
      const next = current.filter((_, idx) => idx !== index);
      return { ...prev, params: { ...prev.params, set_details: next.length ? next : [{ reps: '', load: '' }] } };
    });
  }

  function applyFormBisetGroup(value) {
    setSessionExerciseForm((prev) => ({
      ...prev,
      params: {
        ...prev.params,
        biset_group: normalizeBisetGroup(value),
      },
    }));
  }

  function applySessionTemplate(type) {
    const key = (type || 'MUSCULACAO').toUpperCase();
    const template = SESSION_DETAIL_TEMPLATES[key] || SESSION_DETAIL_TEMPLATES.MUSCULACAO;
    setSessionForm((prev) => ({ ...prev, notes: template }));
  }

  function applyMusclePreset(preset) {
    if (!preset) return;
    setSessionExerciseForm((prev) => ({
      ...prev,
      params: {
        ...prev.params,
        ...preset.values,
        set_details: preset.values.set_details || prev.params.set_details,
        notes: preset.values.notes || prev.params.notes,
      },
      notes: prev.notes,
    }));
    setMessage(`Preset "${preset.title}" aplicado.`);
    setError('');
  }

  function applyEndurancePreset(preset) {
    if (!preset) return;
    setSessionExerciseForm((prev) => ({
      ...prev,
      params: {
        ...prev.params,
        ...preset.values,
        notes: preset.values.notes || prev.params.notes,
      },
      notes: prev.notes,
    }));
    setMessage(`Preset "${preset.title}" aplicado.`);
    setError('');
  }

  function applySetDetailPreset(preset) {
    if (!preset) return;
    setSessionExerciseForm((prev) => ({
      ...prev,
      params: {
        ...prev.params,
        set_details: preset.details.map((d) => ({ reps: d.reps, load: d.load })),
        notes: preset.note ? `${preset.note}${prev.params.notes ? ` | ${prev.params.notes}` : ''}` : prev.params.notes,
      },
      notes: prev.notes,
    }));
  }

  useEffect(() => {
    listStudents().then(setStudents).catch(() => setStudents([]));
    getExercises().then(setExerciseOptions).catch(() => setExerciseOptions([]));
  }, []);

  function splitPlansByStatus(items) {
    const active = [];
    const archived = [];
    (items || []).forEach((plan) => {
      if (plan?.active === false) archived.push(plan);
      else active.push(plan);
    });
    return { active, archived };
  }

  async function loadPlans() {
    if (!studentId) return;
    try {
      const data = await listPlans(studentId, { includeInactive: true });
      const { active, archived } = splitPlansByStatus(data);
      setPlans(active);
      setArchivedPlans(archived);
      setSelectedPlan(null);
      setSessions([]);
      setSelectedSession(null);
      setSessionExercises([]);
      setMessage('');
      setError('');
    } catch {
      setError('Erro ao carregar planos.');
    }
  }

  useEffect(() => {
    if (selectedPlan) {
      listSessions(selectedPlan.id)
        .then((sess) => {
          setSessions(sess);
          setSelectedSession(null);
          setSessionExercises([]);
        })
        .catch(() => {
          setSessions([]);
          setSelectedSession(null);
          setSessionExercises([]);
        });
    }
  }, [selectedPlan]);

  useEffect(() => {
    if (selectedSession) {
      listSessionExercises(selectedSession.id)
        .then(setSessionExercises)
        .catch(() => setSessionExercises([]));
    } else {
      setSessionExercises([]);
    }
  }, [selectedSession]);

  useEffect(() => {
    setShowExerciseBuilder(false);
  }, [selectedSession]);

  useEffect(() => {
    const maxSequence = sessions.length ? Math.max(...sessions.map((s) => Number(s.sequence) || 0)) : 0;
    setSessionForm((prev) => {
      if (prev.sequence) return prev;
      return { ...prev, sequence: (maxSequence || 0) + 1 || 1 };
    });
  }, [sessions]);

  const nextOrder = useMemo(() => {
    if (!sessionExercises.length) return 1;
    const maxOrder = Math.max(...sessionExercises.map((ex) => Number(ex.order) || 0));
    return (maxOrder || 0) + 1;
  }, [sessionExercises]);

  const bisetMetaByItemId = useMemo(() => {
    const grouped = {};
    const sorted = [...sessionExercises].sort(
      (a, b) => orderValue(a.order) - orderValue(b.order) || (Number(a.id) || 0) - (Number(b.id) || 0),
    );
    sorted.forEach((item) => {
      const group = normalizeBisetGroup(item?.params?.biset_group);
      if (!group) return;
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(item);
    });
    const map = {};
    Object.entries(grouped).forEach(([group, items]) => {
      items.forEach((item, idx) => {
        map[item.id] = {
          group,
          position: idx + 1,
          total: items.length,
          isLast: idx === items.length - 1,
        };
      });
    });
    return map;
  }, [sessionExercises]);

  const bisetGroups = useMemo(() => {
    const groups = new Set();
    sessionExercises.forEach((item) => {
      const group = normalizeBisetGroup(item?.params?.biset_group);
      if (group) groups.add(group);
    });
    return [...groups].sort();
  }, [sessionExercises]);

  const lastUsedBisetGroup = useMemo(() => {
    const sorted = [...sessionExercises].sort(
      (a, b) => orderValue(a.order) - orderValue(b.order) || (Number(a.id) || 0) - (Number(b.id) || 0),
    );
    for (let idx = sorted.length - 1; idx >= 0; idx -= 1) {
      const group = normalizeBisetGroup(sorted[idx]?.params?.biset_group);
      if (group) return group;
    }
    return '';
  }, [sessionExercises]);

  const suggestedBisetGroup = getNextBisetGroup(lastUsedBisetGroup);
  const normalizedFormBisetGroup = normalizeBisetGroup(sessionExerciseForm.params?.biset_group);
  const normalizedFormRest = String(sessionExerciseForm.params?.rest || '').trim();
  const formOrder = orderValue(sessionExerciseForm.order || nextOrder || 1);
  const groupItemsExcludingForm = useMemo(() => (
    sessionExercises
      .filter((item) => item.id !== editingExerciseId && normalizeBisetGroup(item?.params?.biset_group) === normalizedFormBisetGroup)
      .sort((a, b) => orderValue(a.order) - orderValue(b.order) || (Number(a.id) || 0) - (Number(b.id) || 0))
  ), [sessionExercises, editingExerciseId, normalizedFormBisetGroup]);
  const hasLaterItemInGroup = groupItemsExcludingForm.some((item) => orderValue(item.order) > formOrder);
  const formLikelyLastInGroup = Boolean(normalizedFormBisetGroup) && !hasLaterItemInGroup;

  useEffect(() => {
    setBulkSelection([]);
    setBulkParams({
      sets: '',
      reps: '',
      load: '',
      rest: '',
      notes: '',
      workout_type: '',
      duration_min: '',
      distance_km: '',
      pace_target: '',
      intensity_zone: '',
      terrain: '',
    });
    if (selectedSession) {
      resetSessionExerciseForm(1);
    } else {
      setEditingExerciseId(null);
    }
  }, [selectedSession]);

  useEffect(() => {
    if (selectedSession && !editingExerciseId) {
      setSessionExerciseForm((prev) => ({ ...prev, order: nextOrder || 1 }));
    }
  }, [nextOrder, selectedSession, editingExerciseId]);

  const normalizeDate = (value) => {
    if (!value) return null;
    if (value.includes('/')) {
      const [d, m, y] = value.split('/');
      if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return value;
  };

  async function handleCreatePlan(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!studentId) {
      setError('Selecione um aluno.');
      return;
    }
    try {
      const created = await createPlan({
        ...planForm,
        student_id: Number(studentId),
        start_date: normalizeDate(planForm.start_date),
        end_date: normalizeDate(planForm.end_date),
      });
      setPlans((prev) => [created, ...prev]);
      setPlanForm({ name: '', goal: '', start_date: '', end_date: '', notes: '' });
      setMessage('Plano criado.');
    } catch {
      setError('Erro ao criar plano.');
    }
  }
  async function handleCreateSession(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!selectedPlan) {
      setError('Selecione um plano.');
      return;
    }
    try {
      const payload = {
        ...sessionForm,
        plan_id: selectedPlan.id,
        sequence: sessionForm.sequence ? Number(sessionForm.sequence) : undefined,
      };
      await createSession(payload);
      const refreshed = await listSessions(selectedPlan.id);
      setSessions(refreshed);
      setSessionForm({ name: '', sequence: '', main_type: '', notes: '' });
      setMessage('Sessao criada.');
    } catch {
      setError('Erro ao criar sessao.');
    }
  }

  async function handleDeactivatePlan(plan) {
    if (!plan) return;
    const confirmDeactivate = window.confirm(`Desativar o plano "${plan.name}"?`);
    if (!confirmDeactivate) return;
    setError('');
    setMessage('');
    try {
      await deactivatePlan(plan.id);
      const refreshed = await listPlans(studentId, { includeInactive: true });
      const { active, archived } = splitPlansByStatus(refreshed);
      setPlans(active);
      setArchivedPlans(archived);
      if (selectedPlan?.id === plan.id) {
        setSelectedPlan(null);
        setSessions([]);
        setSelectedSession(null);
        setSessionExercises([]);
      }
      setMessage('Plano desativado e movido para o historico.');
    } catch {
      setError('Erro ao desativar plano.');
    }
  }

  async function createTemplate(sessionsTemplate, mainType) {
    if (!selectedPlan) return;
    setError('');
    setMessage('');
    try {
      const normalizedType = typeof mainType === 'string' && mainType.trim()
        ? mainType.trim().toUpperCase()
        : 'MUSCULACAO';
      const templateNotes = SESSION_DETAIL_TEMPLATES[normalizedType] || '';
      for (const p of sessionsTemplate) {
        await createSession({
          plan_id: selectedPlan.id,
          name: p.name,
          sequence: p.sequence,
          main_type: normalizedType,
          notes: templateNotes,
        });
      }
      const sess = await listSessions(selectedPlan.id);
      setSessions(sess);
      setMessage(`Template com ${sessionsTemplate.length} treinos criado.`);
    } catch {
      setError('Erro ao criar template.');
    }
  }

  async function handleDeleteSession(id) {
    setError('');
    setMessage('');
    try {
      await deleteSession(id);
      const sess = await listSessions(selectedPlan.id);
      setSessions(sess);
      setSelectedSession(null);
      setSessionExercises([]);
      setMessage('Sessao excluida.');
    } catch {
      setError('Erro ao excluir sessao.');
    }
  }

  async function handleDeleteExercise(id) {
    setError('');
    setMessage('');
    try {
      await deleteSessionExercise(id);
      const data = await listSessionExercises(selectedSession.id);
      setSessionExercises(data);
      if (editingExerciseId === id) {
        resetSessionExerciseForm(nextOrder || 1);
      }
      setMessage('Exercicio removido.');
    } catch {
      setError('Erro ao remover exercicio.');
    }
  }
  function toggleBulkSelection(id) {
    setBulkSelection((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  const sessionMode = (selectedSession?.main_type || '').toUpperCase();
  const sessionAllowsRun = sessionMode.includes('CORRIDA');
  const sessionAllowsBike = sessionMode.includes('PEDAL');
  const sessionIsEndurance = sessionAllowsRun || sessionAllowsBike;
  const sessionFormMode = (sessionForm.main_type || '').toUpperCase();
  const sessionFormIsEndurance = sessionFormMode.includes('CORRIDA') || sessionFormMode.includes('PEDAL');
  const templateMainType = sessionForm.main_type || (sessionFormIsEndurance ? 'CORRIDA' : 'MUSCULACAO');

  async function handleBulkAdd() {
    if (!selectedSession) {
      setError('Selecione uma sessao.');
      return;
    }
    if (bulkSelection.length === 0) {
      setError('Escolha pelo menos um exercicio na lista rapida.');
      return;
    }
    setError('');
    setMessage('');
    const baseParams = sessionIsEndurance
      ? {
          workout_type: bulkParams.workout_type || null,
          duration_min: bulkParams.duration_min || null,
          distance_km: bulkParams.distance_km || null,
          pace_target: bulkParams.pace_target || null,
          intensity_zone: bulkParams.intensity_zone || null,
          terrain: bulkParams.terrain || null,
          notes: bulkParams.notes || null,
        }
      : {
          sets: bulkParams.sets || null,
          reps: bulkParams.reps || null,
          load: bulkParams.load || null,
          rest: bulkParams.rest || null,
          notes: bulkParams.notes || null,
        };
    const payload = bulkSelection.map((id, idx) => ({
      exercise_id: Number(id),
      order: nextOrder + idx,
      params: baseParams,
      notes: null,
    }));
    try {
      await addSessionExercisesBulk(selectedSession.id, payload);
      const data = await listSessionExercises(selectedSession.id);
      setSessionExercises(data);
      setBulkSelection([]);
      setMessage('Exercicios adicionados.');
      setSessionExerciseForm((prev) => ({ ...prev, order: nextOrder + payload.length }));
    } catch {
      setError('Erro ao adicionar exercicios em lote.');
    }
  }

  const selectedExercise = exerciseOptions.find((ex) => ex.id === Number(sessionExerciseForm.exercise_id));
  const filteredExerciseOptions = exerciseOptions.filter((ex) => {
    if (ex.active === false) return false;
    // Filtra pela modalidade da sessão para não misturar corrida com musculação.
    if (selectedSession?.main_type) {
      const exIsEndurance = ex.type === 'CORRIDA' || ex.type === 'PEDAL';
      if (sessionIsEndurance) {
        if (sessionAllowsRun && !sessionAllowsBike && ex.type !== 'CORRIDA') return false;
        if (sessionAllowsBike && !sessionAllowsRun && ex.type !== 'PEDAL') return false;
        if (!exIsEndurance) return false;
      } else if (exIsEndurance) {
        return false;
      }
    }
    if (!exerciseSearch) return true;
    const term = exerciseSearch.toLowerCase();
    return (
      ex.name.toLowerCase().includes(term) ||
      (ex.group || '').toLowerCase().includes(term) ||
      (ex.type || '').toLowerCase().includes(term)
    );
  });
  const editingExerciseOption = exerciseOptions.find((ex) => ex.id === Number(sessionExerciseForm.exercise_id));
  const visibleExerciseOptions = editingExerciseId && editingExerciseOption
    ? (
      filteredExerciseOptions.some((ex) => ex.id === editingExerciseOption.id)
        ? filteredExerciseOptions
        : [editingExerciseOption, ...filteredExerciseOptions]
    )
    : filteredExerciseOptions;
  const exerciseQuickSuggestions = useMemo(() => {
    const base = visibleExerciseOptions.slice(0, 8);
    if (!exerciseQuery) return base;
    const term = normalizeText(exerciseQuery);
    const ranked = [...visibleExerciseOptions].sort((a, b) => {
      const aName = normalizeText(a.name);
      const bName = normalizeText(b.name);
      const aScore = aName === term ? 0 : aName.startsWith(term) ? 1 : aName.includes(term) ? 2 : 3;
      const bScore = bName === term ? 0 : bName.startsWith(term) ? 1 : bName.includes(term) ? 2 : 3;
      return aScore - bScore;
    });
    return ranked.slice(0, 8);
  }, [visibleExerciseOptions, exerciseQuery]);
  const workoutTypeLabel = (value) => {
    if (!value) return '';
    const found = ENDURANCE_WORKOUT_TYPES.find((option) => option.value === value);
    return found ? found.label : value;
  };

  const muscleSummary = () => {
    const parts = [];
    if (sessionExerciseForm.params.sets || sessionExerciseForm.params.reps) {
      parts.push(`Series/reps: ${sessionExerciseForm.params.sets || '?'}x${sessionExerciseForm.params.reps || '?'}`);
    }
    if (sessionExerciseForm.params.load) parts.push(`Carga: ${sessionExerciseForm.params.load}`);
    if (sessionExerciseForm.params.rest) parts.push(`Descanso: ${sessionExerciseForm.params.rest}`);
    if (sessionExerciseForm.params.biset_group) parts.push(`Biset: ${sessionExerciseForm.params.biset_group}`);
    if (sessionExerciseForm.params.tempo) parts.push(`Tempo/cadencia: ${sessionExerciseForm.params.tempo}`);
    if (sessionExerciseForm.params.effort) parts.push(`Esforco: ${sessionExerciseForm.params.effort}`);
    if (sessionExerciseForm.params.block) parts.push(`Bloco: ${sessionExerciseForm.params.block}`);
    return parts.join(' - ');
  };
  const enduranceSummary = () => {
    const parts = [];
    if (sessionExerciseForm.params.workout_type) {
      parts.push(`Tipo: ${workoutTypeLabel(sessionExerciseForm.params.workout_type)}`);
    }
    if (sessionExerciseForm.params.duration_min) parts.push(`Duracao: ${sessionExerciseForm.params.duration_min} min`);
    if (sessionExerciseForm.params.distance_km) parts.push(`Distancia: ${sessionExerciseForm.params.distance_km} km`);
    if (sessionExerciseForm.params.pace_target) parts.push(`Pace: ${sessionExerciseForm.params.pace_target}`);
    if (sessionExerciseForm.params.intensity_zone) parts.push(`Zona: ${sessionExerciseForm.params.intensity_zone}`);
    if (sessionExerciseForm.params.terrain) parts.push(`Terreno: ${sessionExerciseForm.params.terrain}`);
    return parts.join(' - ');
  };


  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Planos e sessoes</p>
        <h1 className="text-2xl font-bold text-slate-900">Planos de treino</h1>
        <p className="text-sm text-slate-600">Monte series detalhadas ou treinos de corrida para cada aluno.</p>
      </div>

      <SectionCard
        title="Selecionar aluno"
        description="Use o aluno vinculado para listar e criar planos."
        actions={
          <button onClick={loadPlans} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">
            Buscar planos
          </button>
        }
      >
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm text-slate-700">Aluno</label>
          <select className="border rounded-lg px-3 py-2 text-sm" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Selecione</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        {message && <p className="text-emerald-600 text-sm mt-2">{message}</p>}
      </SectionCard>

      <SectionCard title="Criar plano" description="Nome, objetivo e datas ajudam o aluno a entender o proposito.">
        <form onSubmit={handleCreatePlan} className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Objetivo</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={planForm.goal} onChange={(e) => setPlanForm({ ...planForm, goal: e.target.value })} placeholder="Hipertrofia, Meia maratona..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Inicio</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={planForm.start_date} onChange={(e) => setPlanForm({ ...planForm, start_date: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fim (opcional)</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={planForm.end_date} onChange={(e) => setPlanForm({ ...planForm, end_date: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Observacoes</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" value={planForm.notes} onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })} rows={2} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">Criar plano</button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Planos ativos do aluno" description="Selecione um plano ativo para gerenciar sessoes.">
        <div className="grid md:grid-cols-2 gap-3">
          {plans.map((plan) => (
            <div key={plan.id} className={`border rounded-lg p-3 ${selectedPlan?.id === plan.id ? 'border-blue-500 shadow' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="text-left">
                  <p className="font-semibold text-slate-800">{plan.name}</p>
                  <p className="text-xs text-slate-500">{plan.goal || 'Sem objetivo definido'}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{plan.start_date?.slice(0, 10)}  -  {plan.end_date ? plan.end_date.slice(0, 10) : 'Sem fim'}</p>
                </div>
                <button
                  className="text-xs text-amber-700 underline"
                  onClick={() => handleDeactivatePlan(plan)}
                >
                  Desativar
                </button>
              </div>
              <div className="mt-2 text-right">
                <button
                  className="text-xs text-blue-600 underline"
                  onClick={() => setSelectedPlan(plan)}
                >
                  {selectedPlan?.id === plan.id ? 'Selecionado' : 'Selecionar'}
                </button>
              </div>
            </div>
          ))}
          {plans.length === 0 && <p className="text-sm text-slate-500">Nenhum plano para este aluno.</p>}
        </div>
      </SectionCard>
      <SectionCard title="Historico de planos desativados" description="Planos desativados ficam salvos para consulta.">
        <div className="grid md:grid-cols-2 gap-3">
          {archivedPlans.map((plan) => (
            <div key={plan.id} className="border rounded-lg p-3 bg-slate-50">
              <div className="flex justify-between items-start gap-2">
                <div className="text-left">
                  <p className="font-semibold text-slate-800">{plan.name}</p>
                  <p className="text-xs text-slate-500">{plan.goal || 'Sem objetivo definido'}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{plan.start_date?.slice(0, 10)}  -  {plan.end_date ? plan.end_date.slice(0, 10) : 'Sem fim'}</p>
                  <p className="text-[11px] text-slate-500">Desativado em: {plan.archived_at?.slice(0, 10) || '-'}</p>
                </div>
                <span className="text-[11px] px-2 py-1 rounded bg-amber-100 text-amber-800 font-semibold">Desativado</span>
              </div>
            </div>
          ))}
          {archivedPlans.length === 0 && <p className="text-sm text-slate-500">Nenhum plano desativado para este aluno.</p>}
        </div>
      </SectionCard>
      {selectedPlan && (
        <>
          <SectionCard title={`Adicionar sessao ao plano "${selectedPlan.name}"`}>
            <div className="flex flex-wrap gap-2 mb-3">
              {sessionFormIsEndurance ? (
                <>
                  <button type="button" className="bg-slate-100 text-slate-800 px-3 py-1 rounded text-sm" onClick={() => createTemplate([
                    { name: 'Treino 1 - Rodagem leve', sequence: 1 },
                    { name: 'Treino 2 - Intervalado', sequence: 2 },
                    { name: 'Treino 3 - Longo', sequence: 3 },
                  ], templateMainType)}>Template 3 corridas</button>
                  <button type="button" className="bg-slate-100 text-slate-800 px-3 py-1 rounded text-sm" onClick={() => createTemplate([
                    { name: 'Treino 1 - Rodagem leve', sequence: 1 },
                    { name: 'Treino 2 - Intervalado', sequence: 2 },
                    { name: 'Treino 3 - Tempo/Threshold', sequence: 3 },
                    { name: 'Treino 4 - Longo', sequence: 4 },
                  ], templateMainType)}>Template 4 corridas</button>
                  <button type="button" className="bg-slate-100 text-slate-800 px-3 py-1 rounded text-sm" onClick={() => createTemplate([
                    { name: 'Treino 1 - Regenerativo', sequence: 1 },
                    { name: 'Treino 2 - Intervalado', sequence: 2 },
                    { name: 'Treino 3 - Progressivo', sequence: 3 },
                    { name: 'Treino 4 - Tempo/Threshold', sequence: 4 },
                    { name: 'Treino 5 - Longo', sequence: 5 },
                  ], templateMainType)}>Template 5 corridas</button>
                </>
              ) : (
                <>
                  <button type="button" className="bg-slate-100 text-slate-800 px-3 py-1 rounded text-sm" onClick={() => createTemplate([
                    { name: 'Treino 1 - Peito/Triceps', sequence: 1 },
                    { name: 'Treino 2 - Costas/Biceps', sequence: 2 },
                    { name: 'Treino 3 - Pernas/Ombro', sequence: 3 },
                  ], templateMainType)}>Template 3 treinos</button>
                  <button type="button" className="bg-slate-100 text-slate-800 px-3 py-1 rounded text-sm" onClick={() => createTemplate([
                    { name: 'Treino 1 - Peito/Triceps', sequence: 1 },
                    { name: 'Treino 2 - Costas/Biceps', sequence: 2 },
                    { name: 'Treino 3 - Pernas', sequence: 3 },
                    { name: 'Treino 4 - Ombro/Core', sequence: 4 },
                  ], templateMainType)}>Template 4 treinos</button>
                  <button type="button" className="bg-slate-100 text-slate-800 px-3 py-1 rounded text-sm" onClick={() => createTemplate([
                    { name: 'Treino 1 - Peito/Triceps', sequence: 1 },
                    { name: 'Treino 2 - Costas/Biceps', sequence: 2 },
                    { name: 'Treino 3 - Pernas', sequence: 3 },
                    { name: 'Treino 4 - Ombro', sequence: 4 },
                    { name: 'Treino 5 - Core/Fullbody', sequence: 5 },
                  ], templateMainType)}>Template 5 treinos</button>
                </>
              )}
            </div>
            <form onSubmit={handleCreateSession} className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nome da sessao</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Número do treino (ordem inicial)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={sessionForm.sequence}
                  onChange={(e) => setSessionForm({ ...sessionForm, sequence: e.target.value })}
                  placeholder="1, 2, 3..."
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Modalidade principal</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={sessionForm.main_type}
                  onChange={(e) => setSessionForm({ ...sessionForm, main_type: e.target.value })}
                >
                  {SESSION_MAIN_TYPES.map((option) => (
                    <option key={option.value || 'blank'} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-sm font-medium">Detalhamento do treino</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs text-blue-600 underline"
                      onClick={() => applySessionTemplate(sessionForm.main_type)}
                    >
                      Aplicar modelo
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-500 underline"
                      onClick={() => setSessionForm({ ...sessionForm, notes: '' })}
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  rows={4}
                  value={sessionForm.notes}
                  onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                  placeholder="Escreva o treino completo do aluno (aquecimento, principal, observacoes)."
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">Criar sessao</button>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Sessoes do plano">
            <div className="grid md:grid-cols-3 gap-3">
              {sessions.map((s) => (
                <div key={s.id} className={`border rounded-lg p-3 ${selectedSession?.id === s.id ? 'border-blue-500 shadow' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="text-left">
                      <p className="font-semibold text-slate-800">Treino {s.sequence || '?'} - {s.name}</p>
                      <p className="text-xs text-slate-500">Ordem inicial - {s.main_type || 'Modalidade'}</p>
                      {s.notes && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer">Ver detalhes</summary>
                          <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{s.notes}</p>
                        </details>
                      )}
                    </div>
                    <button
                      className="text-xs text-red-600 underline"
                      onClick={() => handleDeleteSession(s.id)}
                    >
                      Excluir
                    </button>
                  </div>
                  <div className="mt-2 text-right">
                    <button
                      className="text-xs text-blue-600 underline"
                      onClick={() => setSelectedSession(s)}
                    >
                      {selectedSession?.id === s.id ? 'Selecionada' : 'Selecionar'}
                    </button>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && <p className="text-sm text-slate-500">Nenhuma sessao ainda.</p>}
            </div>
          </SectionCard>
          {selectedSession && (
            <>
              <SectionCard
                title={`Detalhes da sessao "${selectedSession.name}"`}
                description="Resumo rapido do treino do aluno."
                actions={
                  <button
                    type="button"
                    className="text-xs text-blue-600 underline"
                    onClick={() => setShowExerciseBuilder((prev) => !prev)}
                  >
                    {showExerciseBuilder ? 'Ocultar opcoes de exercicios' : 'Mostrar opcoes de exercicios'}
                  </button>
                }
              >
                <div className="text-sm text-slate-700 whitespace-pre-line">
                  {selectedSession.notes || 'Sem detalhamento nesta sessao.'}
                </div>
                <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-3">
                  <span>Exercicios cadastrados: {sessionExercises.length}</span>
                  <span>Detalhe definido na criacao da sessao.</span>
                </div>
              </SectionCard>

              {showExerciseBuilder && (
                <SectionCard
                  title={`Exercicios da sessao "${selectedSession.name}"`}
                  description={sessionIsEndurance
                    ? 'Painel guiado para corrida: use a biblioteca e presets de corrida para preencher duracao, ritmo e intervalos.'
                    : 'Painel guiado (inspirado no Tecnofit): use a biblioteca e presets de musculacao para preencher series/reps/carga.'}
                  actions={
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        className="border rounded px-2 py-1 text-sm"
                        placeholder="Buscar exercicio na lista"
                        value={exerciseSearch}
                        onChange={(e) => setExerciseSearch(e.target.value)}
                      />
                      <select className="border rounded px-2 py-1 text-sm" value={copySource} onChange={(e) => setCopySource(e.target.value)}>
                        <option value="">Copiar de sessao...</option>
                        {sessions.filter((s) => s.id !== selectedSession.id).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <button
                        className="bg-slate-100 px-3 py-1 rounded text-sm"
                        onClick={async () => {
                          if (!copySource) return;
                          try {
                            await copySessionExercises(selectedSession.id, copySource);
                            const data = await listSessionExercises(selectedSession.id);
                            setSessionExercises(data);
                            setMessage('Exercicios copiados.');
                          } catch {
                            setError('Nao foi possivel copiar.');
                          }
                        }}
                      >
                        Copiar
                      </button>
                      <button
                        className="text-sm underline text-blue-600"
                        onClick={async () => {
                          try {
                            const data = await getExercises();
                            setExerciseOptions(data);
                            setMessage('Exercicios recarregados.');
                          } catch {
                            setError('Erro ao recarregar exercicios.');
                          }
                        }}
                      >
                        Recarregar exercicios
                      </button>
                    </div>
                  }
                >
                <div className="mb-4 bg-slate-50 border rounded p-3 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Adicionar varios de uma vez (modo rapido{sessionIsEndurance ? ' - corrida' : ''})</p>
                      <p className="text-xs text-slate-600">
                        {sessionIsEndurance
                          ? 'Selecione na lista filtrada, defina duracao/pace basicos e clique em adicionar.'
                          : 'Selecione na lista filtrada, defina series/reps basicos e clique em adicionar.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-blue-600 underline"
                      onClick={() => setBulkSelection(filteredExerciseOptions.map((ex) => ex.id))}
                      disabled={filteredExerciseOptions.length === 0}
                    >
                      Selecionar exibidos
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                    {filteredExerciseOptions.slice(0, 12).map((ex) => (
                      <label key={ex.id} className="flex items-center gap-2 text-xs text-slate-700 bg-white border rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={bulkSelection.includes(ex.id)}
                          onChange={() => toggleBulkSelection(ex.id)}
                        />
                        <span className="truncate">{ex.name} ({ex.type})</span>
                      </label>
                    ))}
                    {filteredExerciseOptions.length === 0 && (
                      <p className="text-xs text-slate-500">Use a busca acima para achar exercicios.</p>
                    )}
                  </div>
                  {sessionIsEndurance ? (
                    <div className="grid md:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">Tipo de treino</label>
                        <select
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.workout_type}
                          onChange={(e) => setBulkParams({ ...bulkParams, workout_type: e.target.value })}
                        >
                          {ENDURANCE_WORKOUT_TYPES.map((option) => (
                            <option key={option.value || 'blank'} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Duracao (min)</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.duration_min}
                          onChange={(e) => setBulkParams({ ...bulkParams, duration_min: e.target.value })}
                          placeholder="ex: 40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Distancia (km)</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.distance_km}
                          onChange={(e) => setBulkParams({ ...bulkParams, distance_km: e.target.value })}
                          placeholder="ex: 8"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Pace alvo</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.pace_target}
                          onChange={(e) => setBulkParams({ ...bulkParams, pace_target: e.target.value })}
                          placeholder="ex: 5:20/km"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Zona</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.intensity_zone}
                          onChange={(e) => setBulkParams({ ...bulkParams, intensity_zone: e.target.value })}
                          placeholder="Z1, Z2..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Terreno</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.terrain}
                          onChange={(e) => setBulkParams({ ...bulkParams, terrain: e.target.value })}
                          placeholder="rua, pista, esteira"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium mb-1">Notas</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.notes}
                          onChange={(e) => setBulkParams({ ...bulkParams, notes: e.target.value })}
                          placeholder="intervalos, tiros, observacoes"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-5 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">Series</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.sets}
                          onChange={(e) => setBulkParams({ ...bulkParams, sets: e.target.value })}
                          placeholder="ex: 3"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Reps</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.reps}
                          onChange={(e) => setBulkParams({ ...bulkParams, reps: e.target.value })}
                          placeholder="ex: 10-12"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Carga</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.load}
                          onChange={(e) => setBulkParams({ ...bulkParams, load: e.target.value })}
                          placeholder="ex: 20kg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Descanso</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.rest}
                          onChange={(e) => setBulkParams({ ...bulkParams, rest: e.target.value })}
                          placeholder="ex: 60s"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Notas</label>
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={bulkParams.notes}
                          onChange={(e) => setBulkParams({ ...bulkParams, notes: e.target.value })}
                          placeholder="Opcional"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <p>Proxima ordem sugerida: {nextOrder}</p>
                    <button
                      type="button"
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-semibold"
                      onClick={handleBulkAdd}
                      disabled={bulkSelection.length === 0}
                    >
                      Adicionar selecionados
                    </button>
                  </div>
                </div>

                {editingExerciseId && (
                  <div className="mb-3 border border-amber-200 bg-amber-50 text-amber-800 rounded p-2 text-xs">
                    Modo edicao ativo. Ajuste series, reps, descanso ou notas e salve para atualizar.
                  </div>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError('');
                    setMessage('');
                    const isEditing = Boolean(editingExerciseId);
                    if (!sessionExerciseForm.exercise_id) {
                      setError('Selecione um exercicio.');
                      return;
                    }
                    const selectedEx = exerciseOptions.find((ex) => ex.id === Number(sessionExerciseForm.exercise_id));
                    const isEndurance = selectedEx
                      ? (selectedEx.type === 'CORRIDA' || selectedEx.type === 'PEDAL')
                      : sessionIsEndurance;
                    const filteredSetDetails = (sessionExerciseForm.params.set_details || []).filter(
                      (row) => (row.reps ?? '').toString().trim() !== '' || (row.load ?? '').toString().trim() !== ''
                    );
                    const payload = {
                      order: Number(sessionExerciseForm.order || 1),
                      params: isEndurance
                        ? {
                            workout_type: sessionExerciseForm.params.workout_type || null,
                            duration_min: sessionExerciseForm.params.duration_min || null,
                            distance_km: sessionExerciseForm.params.distance_km || null,
                            pace_target: sessionExerciseForm.params.pace_target || null,
                            intensity_zone: sessionExerciseForm.params.intensity_zone || null,
                            terrain: sessionExerciseForm.params.terrain || null,
                            notes: sessionExerciseForm.params.notes || null,
                          }
                        : {
                            sets: sessionExerciseForm.params.sets || null,
                            reps: sessionExerciseForm.params.reps || null,
                            load: sessionExerciseForm.params.load || null,
                            rest: sessionExerciseForm.params.rest || null,
                            biset_group: sessionExerciseForm.params.biset_group || null,
                            notes: sessionExerciseForm.params.notes || null,
                            tempo: sessionExerciseForm.params.tempo || null,
                            effort: sessionExerciseForm.params.effort || null,
                            block: sessionExerciseForm.params.block || null,
                            load_progression_type: sessionExerciseForm.params.load_progression_type || null,
                            load_progression_step: sessionExerciseForm.params.load_progression_step || null,
                            reps_progression_type: sessionExerciseForm.params.reps_progression_type || null,
                            reps_progression_step: sessionExerciseForm.params.reps_progression_step || null,
                            set_details: filteredSetDetails.length ? filteredSetDetails : null,
                           },
                      notes: sessionExerciseForm.notes || null,
                    };
                    try {
                      if (isEditing) {
                        await updateSessionExercise(editingExerciseId, payload);
                      } else {
                        await addSessionExercise(selectedSession.id, {
                          ...payload,
                          exercise_id: Number(sessionExerciseForm.exercise_id),
                        });
                      }
                      const data = await listSessionExercises(selectedSession.id);
                      setSessionExercises(data);
                      resetSessionExerciseForm(nextOrder || 1);
                      setMessage(isEditing ? 'Exercicio atualizado.' : 'Exercicio adicionado a sessao.');
                    } catch {
                      setError(isEditing ? 'Erro ao atualizar exercicio.' : 'Erro ao adicionar exercicio.');
                    }
                  }}
                  className="grid md:grid-cols-2 gap-3 mb-4"
                >
                  <div>
                    <label className="block text-sm font-medium mb-1">Exercicio</label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm mb-2"
                      placeholder="Digite para encontrar (ex: supino, agachamento, corrida...)"
                      value={exerciseQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setExerciseQuery(value);
                        const match = findBestExerciseMatch(value, visibleExerciseOptions);
                        setSessionExerciseForm((prev) => ({
                          ...prev,
                          exercise_id: match ? String(match.id) : '',
                        }));
                      }}
                      disabled={Boolean(editingExerciseId)}
                    />
                    {exerciseQuickSuggestions.length > 0 && !editingExerciseId && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {exerciseQuickSuggestions.map((ex) => (
                          <button
                            key={ex.id}
                            type="button"
                            className="text-xs px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100"
                            onClick={() => {
                              setExerciseQuery(ex.name);
                              setSessionExerciseForm((prev) => ({ ...prev, exercise_id: String(ex.id) }));
                            }}
                          >
                            {ex.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <select
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={sessionExerciseForm.exercise_id}
                      onChange={(e) => {
                        const value = e.target.value;
                        const picked = visibleExerciseOptions.find((ex) => String(ex.id) === value);
                        setSessionExerciseForm({ ...sessionExerciseForm, exercise_id: value });
                        if (picked) setExerciseQuery(picked.name);
                        if (!value) setExerciseQuery('');
                      }}
                      disabled={Boolean(editingExerciseId)}
                    >
                      <option value="">Selecione</option>
                      {visibleExerciseOptions.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name} ({ex.type})
                        </option>
                      ))}
                    </select>
                    {editingExerciseId && (
                      <p className="text-xs text-slate-500 mt-1">
                        Exercicio fixo durante a edicao. Para trocar, exclua e adicione outro.
                      </p>
                    )}
                    {exerciseOptions.length === 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Nenhum exercicio encontrado. Cadastre em "Exercicios" e clique em recarregar.
                      </p>
                    )}
                    {exerciseOptions.length > 0 && filteredExerciseOptions.length === 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Nenhum exercicio bate com a busca ou a modalidade da sessao. Ajuste o filtro ou o tipo do treino.
                      </p>
                    )}
                    {selectedExercise && (
                      <div className="mt-2 bg-slate-50 border rounded p-2 text-xs text-left space-y-1">
                        <p className="font-semibold text-slate-800">{selectedExercise.name} · {selectedExercise.group || 'Sem grupo'} · {selectedExercise.type}</p>
                        {selectedExercise.description && <p className="text-slate-600">Desc: {selectedExercise.description}</p>}
                        {selectedExercise.tips && <p className="text-slate-600">Dica: {selectedExercise.tips}</p>}
                        {selectedExercise.video_url && (
                          <a className="text-blue-600 underline" href={selectedExercise.video_url} target="_blank" rel="noreferrer">
                            Abrir video de referencia
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Ordem (sugerido {nextOrder})</label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={sessionExerciseForm.order}
                      onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, order: e.target.value })}
                    />
                  </div>

                  {(() => {
                    const selectedEx = exerciseOptions.find((ex) => ex.id === Number(sessionExerciseForm.exercise_id));
                    const isEndurance = selectedEx
                      ? (selectedEx.type === 'CORRIDA' || selectedEx.type === 'PEDAL')
                      : sessionIsEndurance;
                    if (isEndurance) {
                      return (
                        <div className="md:col-span-2 space-y-3">
                          <div className="bg-slate-50 border rounded p-3 space-y-3">
                            <div className="grid md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-sm font-medium mb-1">Tipo de treino</label>
                                <select
                                  className="w-full border rounded px-3 py-2 text-sm"
                                  value={sessionExerciseForm.params.workout_type}
                                  onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, workout_type: e.target.value } })}
                                >
                                  {ENDURANCE_WORKOUT_TYPES.map((option) => (
                                    <option key={option.value || 'blank'} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Duracao (min)</label>
                                <input
                                  className="w-full border rounded px-3 py-2 text-sm"
                                  value={sessionExerciseForm.params.duration_min}
                                  onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, duration_min: e.target.value } })}
                                  placeholder="ex: 40"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Distancia (km)</label>
                                <input
                                  className="w-full border rounded px-3 py-2 text-sm"
                                  value={sessionExerciseForm.params.distance_km}
                                  onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, distance_km: e.target.value } })}
                                  placeholder="ex: 8"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Pace alvo</label>
                                <input
                                  className="w-full border rounded px-3 py-2 text-sm"
                                  value={sessionExerciseForm.params.pace_target}
                                  onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, pace_target: e.target.value } })}
                                  placeholder="ex: 5:20/km"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Zona</label>
                                <input
                                  className="w-full border rounded px-3 py-2 text-sm"
                                  value={sessionExerciseForm.params.intensity_zone}
                                  onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, intensity_zone: e.target.value } })}
                                  placeholder="Z1, Z2..."
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Terreno</label>
                                <input
                                  className="w-full border rounded px-3 py-2 text-sm"
                                  value={sessionExerciseForm.params.terrain}
                                  onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, terrain: e.target.value } })}
                                  placeholder="rua, pista, esteira"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Notas (intervalos, tiros, etc.)</label>
                              <textarea
                                className="w-full border rounded px-3 py-2 text-sm"
                                rows={2}
                                value={sessionExerciseForm.params.notes}
                                onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, notes: e.target.value } })}
                                placeholder="Ex: 6x800m Z4, pausa 90s."
                              />
                            </div>
                          </div>

                          <div className="bg-white border rounded p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-800">Presets de corrida</p>
                              <p className="text-[11px] text-slate-500">Clique para preencher duracao, ritmo e zona.</p>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {ENDURANCE_PRESETS.map((preset) => (
                                <button
                                  key={preset.key}
                                  type="button"
                                  className="border rounded-lg p-3 text-left hover:border-blue-400 hover:shadow-sm transition"
                                  onClick={() => applyEndurancePreset(preset)}
                                >
                                  <p className="text-sm font-semibold text-slate-800">{preset.title}</p>
                                  <p className="text-xs text-slate-600">{preset.hint}</p>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="bg-slate-900 text-white rounded p-3 text-sm space-y-1">
                            <p className="font-semibold">Resumo do treino (visual do aluno)</p>
                            <p>{enduranceSummary() || 'Preencha as informacoes acima para gerar o resumo claro do treino.'}</p>
                            {sessionExerciseForm.params.notes && <p className="text-slate-200">Notas: {sessionExerciseForm.params.notes}</p>}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="md:col-span-2 space-y-3">
                        <div className="bg-slate-50 border rounded p-3 space-y-3">
                          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">Series</label>
                              <input
                                className="w-full border rounded px-3 py-2 text-sm"
                                value={sessionExerciseForm.params.sets}
                                onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, sets: e.target.value } })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Reps</label>
                              <input
                                className="w-full border rounded px-3 py-2 text-sm"
                                value={sessionExerciseForm.params.reps}
                                onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, reps: e.target.value } })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Carga</label>
                              <input
                                className="w-full border rounded px-3 py-2 text-sm"
                                value={sessionExerciseForm.params.load}
                                onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, load: e.target.value } })}
                                placeholder="kg ou %"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Descanso</label>
                              <input
                                className="w-full border rounded px-3 py-2 text-sm"
                                value={sessionExerciseForm.params.rest}
                                onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, rest: e.target.value } })}
                                placeholder="ex: 60s"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Tempo/cadencia</label>
                              <input
                                className="w-full border rounded px-3 py-2 text-sm"
                                value={sessionExerciseForm.params.tempo}
                                onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, tempo: e.target.value } })}
                                placeholder="ex: 3-1-1 ou 2-0-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Esforco alvo (RPE/RIR)</label>
                              <input
                                className="w-full border rounded px-3 py-2 text-sm"
                                value={sessionExerciseForm.params.effort}
                                onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, effort: e.target.value } })}
                                placeholder="ex: RPE 8 ou RIR 2"
                              />
                            </div>
                          </div>
                          <div className="grid md:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">Bloco do treino</label>
                              <select
                                className="w-full border rounded px-3 py-2 text-sm"
                                value={sessionExerciseForm.params.block}
                                onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, block: e.target.value } })}
                              >
                                {TRAINING_BLOCKS.map((block) => (
                                  <option key={block.value || 'blank'} value={block.value}>{block.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Grupo biset</label>
                              <input
                                className="w-full border rounded px-3 py-2 text-sm"
                                value={sessionExerciseForm.params.biset_group}
                                onChange={(e) => applyFormBisetGroup(e.target.value)}
                                placeholder="Ex: A"
                              />
                              <p className="text-[11px] text-slate-500 mt-1">Use o mesmo grupo para combinar exercicios e descansar no ultimo.</p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className={`text-[11px] border rounded px-2 py-1 ${!normalizedFormBisetGroup ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white hover:border-blue-300'}`}
                                  onClick={() => applyFormBisetGroup('')}
                                >
                                  Sem biset
                                </button>
                                <button
                                  type="button"
                                  className="text-[11px] border rounded px-2 py-1 bg-white hover:border-blue-300"
                                  onClick={() => applyFormBisetGroup(suggestedBisetGroup)}
                                >
                                  Novo grupo {suggestedBisetGroup}
                                </button>
                                {bisetGroups.map((group) => (
                                  <button
                                    key={group}
                                    type="button"
                                    className={`text-[11px] border rounded px-2 py-1 ${normalizedFormBisetGroup === group ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white hover:border-blue-300'}`}
                                    onClick={() => applyFormBisetGroup(group)}
                                  >
                                    Grupo {group}
                                  </button>
                                ))}
                              </div>
                              {normalizedFormBisetGroup && (
                                <div className={`mt-2 rounded border px-2 py-1 text-[11px] ${formLikelyLastInGroup ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                                  {formLikelyLastInGroup
                                    ? `Este item sera o ultimo do biset ${normalizedFormBisetGroup}. Defina o descanso aqui.`
                                    : `Este item nao e o ultimo do biset ${normalizedFormBisetGroup}; o descanso sera aplicado apenas no ultimo exercicio do grupo.`}
                                  {formLikelyLastInGroup && !normalizedFormRest ? ' Falta informar o descanso.' : ''}
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:col-span-2">
                              <div>
                                <label className="block text-sm font-medium mb-1">Carga - tendencia</label>
                                <select
                                  className="w-full border rounded px-3 py-2 text-sm"
                                  value={sessionExerciseForm.params.load_progression_type}
                                  onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, load_progression_type: e.target.value } })}
                                >
                                  <option value="">Sem ajuste</option>
                                  <option value="progressao">Progressao</option>
                                  <option value="regressao">Regressao</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Carga - passo</label>
                                <input
                                  className="w-full border rounded px-3 py-2 text-sm"
                                  placeholder="+2kg, -5%, manter"
                                  value={sessionExerciseForm.params.load_progression_step}
                                  onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, load_progression_step: e.target.value } })}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Reps - tendencia</label>
                                <select
                                  className="w-full border rounded px-3 py-2 text-sm"
                                  value={sessionExerciseForm.params.reps_progression_type}
                                  onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, reps_progression_type: e.target.value } })}
                                >
                                  <option value="">Sem ajuste</option>
                                  <option value="progressao">Progressao</option>
                                  <option value="regressao">Regressao</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Reps - passo</label>
                                <input
                                  className="w-full border rounded px-3 py-2 text-sm"
                                  placeholder="+1 rep, -2 reps, piramide"
                                  value={sessionExerciseForm.params.reps_progression_step}
                                  onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, reps_progression_step: e.target.value } })}
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Notas para execucao</label>
                            <textarea
                              className="w-full border rounded px-3 py-2 text-sm"
                              rows={2}
                              value={sessionExerciseForm.params.notes}
                              onChange={(e) => setSessionExerciseForm({ ...sessionExerciseForm, params: { ...sessionExerciseForm.params, notes: e.target.value } })}
                              placeholder="Cadencia, pausa isometrica, amplitude, respiracao..."
                            />
                          </div>
                        </div>

                        <div className="bg-white border rounded p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-800">Presets rapidos (estilo personal/tecnofit)</p>
                            <p className="text-[11px] text-slate-500">Clique para preencher series, reps e descanso.</p>
                          </div>
                          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2">
                            {MUSCLE_PRESETS.map((preset) => (
                              <button
                                key={preset.key}
                                type="button"
                                className="border rounded-lg p-3 text-left hover:border-blue-400 hover:shadow-sm transition"
                                onClick={() => applyMusclePreset(preset)}
                              >
                                <p className="text-sm font-semibold text-slate-800">{preset.title}</p>
                                <p className="text-xs text-slate-600">{preset.hint}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="bg-slate-50 border rounded p-3 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">Linhas de series (piramide/drop)</p>
                              <p className="text-xs text-slate-500">Deixe claro como subir ou baixar carga para o aluno.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {SET_DETAIL_PRESETS.map((preset) => (
                                <button
                                  key={preset.key}
                                  type="button"
                                  className="text-xs bg-white border px-2 py-1 rounded hover:border-blue-400"
                                  onClick={() => applySetDetailPreset(preset)}
                                >
                                  {preset.title}
                                </button>
                              ))}
                              <button
                                type="button"
                                className="text-xs text-blue-600 underline"
                                onClick={addSetDetail}
                              >
                                Adicionar linha
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {(sessionExerciseForm.params.set_details || []).map((row, idx) => (
                              <div key={idx} className="grid grid-cols-5 gap-2 items-end">
                                <div className="col-span-2">
                                  <label className="block text-xs font-medium mb-1">Reps (linha {idx + 1})</label>
                                  <input
                                    className="w-full border rounded px-2 py-1 text-sm"
                                    value={row.reps}
                                    onChange={(e) => updateSetDetail(idx, 'reps', e.target.value)}
                                    placeholder="ex: 12"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-xs font-medium mb-1">Carga</label>
                                  <input
                                    className="w-full border rounded px-2 py-1 text-sm"
                                    value={row.load}
                                    onChange={(e) => updateSetDetail(idx, 'load', e.target.value)}
                                    placeholder="ex: 20kg ou 70%"
                                  />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                  {(sessionExerciseForm.params.set_details?.length || 0) > 1 && (
                                    <button
                                      type="button"
                                      className="text-xs text-red-600 underline"
                                      onClick={() => removeSetDetail(idx)}
                                    >
                                      Remover
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-slate-900 text-white rounded p-3 text-sm space-y-1">
                          <p className="font-semibold">Resumo do bloco (visual do aluno)</p>
                          <p>{muscleSummary() || 'Preencha as informacoes acima para gerar o resumo claro do exercicio.'}</p>
                          {sessionExerciseForm.params.notes && <p className="text-slate-200">Notas: {sessionExerciseForm.params.notes}</p>}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="md:col-span-2 flex justify-end gap-2">
                    {editingExerciseId && (
                      <button
                        type="button"
                        className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold"
                        onClick={() => resetSessionExerciseForm(nextOrder || 1)}
                      >
                        Cancelar edicao
                      </button>
                    )}
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">
                      {editingExerciseId ? 'Atualizar exercicio' : 'Adicionar exercicio'}
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  {sessionExercises.map((item) => {
                    const ex = exerciseOptions.find((e) => e.id === item.exercise_id);
                    const isEndurance = ex && (ex.type === 'CORRIDA' || ex.type === 'PEDAL');
                    const setDetails = Array.isArray(item.params?.set_details) ? item.params.set_details : [];
                    const bisetMeta = bisetMetaByItemId[item.id];
                    const isEditingItem = editingExerciseId === item.id;
                    return (
                      <div key={item.id} className={`border rounded-lg p-3 ${isEditingItem ? 'border-amber-400 bg-amber-50' : 'bg-white'}`}>
                        <div className="flex justify-between">
                          <div>
                            <p className="font-semibold text-slate-800">
                              {item.order}. {ex ? ex.name : 'Exercicio'} ({ex?.type || '-'})
                              {bisetMeta && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                  {bisetMeta.group}{bisetMeta.position}/{bisetMeta.total}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">{ex?.group || 'Sem grupo'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="text-xs text-blue-600 underline disabled:text-slate-400"
                              onClick={() => startEditExercise(item)}
                              disabled={isEditingItem}
                            >
                              {isEditingItem ? 'Editando' : 'Editar'}
                            </button>
                            <button
                              className="text-xs text-red-600 underline"
                              onClick={() => handleDeleteExercise(item.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                        {isEndurance ? (
                          <div className="text-xs text-slate-600 mt-2 space-y-1">
                            {item.params?.workout_type && <div>Tipo: {workoutTypeLabel(item.params.workout_type)}</div>}
                            {item.params?.duration_min && <div>Duracao: {item.params.duration_min} min</div>}
                            {item.params?.distance_km && <div>Distancia: {item.params.distance_km} km</div>}
                            {item.params?.pace_target && <div>Pace: {item.params.pace_target}</div>}
                            {item.params?.intensity_zone && <div>Zona: {item.params.intensity_zone}</div>}
                            {item.params?.terrain && <div>Terreno: {item.params.terrain}</div>}
                            {item.params?.notes && <div>Notas: {item.params.notes}</div>}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-600 mt-2 space-y-1">
                            {item.params?.sets && <div>Series: {item.params.sets}</div>}
                            {item.params?.reps && <div>Reps: {item.params.reps}</div>}
                            {item.params?.load && <div>Carga: {item.params.load}</div>}
                            {item.params?.tempo && <div>Tempo/cadencia: {item.params.tempo}</div>}
                            {item.params?.effort && <div>Esforco alvo: {item.params.effort}</div>}
                            {item.params?.block && <div>Bloco: {item.params.block}</div>}
                            {item.params?.biset_group && (
                              <div>
                                Biset: Grupo {item.params.biset_group}
                                {bisetMeta ? ` (${bisetMeta.position}/${bisetMeta.total})` : ''}
                              </div>
                            )}
                            {setDetails.length > 0 && (
                              <div className="space-y-1">
                                <div className="font-semibold">Linhas de series:</div>
                                {setDetails.map((row, idx) => (
                                  <div key={idx}>#{idx + 1}: {row.reps || '-'} reps  -  {row.load || '-'} carga</div>
                                ))}
                              </div>
                            )}
                            {(item.params?.load_progression_type || item.params?.load_progression_step) && (
                              <div>
                                Ajuste de carga: {item.params?.load_progression_type || 'sem tendencia'} {item.params?.load_progression_step || ''}
                              </div>
                            )}
                            {(item.params?.reps_progression_type || item.params?.reps_progression_step) && (
                              <div>
                                Ajuste de reps: {item.params?.reps_progression_type || 'sem tendencia'} {item.params?.reps_progression_step || ''}
                              </div>
                            )}
                            {item.params?.rest && <div>Descanso: {item.params.rest}</div>}
                            {item.params?.rest && bisetMeta && !bisetMeta.isLast && (
                              <div className="text-amber-700">Descanso neste item e ignorado no app do aluno (descanso fica no ultimo do grupo).</div>
                            )}
                            {item.params?.notes && <div>Notas: {item.params.notes}</div>}
                          </div>
                        )}
                        {item.notes && <p className="text-xs text-slate-500 mt-1">Obs: {item.notes}</p>}
                      </div>
                    );
                  })}
                  {sessionExercises.length === 0 && <p className="text-sm text-slate-500">Nenhum exercicio nesta sessao.</p>}
                </div>
              </SectionCard>
              )}
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
