"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useClient } from "@/lib/client-context";
import { cn } from "@/lib/utils";
import { Save, Check, Upload, Lock } from "lucide-react";

/* ── Types ── */

interface EditableFields {
  name: string;
  industry: string;
  logoUrl: string;
  primaryColor: string;
  monthlyBudget: number;
  metaAllocation: number;
  googleAllocation: number;
  targetROAS: number;
  targetCPL: number;
  targetCPA: number;
  targetMER: number;
  retainerFee: number;
  windsorApiKey: string;
  slackWebhookUrl: string;
}

/* ── Helpers ── */

function InputField({
  label,
  value,
  onChange,
  type = "text",
  prefix,
  suffix,
  placeholder,
  disabled,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number" | "url" | "password" | "color";
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-medium flex items-center gap-1">
        {label}
        {disabled && <Lock size={8} className="text-[#94A3B8]/50" />}
      </label>
      <div className="flex items-center gap-0">
        {prefix && (
          <span className={cn(
            "px-3 py-2.5 text-sm text-[#94A3B8] bg-white/[0.04] border border-r-0 border-white/[0.1] rounded-l-lg",
            disabled && "opacity-50",
          )}>
            {prefix}
          </span>
        )}
        {type === "color" ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="color"
              value={String(value)}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className={cn(
                "h-9 w-12 rounded-lg border border-white/[0.1] bg-transparent cursor-pointer",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            />
            <input
              type="text"
              value={String(value)}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className={cn(
                "flex-1 px-3 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.1] rounded-lg focus:outline-none focus:border-[#FF6A41]/50 transition-colors font-mono",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            />
          </div>
        ) : (
          <input
            type={type}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "flex-1 px-3 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.1] focus:outline-none focus:border-[#FF6A41]/50 transition-colors",
              prefix ? "rounded-r-lg" : suffix ? "rounded-l-lg" : "rounded-lg",
              type === "password" && "font-mono",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          />
        )}
        {suffix && (
          <span className={cn(
            "px-3 py-2.5 text-sm text-[#94A3B8] bg-white/[0.04] border border-l-0 border-white/[0.1] rounded-r-lg",
            disabled && "opacity-50",
          )}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-white">{String(value)}</p>
    </div>
  );
}

/* ── Page ── */

export default function SettingsPage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const clientCtx = useClient();
  const baseClient = clientCtx?.clientConfig;
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<EditableFields | null>(null);

  const isAdmin = clientCtx?.isAdmin ?? false;

  useEffect(() => {
    if (!baseClient) return;
    const storageKey = `ontrack-settings-${clientSlug}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setForm(JSON.parse(stored) as EditableFields);
        return;
      } catch {
        // fall through
      }
    }
    setForm({
      name: baseClient.name,
      industry: baseClient.industry,
      logoUrl: baseClient.logoUrl ?? "",
      primaryColor: baseClient.primaryColor,
      monthlyBudget: baseClient.monthlyBudget,
      metaAllocation: Math.round(baseClient.metaAllocation * 100),
      googleAllocation: Math.round(baseClient.googleAllocation * 100),
      targetROAS: baseClient.targetROAS,
      targetCPL: baseClient.targetCPL ?? 0,
      targetCPA: baseClient.targetCPA,
      targetMER: baseClient.targetMER,
      retainerFee: baseClient.retainerFee,
      windsorApiKey: baseClient.windsorApiKey ?? "",
      slackWebhookUrl: "",
    });
  }, [clientSlug, baseClient]);

  if (!baseClient || !form) return null;

  function set(field: keyof EditableFields, value: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const numFields: (keyof EditableFields)[] = [
        "monthlyBudget", "metaAllocation", "googleAllocation",
        "targetROAS", "targetCPL", "targetCPA", "targetMER", "retainerFee",
      ];
      return {
        ...prev,
        [field]: numFields.includes(field) ? Number(value) || 0 : value,
      };
    });
    setSaved(false);
  }

  function handleSave() {
    const storageKey = `ontrack-settings-${clientSlug}`;
    localStorage.setItem(storageKey, JSON.stringify(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const currencySymbol = baseClient.currency === "GBP" ? "£" : baseClient.currency === "USD" ? "$" : baseClient.currency === "EUR" ? "€" : "AED";

  return (
    <>
      <Header title="Settings" showDateRange={false} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
        {/* Role indicator + save bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {!isAdmin && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                <Lock size={10} />
                Client View — some fields are read-only
              </span>
            )}
            {isAdmin && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                Admin — full edit access
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all w-full sm:w-auto",
              saved
                ? "bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30"
                : "bg-[#FF6A41] text-white hover:bg-[#FF6A41]/90",
            )}
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? "Saved!" : "Save Changes"}
          </button>
        </div>

        {/* ── Branding (admin-only edit) ── */}
        <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
            Client Branding
          </h2>

          {form.logoUrl && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.logoUrl}
                alt={form.name}
                className="h-10 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <p className="text-xs text-[#94A3B8]">Logo preview</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <InputField
              label="Client Name"
              value={form.name}
              onChange={(v) => set("name", v)}
              disabled={!isAdmin}
            />
            <InputField
              label="Logo URL"
              value={form.logoUrl}
              onChange={(v) => set("logoUrl", v)}
              type="url"
              placeholder="https://your-cdn.com/logo.png"
              disabled={!isAdmin}
            />
            <InputField
              label="Industry"
              value={form.industry}
              onChange={(v) => set("industry", v)}
              disabled={!isAdmin}
            />
            <InputField
              label="Brand Color"
              value={form.primaryColor}
              onChange={(v) => set("primaryColor", v)}
              type="color"
              disabled={!isAdmin}
            />
          </div>

          {isAdmin && (
            <div className="pt-1">
              <p className="text-[10px] text-[#94A3B8]">
                <Upload size={10} className="inline mr-1" />
                For file uploads, host your logo on Cloudinary or Imgur and paste the URL above.
              </p>
            </div>
          )}
        </section>

        {/* ── Budget & Allocation (admin-only edit) ── */}
        <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
            Budget & Allocation
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <InputField
              label="Monthly Budget"
              value={form.monthlyBudget}
              onChange={(v) => set("monthlyBudget", v)}
              type="number"
              prefix={currencySymbol}
              disabled={!isAdmin}
            />
            <InputField
              label="Meta Allocation"
              value={form.metaAllocation}
              onChange={(v) => set("metaAllocation", v)}
              type="number"
              suffix="%"
              disabled={!isAdmin}
            />
            <InputField
              label="Google Allocation"
              value={form.googleAllocation}
              onChange={(v) => set("googleAllocation", v)}
              type="number"
              suffix="%"
              disabled={!isAdmin}
            />
          </div>
        </section>

        {/* ── KPI Targets (admin-only edit) ── */}
        <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
            KPI Targets
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <InputField
              label="Target ROAS"
              value={form.targetROAS}
              onChange={(v) => set("targetROAS", v)}
              type="number"
              suffix="x"
              disabled={!isAdmin}
            />
            <InputField
              label="Target CPL"
              value={form.targetCPL}
              onChange={(v) => set("targetCPL", v)}
              type="number"
              prefix={currencySymbol}
              disabled={!isAdmin}
            />
            <InputField
              label="Target CPA"
              value={form.targetCPA}
              onChange={(v) => set("targetCPA", v)}
              type="number"
              prefix={currencySymbol}
              disabled={!isAdmin}
            />
            <InputField
              label="Target MER"
              value={form.targetMER}
              onChange={(v) => set("targetMER", v)}
              type="number"
              suffix="x"
              disabled={!isAdmin}
            />
          </div>
        </section>

        {/* ── Agency & Retainer (admin-only edit) ── */}
        <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
            Agency & Retainer
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <InputField
              label="Retainer Fee"
              value={form.retainerFee}
              onChange={(v) => set("retainerFee", v)}
              type="number"
              prefix={currencySymbol}
              disabled={!isAdmin}
            />
            <ReadField label="Tier" value={baseClient.tier.replace("_", " ")} />
            <ReadField label="Contract Start" value={baseClient.contractStart} />
            <ReadField label="Contract Renewal" value={baseClient.contractRenewal} />
          </div>
        </section>

        {/* ── Integrations (editable by both admin and client) ── */}
        <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
              Integrations
            </h2>
            {!isAdmin && (
              <span className="text-[10px] text-emerald-400 font-medium">Editable</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <InputField
              label="Windsor.ai API Key"
              value={form.windsorApiKey}
              onChange={(v) => set("windsorApiKey", v)}
              type="password"
              placeholder="wnd_xxxxxxxxxxxxxxxx"
            />
            <InputField
              label="Slack Webhook URL"
              value={form.slackWebhookUrl}
              onChange={(v) => set("slackWebhookUrl", v)}
              type="url"
              placeholder="https://hooks.slack.com/services/..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
            <div className="space-y-1">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">
                Meta Account IDs
              </p>
              <div className="flex flex-wrap gap-1.5">
                {baseClient.metaAccountIds.map((id) => (
                  <span
                    key={id}
                    className="px-2 py-0.5 rounded-md text-xs bg-white/[0.06] text-[#94A3B8] font-mono"
                  >
                    {id}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">
                Google Customer IDs
              </p>
              <div className="flex flex-wrap gap-1.5">
                {baseClient.googleCustomerIds.map((id) => (
                  <span
                    key={id}
                    className="px-2 py-0.5 rounded-md text-xs bg-white/[0.06] text-[#94A3B8] font-mono"
                  >
                    {id}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Bottom save button */}
        <div className="flex justify-end pb-4">
          <button
            onClick={handleSave}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all w-full sm:w-auto",
              saved
                ? "bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30"
                : "bg-[#FF6A41] text-white hover:bg-[#FF6A41]/90",
            )}
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
