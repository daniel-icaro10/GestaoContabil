import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import clsx from 'clsx';
import { AlertTriangle, Check, CheckCircle2, Copy, Info, Loader2, X, XCircle } from 'lucide-react';

export { clsx };

// ---------------- Layout ----------------

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={clsx('rounded-xl border border-line bg-surface', padded && 'p-5', className)}>{children}</div>
  );
}

export function CardTitle({ children, icon, right }: { children: ReactNode; icon?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {icon && <span className="text-muted">{icon}</span>}
      <h3 className="text-sm font-semibold tracking-tight">{children}</h3>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="label-xs mb-1.5">{eyebrow}</p>}
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------- Controles ----------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: 'sm' | 'md';
    icon?: ReactNode;
    loading?: boolean;
  }
>(function Button({ variant = 'primary', size = 'md', icon, loading, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
        variant === 'primary' && 'bg-fg text-bg hover:bg-fg/90',
        variant === 'secondary' && 'bg-subtle text-fg hover:bg-line/70',
        variant === 'outline' && 'border border-line bg-surface text-fg hover:bg-subtle',
        variant === 'ghost' && 'text-muted hover:bg-subtle hover:text-fg',
        variant === 'danger' && 'bg-danger/10 text-danger hover:bg-danger/15',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function Field({
  label,
  tip,
  children,
  className,
}: {
  label?: ReactNode;
  tip?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="mb-1.5 block text-xs font-medium text-fg/80">{label}</span>}
      {children}
      {tip && <span className="mt-1 block text-xs text-muted">{tip}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={clsx('input', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx('input appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-8', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('input min-h-[96px] font-mono text-xs', className)} {...rest} />;
}

const fmtMoneyInput = (v: number) => (v ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

/** Campo monetário com máscara (digitação em centavos). */
export function MoneyInput({
  value,
  onChange,
  label,
  tip,
  className,
}: {
  value: number;
  onChange(v: number): void;
  label?: ReactNode;
  tip?: ReactNode;
  className?: string;
}) {
  return (
    <Field label={label} tip={tip} className={className}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">R$</span>
        <input
          inputMode="numeric"
          className="input num pl-9 text-right"
          value={fmtMoneyInput(value)}
          placeholder="0,00"
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            onChange(digits ? parseInt(digits, 10) / 100 : 0);
          }}
        />
      </div>
    </Field>
  );
}

/** Campo percentual (valor interno como fração: 0.15 = 15%). */
export function PercentInput({
  value,
  onChange,
  label,
  tip,
  decimals = 2,
}: {
  value: number;
  onChange(v: number): void;
  label?: ReactNode;
  tip?: ReactNode;
  decimals?: number;
}) {
  const [text, setText] = useState(() => (value * 100).toFixed(decimals).replace('.', ','));
  useEffect(() => {
    setText((t) => {
      const parsed = parseFloat(t.replace(',', '.'));
      return Math.abs(parsed / 100 - value) > 1e-9 ? (value * 100).toFixed(decimals).replace('.', ',') : t;
    });
  }, [value, decimals]);
  return (
    <Field label={label} tip={tip}>
      <div className="relative">
        <input
          inputMode="decimal"
          className="input num pr-8 text-right"
          value={text}
          onChange={(e) => {
            const t = e.target.value.replace(/[^\d,.]/g, '');
            setText(t);
            const n = parseFloat(t.replace(',', '.'));
            onChange(Number.isFinite(n) ? n / 100 : 0);
          }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">%</span>
      </div>
    </Field>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-line',
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm">
      <span
        className={clsx(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
          checked ? 'border-accent bg-accent text-white' : 'border-line bg-surface',
        )}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// ---------------- Exibição ----------------

export function Stat({
  label,
  value,
  sub,
  icon,
  color,
  trend,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  color?: string;
  trend?: number;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <span className="label-xs">{label}</span>
        {icon ? (
          <span style={{ color: color ?? 'rgb(var(--muted))' }}>{icon}</span>
        ) : (
          color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        )}
      </div>
      <p className="num text-2xl font-semibold leading-none">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {trend !== undefined && Number.isFinite(trend) && (
          <span
            className={clsx(
              'num rounded px-1.5 py-0.5 text-[11px] font-medium',
              trend >= 0 ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger',
            )}
          >
            {trend >= 0 ? '+' : ''}
            {trend.toFixed(1)}%
          </span>
        )}
        {sub && <p className="truncate text-xs text-muted">{sub}</p>}
      </div>
    </Card>
  );
}

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-subtle text-muted',
  accent: 'bg-accent/10 text-accent',
  ok: 'bg-ok/10 text-ok',
  warn: 'bg-warn/10 text-warn',
  danger: 'bg-danger/10 text-danger',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium', toneClass[tone], className)}>
      {children}
    </span>
  );
}

export function Alert({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: ReactNode }) {
  const Icon = tone === 'danger' ? XCircle : tone === 'warn' ? AlertTriangle : tone === 'ok' ? CheckCircle2 : Info;
  return (
    <div
      className={clsx(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        tone === 'neutral' && 'border-line bg-subtle/60 text-muted',
        tone === 'accent' && 'border-accent/20 bg-accent/5 text-fg',
        tone === 'ok' && 'border-ok/20 bg-ok/5 text-fg',
        tone === 'warn' && 'border-warn/25 bg-warn/5 text-fg',
        tone === 'danger' && 'border-danger/25 bg-danger/5 text-fg',
      )}
    >
      <Icon
        size={16}
        className={clsx(
          'mt-0.5 shrink-0',
          tone === 'ok' && 'text-ok',
          tone === 'warn' && 'text-warn',
          tone === 'danger' && 'text-danger',
          tone === 'accent' && 'text-accent',
        )}
      />
      <div className="min-w-0 leading-relaxed">
        {title && <p className="mb-0.5 font-medium text-fg">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function KV({ label, value, tone, strong }: { label: ReactNode; value: ReactNode; tone?: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/70 py-2 last:border-0">
      <span className={clsx('text-sm', strong ? 'font-medium text-fg' : 'text-muted')}>{label}</span>
      <span className={clsx('num text-sm', strong && 'font-semibold')} style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </div>
  );
}

export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color ?? 'rgb(var(--accent))' }}
      />
    </div>
  );
}

export function Disclaimer({ short }: { short?: boolean }) {
  return (
    <p className="rounded-lg border border-dashed border-line px-4 py-3 text-xs leading-relaxed text-muted">
      <span className="font-medium text-fg">Aviso profissional.</span>{' '}
      {short
        ? 'Os resultados apresentados possuem caráter estimativo e gerencial. A escolha ou alteração do regime tributário deve considerar a legislação vigente, particularidades da atividade, benefícios fiscais e demais regras aplicáveis. Recomenda-se validação por profissional contábil responsável.'
        : 'Os resultados apresentados possuem caráter estimativo e gerencial e são baseados nas informações fornecidas pelo usuário. A escolha ou alteração do regime tributário deve considerar a legislação vigente, particularidades da atividade, benefícios fiscais, obrigações acessórias e demais regras aplicáveis. Recomenda-se validação por profissional contábil responsável.'}
    </p>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 size={16} className="animate-spin" />
      {label ?? 'Carregando...'}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      icon={done ? <Check size={13} /> : <Copy size={13} />}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        });
      }}
    >
      {done ? 'Copiado' : label}
    </Button>
  );
}

// ---------------- Modal ----------------

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={clsx(
          'relative w-full animate-enter rounded-xl border border-line bg-surface shadow-2xl',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-subtle hover:text-fg" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------- Toasts ----------------

interface Toast {
  id: number;
  tone: 'ok' | 'danger' | 'neutral';
  text: string;
}
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-sm animate-enter items-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 text-sm shadow-lg"
          >
            {t.tone === 'ok' ? (
              <CheckCircle2 size={16} className="text-ok" />
            ) : t.tone === 'danger' ? (
              <XCircle size={16} className="text-danger" />
            ) : (
              <Info size={16} className="text-accent" />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ---------------- Gráficos ----------------

export const axisTick = { fontSize: 11, fill: 'rgb(var(--muted))', fontFamily: 'JetBrains Mono, monospace' };
export const gridStroke = 'rgb(var(--line))';

export function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  format(v: number, name: string): string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.payload?.fill ?? p.color ?? p.fill }} />
          <span className="text-muted">{p.name === 'value' || p.name === 'valor' ? p.payload?.name ?? '' : p.name}</span>
          <span className="num ml-auto pl-3 font-medium">{format(p.value, p.name)}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string; value?: ReactNode }[] }) {
  return (
    <div className="mt-3 space-y-1.5">
      {items.map((i) => (
        <div key={i.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: i.color }} />
          <span className="text-muted">{i.name}</span>
          {i.value !== undefined && <span className="num ml-auto">{i.value}</span>}
        </div>
      ))}
    </div>
  );
}
