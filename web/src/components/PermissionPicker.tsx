import { PAGES, PAGE_GROUPS, type PageId } from '../lib/pages';
import { Checkbox } from './ui';

export function PermissionPicker({ value, onChange }: { value: PageId[]; onChange(v: PageId[]): void }) {
  const toggle = (id: PageId, on: boolean) => onChange(on ? [...new Set([...value, id])] : value.filter((x) => x !== id));
  const all = value.length === PAGES.length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {value.length} de {PAGES.length} telas liberadas
        </span>
        <button
          type="button"
          onClick={() => onChange(all ? [] : PAGES.map((p) => p.id))}
          className="text-xs font-medium text-accent hover:underline"
        >
          {all ? 'Desmarcar todas' : 'Marcar todas'}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PAGE_GROUPS.map((g) => {
          const items = PAGES.filter((p) => p.group === g);
          const groupOn = items.every((p) => value.includes(p.id));
          return (
            <div key={g} className="rounded-lg border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="label-xs">{g}</span>
                <button
                  type="button"
                  className="text-[11px] text-muted hover:text-fg"
                  onClick={() =>
                    onChange(
                      groupOn
                        ? value.filter((v) => !items.some((i) => i.id === v))
                        : [...new Set([...value, ...items.map((i) => i.id)])],
                    )
                  }
                >
                  {groupOn ? 'Nenhuma' : 'Todas'}
                </button>
              </div>
              <div className="space-y-2">
                {items.map((p) => (
                  <Checkbox
                    key={p.id}
                    checked={value.includes(p.id)}
                    onChange={(on) => toggle(p.id, on)}
                    label={
                      <span className="flex items-center gap-2">
                        <p.icon size={13} className="text-muted" />
                        {p.label}
                      </span>
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
