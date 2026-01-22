export default function StatBadge({ label, value, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-800 border-blue-100',
    green: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    orange: 'bg-amber-50 text-amber-800 border-amber-100',
    purple: 'bg-violet-50 text-violet-800 border-violet-100',
    gray: 'bg-slate-50 text-slate-800 border-slate-100',
  };
  const toneClass = tones[tone] || tones.blue;
  return (
    <div className={`border rounded-lg px-3 py-2 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide font-semibold">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
