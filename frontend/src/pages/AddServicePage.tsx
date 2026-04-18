import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Scissors, Clock, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useServices, type CreateServicePayload } from '../hooks/useServices';

// ─── field components ────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

const Field = ({ label, required, error, hint, children }: FieldProps) => (
  <div className="flex flex-col gap-2">
    <label className="text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider ml-1">
      {label}
      {required && <span className="ml-1 text-[var(--color-accent)]">*</span>}
    </label>
    {children}
    {error && (
      <p className="flex items-center gap-1.5 text-xs text-rose-400 font-medium ml-1">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        {error}
      </p>
    )}
    {hint && !error && (
      <p className="text-xs text-[var(--color-neutral-500)] font-medium ml-1">{hint}</p>
    )}
  </div>
);

// ─── main component ──────────────────────────────────────────────────────────

interface FormState {
  name: string;
  code: string;
  description: string;
  duration_minutes: string;
  price: string;
  is_active: boolean;
}

interface FormErrors {
  name?: string;
  code?: string;
  duration_minutes?: string;
  price?: string;
}

export default function AddServicePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const salonId = localStorage.getItem('selectedSalonId') || user?.salon_id || '';
  const { createService } = useServices(salonId);

  const [form, setForm] = useState<FormState>({
    name: '',
    code: '',
    description: '',
    duration_minutes: '',
    price: '',
    is_active: true,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // ── auto-generate code from name ──────────────────────────────────────────
  const handleNameChange = (value: string) => {
    const autoCode = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.slice(0, 3))
      .join('-')
      .slice(0, 20);

    setForm(prev => ({
      ...prev,
      name: value,
      // Only auto-fill code if user hasn't manually edited it
      code: prev.code === '' || prev.code === autoCode.slice(0, -1) ? autoCode : prev.code,
    }));
    if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
  };

  const set = (field: keyof FormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field in errors) setErrors(prev => ({ ...prev, [field]: undefined }));
    setApiError(null);
  };

  // ── validation ────────────────────────────────────────────────────────────
  const validate = (): FormErrors => {
    const e: FormErrors = {};

    if (!form.name.trim()) {
      e.name = 'Service name is required.';
    }

    if (!form.code.trim()) {
      e.code = 'Service code is required.';
    }

    const dur = Number(form.duration_minutes);
    if (!form.duration_minutes || isNaN(dur)) {
      e.duration_minutes = 'Duration is required — enter how long this service takes.';
    } else if (dur < 5) {
      e.duration_minutes = 'Duration must be at least 5 minutes.';
    } else if (dur > 480) {
      e.duration_minutes = 'Duration cannot exceed 480 minutes (8 hours).';
    }

    const cost = Number(form.price);
    if (form.price === '' || isNaN(cost)) {
      e.price = 'Cost is required — enter the price for this service.';
    } else if (cost < 0) {
      e.price = 'Cost cannot be negative.';
    }

    return e;
  };

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateServicePayload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        duration_minutes: Number(form.duration_minutes),
        price: Number(form.price),
        is_active: form.is_active,
      };

      await createService(payload);
      setSuccess(true);

      // Reset after brief success flash
      setTimeout(() => {
        navigate('/owner/services');
      }, 1200);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to create service. Please try again.';
      setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAnother = async (e: React.MouseEvent) => {
    e.preventDefault();
    setApiError(null);

    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateServicePayload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        duration_minutes: Number(form.duration_minutes),
        price: Number(form.price),
        is_active: form.is_active,
      };

      await createService(payload);
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        setForm({
          name: '',
          code: '',
          description: '',
          duration_minutes: '',
          price: '',
          is_active: true,
        });
        setErrors({});
      }, 800);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to create service. Please try again.';
      setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────
  const durationNum = Number(form.duration_minutes);
  const durationLabel =
    form.duration_minutes && !isNaN(durationNum)
      ? durationNum >= 60
        ? `${Math.floor(durationNum / 60)}h ${durationNum % 60 > 0 ? `${durationNum % 60}m` : ''}`.trim()
        : `${durationNum}m`
      : null;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-surface-base)]">
      {/* Sub-header - Standardized breadcrumb style */}
      <div className="bg-[var(--color-surface-raised)] border-b border-[var(--color-neutral-800)] sticky top-16 z-30">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate('/owner/services')}
            className="flex items-center gap-2 text-sm font-bold text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-100)] transition-all group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Services
          </button>
          <h1 className="text-sm font-bold text-[var(--color-neutral-100)] uppercase tracking-widest hidden sm:block">
            Create Service
          </h1>
          <div className="w-28 hidden sm:block" />
        </div>
      </div>

      {/* Page body */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Page Hero Transformation */}
        <div className="flex items-center gap-5 mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/80 to-amber-600 flex items-center justify-center shrink-0 shadow-lg shadow-[var(--color-accent)]/20">
            <Scissors className="w-8 h-8 text-[var(--color-surface-base)]" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-neutral-100)] tracking-tight">Service Configuration</h2>
            <p className="text-sm text-[var(--color-neutral-400)] mt-1 font-medium">
              Define the identity, cost, and duration for your new salon offering.
            </p>
          </div>
        </div>

        {/* Success flash */}
        <AnimatePresence>
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-3 p-5 mb-8 bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 rounded-2xl text-[var(--color-success)]"
            >
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-bold">Service created and synced successfully!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* API error */}
        <AnimatePresence>
          {apiError && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-5 mb-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-bold">{apiError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-[var(--color-surface-raised)] rounded-3xl border border-[var(--color-neutral-800)] shadow-2xl overflow-hidden divide-y divide-[var(--color-neutral-800)]">

            {/* ── Section: Identity (Dark Craft Glassmorphism) ────────────────── */}
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                <h3 className="text-xs font-black text-[var(--color-neutral-500)] uppercase tracking-[0.2em]">
                  Service Identity
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Service Name" required error={errors.name}>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="e.g., Bridal Hair & Makeup"
                    className={`w-full px-4 py-3 rounded-xl bg-[var(--color-neutral-900)] border text-sm font-medium transition-all focus:outline-none focus:ring-2 ${
                      errors.name
                        ? 'border-rose-500/50 focus:ring-rose-500/30'
                        : 'border-[var(--color-neutral-800)] focus:ring-[var(--color-accent)]/50 focus:bg-[var(--color-neutral-800)]'
                    }`}
                    disabled={submitting}
                  />
                </Field>

                <Field
                  label="Service Code"
                  required
                  error={errors.code}
                  hint="Unique short identifier (auto-fill)"
                >
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => set('code', e.target.value.toUpperCase())}
                    placeholder="e.g., BHM-001"
                    className={`w-full px-4 py-3 rounded-xl bg-[var(--color-neutral-900)] border text-sm font-mono transition-all focus:outline-none focus:ring-2 ${
                      errors.code
                        ? 'border-rose-500/50 focus:ring-rose-500/30'
                        : 'border-[var(--color-neutral-800)] focus:ring-[var(--color-accent)]/50 focus:bg-[var(--color-neutral-800)]'
                    }`}
                    disabled={submitting}
                  />
                </Field>
              </div>

              <Field label="Description" hint="Detailed scope of the service (optional)">
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="e.g., Full bridal package including hairstyling, makeup, and finishing touch-ups..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--color-neutral-900)] border border-[var(--color-neutral-800)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:bg-[var(--color-neutral-800)] resize-none transition-all placeholder-[var(--color-neutral-600)]"
                  disabled={submitting}
                />
              </Field>
            </div>

            {/* ── Section: Pricing & Timing ─────────────────────────────── */}
            <div className="p-8 space-y-6 bg-[var(--color-surface-raised)]/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                <h3 className="text-xs font-black text-[var(--color-neutral-500)] uppercase tracking-[0.2em]">
                  Pricing & Timing
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Duration */}
                <Field
                  label="Service Duration"
                  required
                  error={errors.duration_minutes}
                  hint={durationLabel ? `Calculation: ${durationLabel}` : 'Time block required for booking'}
                >
                  <div className="relative group">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-neutral-500)] group-focus-within:text-[var(--color-accent)] transition-colors pointer-events-none" />
                    <input
                      type="number"
                      min={5}
                      max={480}
                      step={5}
                      value={form.duration_minutes}
                      onChange={e => set('duration_minutes', e.target.value)}
                      placeholder="60"
                      className={`w-full pl-11 pr-14 py-3 rounded-xl bg-[var(--color-neutral-900)] border text-sm font-bold focus:outline-none focus:ring-2 transition-all ${
                        errors.duration_minutes
                          ? 'border-rose-500/50 focus:ring-rose-500/30'
                          : 'border-[var(--color-neutral-800)] focus:ring-[var(--color-accent)]/50 focus:bg-[var(--color-neutral-800)]'
                      }`}
                      disabled={submitting}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--color-neutral-500)] uppercase pointer-events-none select-none">
                      min
                    </span>
                  </div>
                  {/* Quick presets (Pro Max Priority 2: 48px hit targets) */}
                  <div className="flex gap-2 flex-wrap mt-2">
                    {[30, 45, 60, 90, 120].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => set('duration_minutes', String(m))}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                          form.duration_minutes === String(m)
                            ? 'bg-[var(--color-accent)] text-[var(--color-surface-base)] shadow-lg shadow-[var(--color-accent)]/20'
                            : 'bg-[var(--color-neutral-900)] text-[var(--color-neutral-400)] border border-[var(--color-neutral-800)] hover:text-[var(--color-neutral-200)] hover:border-[var(--color-neutral-700)]'
                        }`}
                        disabled={submitting}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Price */}
                <Field
                  label="Service Price"
                  required
                  error={errors.price}
                  hint="Final price charged to customer"
                >
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-neutral-500)] font-bold text-sm group-focus-within:text-[var(--color-accent)] transition-colors pointer-events-none">
                      ₹
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.price}
                      onChange={e => set('price', e.target.value)}
                      placeholder="0.00"
                      className={`w-full pl-9 py-3 rounded-xl bg-[var(--color-neutral-900)] border text-sm font-bold font-mono focus:outline-none focus:ring-2 transition-all ${
                        errors.price
                          ? 'border-rose-500/50 focus:ring-rose-500/30'
                          : 'border-[var(--color-neutral-800)] focus:ring-[var(--color-accent)]/50 focus:bg-[var(--color-neutral-800)]'
                      }`}
                      disabled={submitting}
                    />
                  </div>
                </Field>
              </div>
            </div>

            {/* ── Section: Status ───────────────────────────────────────── */}
            <div className="p-8">
              <label className="flex items-start gap-4 cursor-pointer group select-none">
                <div className="relative mt-1">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => set('is_active', e.target.checked)}
                    className="sr-only peer"
                    disabled={submitting}
                  />
                  <div className="w-12 h-6 rounded-full bg-[var(--color-neutral-800)] border border-[var(--color-neutral-700)] peer-checked:bg-[var(--color-accent)]/20 transition-all duration-300" />
                  <div className="absolute left-1 top-1 w-4 h-4 bg-[var(--color-neutral-500)] rounded-full shadow-lg transition-all duration-300 peer-checked:translate-x-6 peer-checked:bg-[var(--color-accent)]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--color-neutral-100)]">Visibility Status</p>
                  <p className="text-xs text-[var(--color-neutral-500)] mt-1 font-medium leading-relaxed">
                    When active, this service will be discoverable and bookable by customers in the chatbot and member portal.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* ── Required fields notice ─────────────────────────────────── */}
          <div className="mt-6 flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl text-[var(--color-neutral-500)]">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500/50" />
            <p className="text-xs font-medium leading-relaxed">
              <strong className="text-[var(--color-neutral-400)]">Validation Check:</strong> Service identity, pricing, and timing blocks are required. Please ensure the <span className="text-[var(--color-accent)]">Service Code</span> remains unique within your salon registry.
            </p>
          </div>

          {/* ── Actions (Pro Max Priority 2: Large Hit Targets) ──────────────── */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={() => navigate('/owner/services')}
              className="flex-1 sm:flex-none px-8 py-4 text-sm font-bold text-[var(--color-neutral-400)] bg-[var(--color-surface-raised)] border border-[var(--color-neutral-800)] rounded-2xl hover:text-[var(--color-neutral-100)] hover:bg-[var(--color-surface-overlay)] transition-all disabled:opacity-50"
              disabled={submitting}
            >
              Cancel
            </button>

            <div className="flex flex-1 gap-4">
              <button
                type="button"
                onClick={handleAddAnother}
                disabled={submitting}
                className="flex-1 px-6 py-4 text-sm font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 rounded-2xl hover:bg-[var(--color-accent)]/10 hover:border-[var(--color-accent)]/40 transition-all disabled:opacity-50"
              >
                {submitting ? 'Syncing...' : 'Save & Add Another'}
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-8 py-4 text-sm font-bold text-[var(--color-surface-base)] bg-gradient-to-r from-[var(--color-accent)] to-amber-600 rounded-2xl hover:from-amber-500 hover:to-amber-700 shadow-xl shadow-[var(--color-accent)]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" strokeWidth={3} />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" strokeWidth={2.5} />
                    <span>Complete Config</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
