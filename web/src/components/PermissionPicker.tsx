import clsx from 'clsx';
import { MODULES, modulePages, type ModuleId } from '../lib/pages';
import { Checkbox } from './ui';

/** Seleção dos módulos liberados para um usuário. Cada módulo libera todas as telas dele. */
export function PermissionPicker({ value, onChange }: { value: ModuleId[]; onChange(v: ModuleId[]): void }) {
  const toggle = (id: ModuleId, on: boolean) => onChange(on ? [...new Set([...value, id])] : value.filter((x) => x !== id));
  const all = value.length === MODULES.length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {value.length} de {MODULES.length} módulos liberados
        </span>
        <button
          type="button"
          onClick={() => onChange(all ? [] : MODULES.map((m) => m.id))}
          className="text-xs font-medium text-accent hover:underline"
        >
          {all ? 'Desmarcar todos' : 'Marcar todos'}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODULES.map((m) => {
          const on = value.includes(m.id);
          return (
            <div key={m.id} className={clsx('rounded-lg border p-3 transition-colors', on ? 'border-accent/50 bg-accent/5' : 'border-line')}>
              <Checkbox checked={on} onChange={(v) => toggle(m.id, v)} label={<span className="font-medium">{m.label}</span>} />
              <p className="mt-1 pl-6 text-xs text-muted">{m.description}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 pl-6">
                {modulePages(m.id).map((p) => (
                  <span key={p.id} className="flex items-center gap-1 text-[11px] text-muted">
                    <p.icon size={11} />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
