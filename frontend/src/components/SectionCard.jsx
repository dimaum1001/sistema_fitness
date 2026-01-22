export default function SectionCard({ title, description, children, actions }) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-slate-100 p-4 mb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
        </div>
        {actions && <div className="sm:flex-shrink-0">{actions}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}
