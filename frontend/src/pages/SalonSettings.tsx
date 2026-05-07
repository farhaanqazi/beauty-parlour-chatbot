import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Save, AlertCircle, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import apiClient from '../services/apiClient';

export default function SalonSettings() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const salonId = localStorage.getItem('selectedSalonId') || user?.salon_id || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [greeting, setGreeting] = useState("Welcome to {salon_name}! I can help you book your appointment.");

  useEffect(() => {
    const fetchSalon = async () => {
      try {
        const res = await apiClient.get(`/api/v1/salons/${salonId}`);
        const config = res.data.flow_config || {};
        if (config.greeting) {
          setGreeting(config.greeting);
        }
      } catch (err: any) {
        setError("Failed to load salon settings.");
      } finally {
        setLoading(false);
      }
    };
    if (salonId) fetchSalon();
  }, [salonId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiClient.patch(`/api/v1/salons/${salonId}`, {
        flow_config: {
          greeting
        }
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-base)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-base)] text-[var(--color-neutral-100)] pb-20">
      <div className="border-b border-[var(--color-neutral-800)] sticky top-16 z-30 bg-[var(--color-surface-base)]/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/owner/dashboard')}
              className="p-2 hover:bg-[var(--color-surface-overlay)] rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--color-neutral-400)]" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6 text-[var(--color-accent)]" />
              Bot Settings
            </h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-accent)] text-black font-semibold rounded-xl hover:bg-[var(--color-accent)]/90 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 rounded-2xl text-[var(--color-success)]">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">Settings updated successfully!</span>
          </div>
        )}

        <div className="bg-[var(--color-surface-raised)] rounded-3xl border border-[var(--color-neutral-800)] p-8 shadow-2xl">
          <h2 className="text-lg font-bold mb-2">Greeting Message</h2>
          <p className="text-sm text-[var(--color-neutral-400)] mb-6">
            This is the first message your customers will see when they start a chat.
            Use <code className="text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-1.5 py-0.5 rounded">{"{salon_name}"}</code> to automatically inject your salon's name.
          </p>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-wider ml-1 mb-2 block">
                Greeting Template
              </span>
              <textarea
                value={greeting}
                onChange={e => setGreeting(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-neutral-900)] border border-[var(--color-neutral-800)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:bg-[var(--color-neutral-800)] resize-none transition-all placeholder-[var(--color-neutral-600)]"
              />
            </label>
            <div className="p-4 bg-[var(--color-surface-overlay)] rounded-xl border border-[var(--color-neutral-800)]">
              <p className="text-xs text-[var(--color-neutral-500)] font-bold uppercase tracking-widest mb-2">Live Preview</p>
              <p className="text-sm text-white italic">
                {greeting.replace('{salon_name}', 'Demo Beauty Palace')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
