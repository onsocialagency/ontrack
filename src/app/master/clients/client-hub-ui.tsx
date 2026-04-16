"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { formatCurrency, cn } from "@/lib/utils";
import type { Client, ClientType, Currency, Tier } from "@/lib/types";
import Link from "next/link";
import Image from "next/image";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ExternalLink,
  Key,
  Wifi,
  WifiOff,
} from "lucide-react";

/* ── Types ── */

type FormData = {
  id: string;
  name: string;
  slug: string;
  type: ClientType;
  industry: string;
  currency: Currency;
  monthlyBudget: number;
  metaAllocation: number;
  googleAllocation: number;
  targetROAS: number;
  targetCPL: number;
  targetCPA: number;
  targetMER: number;
  tier: Tier;
  retainerFee: number;
  password: string;
  windsorApiKey: string;
  primaryColor: string;
  logoUrl: string;
};

const EMPTY_FORM: FormData = {
  id: "",
  name: "",
  slug: "",
  type: "ecommerce",
  industry: "",
  currency: "GBP",
  monthlyBudget: 0,
  metaAllocation: 60,
  googleAllocation: 40,
  targetROAS: 0,
  targetCPL: 0,
  targetCPA: 0,
  targetMER: 0,
  tier: "tier_2",
  retainerFee: 0,
  password: "",
  windsorApiKey: "",
  primaryColor: "#FF6A41",
  logoUrl: "",
};

/* ── Helpers ── */

/** Real account IDs are all-numeric or digit-hyphen (e.g. Meta, Google). Fake ones contain letters. */
function isLive(client: Client): boolean {
  const realMeta = client.metaAccountIds?.some((id) => /^\d+$/.test(id));
  const realGoogle = client.googleCustomerIds?.some((id) =>
    /^\d{3}-\d{3}-\d{4}$/.test(id),
  );
  return !!(realMeta || realGoogle);
}

