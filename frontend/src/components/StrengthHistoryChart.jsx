import { useEffect, useMemo, useState } from 'react';
import SectionCard from './SectionCard.jsx';

const CHART_WIDTH = 640;
const CHART_HEIGHT = 180;
const CHART_PADDING = 24;

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  const fixed = Math.round(value * 10) / 10;
  return Number.isInteger(fixed) ? String(fixed) : fixed.toFixed(1);
};

const parseNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const match = String(value).replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
};

const getExerciseKey = (ex) => (ex.exercise_id ? String(ex.exercise_id) : String(ex.name || ''));

const buildChart = (values, width, height, padding) => {
  const filtered = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (!filtered.length) {
    return { path: '', points: [], min: null, max: null };
  }
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const range = max - min || 1;
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const points = values.map((v, idx) => {
    if (v === null || v === undefined || Number.isNaN(v)) return null;
    const x = padding + idx * step;
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return { x, y, value: v };
  });
  let path = '';
  let started = false;
  points.forEach((p) => {
    if (!p) {
      started = false;
      return;
    }
    path += `${started ? 'L' : 'M'} ${p.x} ${p.y} `;
    started = true;
  });
  return { path: path.trim(), points: points.filter(Boolean), min, max };
};

export default function StrengthHistoryChart({ executions, title, description }) {
  const exerciseOptions = useMemo(() => {
    const map = new Map();
    (executions || []).forEach((exec) => {
      (exec.exercises || []).forEach((ex) => {
        if (String(ex.type || '').toUpperCase() !== 'MUSCULACAO') return;
        const key = getExerciseKey(ex);
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            name: ex.name || 'Exercicio',
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [executions]);

  const [selectedExercise, setSelectedExercise] = useState('');

  useEffect(() => {
    if (!exerciseOptions.length) {
      setSelectedExercise('');
      return;
    }
    if (selectedExercise && exerciseOptions.some((opt) => opt.id === selectedExercise)) return;
    setSelectedExercise(exerciseOptions[0].id);
  }, [exerciseOptions, selectedExercise]);

  const series = useMemo(() => {
    if (!selectedExercise) return [];
    const rows = [];
    (executions || []).forEach((exec) => {
      if (!exec.executed_at) return;
      const match = (exec.exercises || []).find((ex) => getExerciseKey(ex) === selectedExercise);
      if (!match) return;
      const performed = match.performed || {};
      const setDetails = Array.isArray(performed.set_details) ? performed.set_details : [];
      const fallbackLoad = parseNumber(performed.load);
      const fallbackReps = parseNumber(performed.reps);
      let maxLoad = null;
      let maxReps = null;
      if (setDetails.length) {
        setDetails.forEach((row) => {
          const load = parseNumber(row.load);
          const reps = parseNumber(row.reps);
          if (load !== null && (maxLoad === null || load > maxLoad)) maxLoad = load;
          if (reps !== null && (maxReps === null || reps > maxReps)) maxReps = reps;
        });
      } else {
        maxLoad = fallbackLoad;
        maxReps = fallbackReps;
      }
      if (maxLoad === null && maxReps === null) return;
      rows.push({
        date: exec.executed_at ? String(exec.executed_at).slice(0, 10) : '',
        timestamp: Date.parse(exec.executed_at),
        load: maxLoad,
        reps: maxReps,
      });
    });
    return rows
      .filter((row) => !Number.isNaN(row.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [executions, selectedExercise]);

  const loadChart = useMemo(
    () => buildChart(series.map((row) => row.load), CHART_WIDTH, CHART_HEIGHT, CHART_PADDING),
    [series],
  );
  const repsChart = useMemo(
    () => buildChart(series.map((row) => row.reps), CHART_WIDTH, CHART_HEIGHT, CHART_PADDING),
    [series],
  );

  const firstDate = series[0]?.date || '-';
  const lastDate = series[series.length - 1]?.date || '-';
  const lastLoad = [...series].reverse().find((row) => row.load !== null)?.load ?? null;
  const lastReps = [...series].reverse().find((row) => row.reps !== null)?.reps ?? null;

  return (
    <SectionCard
      title={title}
      description={description}
      actions={(
        <select
          className="border rounded px-3 py-2 text-sm"
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          disabled={exerciseOptions.length === 0}
        >
          {exerciseOptions.length === 0 && <option value="">Sem exercicios</option>}
          {exerciseOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      )}
    >
      {exerciseOptions.length === 0 ? (
        <p className="text-sm text-slate-500">Sem registros de musculacao no historico.</p>
      ) : series.length === 0 ? (
        <p className="text-sm text-slate-500">Sem dados para o exercicio selecionado.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>Periodo: {firstDate} a {lastDate}</span>
            <span>Pontos: {series.length}</span>
            <span>Ultima carga: {formatNumber(lastLoad)}</span>
            <span>Ultimas reps: {formatNumber(lastReps)}</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold text-slate-700">Carga</span>
                <span>min {formatNumber(loadChart.min)} / max {formatNumber(loadChart.max)}</span>
              </div>
              <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-40">
                {loadChart.path && (
                  <path d={loadChart.path} fill="none" stroke="#2563eb" strokeWidth="2" />
                )}
                {loadChart.points.map((p, idx) => (
                  <circle key={idx} cx={p.x} cy={p.y} r="3" fill="#2563eb" />
                ))}
              </svg>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold text-slate-700">Reps</span>
                <span>min {formatNumber(repsChart.min)} / max {formatNumber(repsChart.max)}</span>
              </div>
              <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-40">
                {repsChart.path && (
                  <path d={repsChart.path} fill="none" stroke="#16a34a" strokeWidth="2" />
                )}
                {repsChart.points.map((p, idx) => (
                  <circle key={idx} cx={p.x} cy={p.y} r="3" fill="#16a34a" />
                ))}
              </svg>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
