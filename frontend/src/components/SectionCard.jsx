export default function SectionCard({ title, description, children, actions }) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-slate-100 p-3 sm:p-4 mb-4 sm:mb-5">
      <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-800">{title}</h2>
          {description && <p className="text-xs sm:text-sm text-slate-600 mt-1">{description}</p>}
        </div>
        {actions && (
          <div className="sm:flex-shrink-0 w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
            {actions}
          </div>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