function tierLabel(tier: Tier) {
  return tier === "premium" ? "Premium" : tier.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ClientAvatar({ client }: { client: Client }) {
  const [imgError, setImgError] = useState(false);

  if (client.logoUrl && !imgError) {
    return (
      <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-white flex-shrink-0">
        <Image
          src={client.logoUrl}
          alt={client.name}
          width={48}
          height={48}
          className="object-contain w-full h-full"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
      style={{ backgroundColor: client.primaryColor }}
    >
      {client.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function InputRow({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  prefix,
  suffix,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-medium">
        {label}
      </label>
      <div className="flex items-center gap-0">
        {prefix && (
          <span className="px-2.5 py-2 text-xs text-[#94A3B8] bg-white/[0.04] border border-r-0 border-white/[0.1] rounded-l-lg">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "flex-1 px-3 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.1] focus:outline-none focus:border-[#FF6A41]/50 transition-colors",
            prefix ? "rounded-r-lg" : suffix ? "rounded-l-lg" : "rounded-lg",
          )}
        />
        {suffix && (
          <span className="px-2.5 py-2 text-xs text-[#94A3B8] bg-white/[0.04] border border-l-0 border-white/[0.1] rounded-r-lg">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-medium">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.1] rounded-lg focus:outline-none focus:border-[#FF6A41]/50 transition-colors appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#12121A]">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── Client Card ── */

function ClientCard({
  client,
  onEdit,
  onDelete,
  deleting,
}: {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (slug: string) => void;
  deleting: boolean;
}) {
  const live = isLive(client);

  return (
    <div className="relative group glass-card rounded-2xl overflow-hidden hover:border-white/[0.12] transition-all">
      {/* Clickable overlay — opens in new tab */}
      <Link
        href={`/${client.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-10"
        aria-label={`Open ${client.name} dashboard`}
      />

      {/* Top accent bar */}
      <div className="h-1" style={{ backgroundColor: client.primaryColor }} />

      <div className="p-4 sm:p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <ClientAvatar client={client} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white text-base leading-tight truncate">
                {client.name}
              </h3>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0",
                  live
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/20 text-amber-400",
                )}
              >
                {live ? "Live" : "Mock"}
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">{client.industry}</p>
            <p className="text-[10px] text-[#475569] font-mono mt-0.5">/{client.slug}</p>
          </div>
          {/* Action buttons — above the link overlay */}
          <div className="flex items-center gap-0.5 relative z-20 flex-shrink-0">
            <button
              onClick={(e) => { e.preventDefault(); onEdit(client); }}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); onDelete(client.slug); }}
              disabled={deleting}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
              title="Delete"
            >
              {deleting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} />
              )}
            </button>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
              client.type === "ecommerce" && "bg-emerald-500/15 text-emerald-400",
              client.type === "lead_gen" && "bg-blue-500/15 text-blue-400",
              client.type === "hybrid" && "bg-purple-500/15 text-purple-400",
            )}
          >
            {client.type.replace("_", " ")}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.06] text-[#94A3B8] uppercase tracking-wider">
            {tierLabel(client.tier)}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/[0.03] rounded-lg px-3 py-2">
            <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Budget</p>
            <p className="text-sm font-semibold text-white mt-0.5">
              {formatCurrency(client.monthlyBudget, client.currency)}
            </p>
          </div>
          <div className="bg-white/[0.03] rounded-lg px-3 py-2">
            <p className="text-[10px] text-[#64748B] uppercase tracking-wider">Retainer</p>
            <p className="text-sm font-semibold text-white mt-0.5">
              {formatCurrency(client.retainerFee, client.currency)}
            </p>
          </div>
        </div>

        {/* Platforms */}
        <div className="flex items-center justify-between text-[11px] text-[#64748B] border-t border-white/[0.04] pt-3">
          <div className="flex items-center gap-3">
            <span>
              Meta{" "}
              <span className="text-white/70 font-medium">
                {Math.round(client.metaAllocation * 100)}%
              </span>
            </span>
            <span>
              Google{" "}
              <span className="text-white/70 font-medium">
                {Math.round(client.googleAllocation * 100)}%
              </span>
            </span>
          </div>
          <ExternalLink size={12} className="text-[#475569] group-hover:text-[#94A3B8] transition-colors" />
        </div>
      </div>
    </div>
  );
}

/* ── Page ── */

export function ClientHubUI({ initialClients }: { initialClients: Client[] }) {
  const [clientList, setClientList] = useState<Client[]>(initialClients);
  const [showModal, setShowModal] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  function openAddModal() {
    setEditSlug(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEditModal(client: Client) {
    setEditSlug(client.slug);
    setForm({
      id: client.id,
      name: client.name,
      slug: client.slug,
      type: client.type,
      industry: client.industry,
      currency: client.currency,
      monthlyBudget: client.monthlyBudget,
      metaAllocation: Math.round(client.metaAllocation * 100),
      googleAllocation: Math.round(client.googleAllocation * 100),
      targetROAS: client.targetROAS,
      targetCPL: client.targetCPL ?? 0,
      targetCPA: client.targetCPA,
      targetMER: client.targetMER,
      tier: client.tier,
      retainerFee: client.retainerFee,
      password: client.password,
      windsorApiKey: client.windsorApiKey ?? "",
      primaryColor: client.primaryColor,
      logoUrl: client.logoUrl ?? "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        metaAllocation: form.metaAllocation / 100,
        googleAllocation: form.googleAllocation / 100,
      };
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setClientList(data.clients);
        setShowModal(false);
      }
    } catch {
      // error
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(slug: string) {
    if (!confirm(`Delete client "${slug}"? This cannot be undone.`)) return;
    setDeleting(slug);
    try {
      const res = await fetch(`/api/clients?slug=${slug}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setClientList(data.clients);
      }
    } catch {
      // error
    } finally {
      setDeleting(null);
    }
  }

  function set(field: keyof FormData, value: string) {
    setForm((prev) => {
      const numFields: (keyof FormData)[] = [
        "monthlyBudget",
        "metaAllocation",
        "googleAllocation",
        "targetROAS",
        "targetCPL",
        "targetCPA",
        "targetMER",
        "retainerFee",
      ];
      return {
        ...prev,
        [field]: numFields.includes(field) ? Number(value) || 0 : value,
      };
    });
    if (field === "name" && !editSlug) {
      setForm((prev) => ({
        ...prev,
        slug: value
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, ""),
        password: prev.password || `${value.toLowerCase().replace(/[^a-z0-9]/g, "")}2026`,
      }));
    }
  }

  const liveCount = clientList.filter(isLive).length;

  return (
    <>
      <Header title="Client Hub" showDateRange={false} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
        {/* Action bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <p className="text-sm text-[#94A3B8]">
              <span className="text-white font-medium">{clientList.length}</span> clients
            </p>
            <p className="text-sm text-[#94A3B8]">
              <span className="text-emerald-400 font-medium">{liveCount}</span> live
            </p>
            <p className="text-sm text-[#94A3B8]">
              <span className="text-amber-400 font-medium">{clientList.length - liveCount}</span> mock
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#FF6A41] text-white hover:bg-[#FF6A41]/90 transition-colors w-full sm:w-auto"
          >
            <Plus size={14} />
            Add Client
          </button>
        </div>

        {/* Client cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {clientList.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={openEditModal}
              onDelete={handleDelete}
              deleting={deleting === client.slug}
            />
          ))}
        </div>
      </div>

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
          <div className="w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto glass-card rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {editSlug ? "Edit Client" : "Add New Client"}
                </h2>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">
                  Fields marked with <span className="text-[#FF6A41]">*</span> are required
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider border-b border-white/[0.06] pb-2">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InputRow label="Client Name *" value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Bayer" />
                <InputRow label="URL Slug *" value={form.slug} onChange={(v) => set("slug", v)} placeholder="auto-generated from name" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <SelectRow
                  label="Client Type *"
                  value={form.type}
                  onChange={(v) => set("type", v)}
                  options={[
                    { value: "ecommerce", label: "Ecommerce" },
                    { value: "lead_gen", label: "Lead Gen" },
                    { value: "hybrid", label: "Hybrid" },
                  ]}
                />
                <InputRow label="Industry" value={form.industry} onChange={(v) => set("industry", v)} placeholder="e.g. Automotive" />
                <SelectRow
                  label="Currency *"
                  value={form.currency}
                  onChange={(v) => set("currency", v)}
                  options={[
                    { value: "GBP", label: "GBP (£)" },
                    { value: "USD", label: "USD ($)" },
                    { value: "EUR", label: "EUR (€)" },
                    { value: "AED", label: "AED (د.إ)" },
                  ]}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InputRow label="Login Password *" value={form.password} onChange={(v) => set("password", v)} type="text" placeholder="Auto-generated or custom" />
                <div className="space-y-1">
                  <label className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-medium">Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => set("primaryColor", e.target.value)}
                      className="h-9 w-12 rounded-lg border border-white/[0.1] bg-transparent cursor-pointer"
                    />
                    <span className="text-sm text-[#94A3B8] font-mono">{form.primaryColor}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Budget & Targets */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider border-b border-white/[0.06] pb-2">
                Budget & Targets
                <span className="ml-2 text-[10px] font-normal normal-case text-[#94A3B8]/60">optional</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <InputRow label="Monthly Budget" value={form.monthlyBudget} onChange={(v) => set("monthlyBudget", v)} type="number" placeholder="0" />
                <InputRow label="Meta %" value={form.metaAllocation} onChange={(v) => set("metaAllocation", v)} type="number" suffix="%" />
                <InputRow label="Google %" value={form.googleAllocation} onChange={(v) => set("googleAllocation", v)} type="number" suffix="%" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <InputRow label="Target ROAS" value={form.targetROAS} onChange={(v) => set("targetROAS", v)} type="number" placeholder="0" />
                <InputRow label="Target CPA" value={form.targetCPA} onChange={(v) => set("targetCPA", v)} type="number" placeholder="0" />
                <InputRow label="Target CPL" value={form.targetCPL} onChange={(v) => set("targetCPL", v)} type="number" placeholder="0" />
                <InputRow label="Target MER" value={form.targetMER} onChange={(v) => set("targetMER", v)} type="number" placeholder="0" />
              </div>
            </div>

            {/* Agency */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider border-b border-white/[0.06] pb-2">
                Agency
                <span className="ml-2 text-[10px] font-normal normal-case text-[#94A3B8]/60">optional</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <SelectRow
                  label="Tier"
                  value={form.tier}
                  onChange={(v) => set("tier", v)}
                  options={[
                    { value: "tier_1", label: "Tier 1" },
                    { value: "tier_2", label: "Tier 2" },
                    { value: "tier_3", label: "Tier 3" },
                    { value: "tier_4", label: "Tier 4" },
                    { value: "premium", label: "Premium" },
                  ]}
                />
                <InputRow label="Retainer Fee" value={form.retainerFee} onChange={(v) => set("retainerFee", v)} type="number" placeholder="0" />
              </div>
            </div>

            {/* Integrations & Branding */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider border-b border-white/[0.06] pb-2">
                Integrations & Branding
                <span className="ml-2 text-[10px] font-normal normal-case text-[#94A3B8]/60">optional</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InputRow label="Windsor.ai API Key" value={form.windsorApiKey} onChange={(v) => set("windsorApiKey", v)} type="password" placeholder="Leave blank for mock data" />
                <InputRow label="Logo URL" value={form.logoUrl} onChange={(v) => set("logoUrl", v)} type="url" placeholder="https://..." />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#94A3B8] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.slug}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  saving || !form.name || !form.slug
                    ? "bg-[#FF6A41]/40 text-white/50 cursor-not-allowed"
                    : "bg-[#FF6A41] text-white hover:bg-[#FF6A41]/90",
                )}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editSlug ? "Update Client" : "Create Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
