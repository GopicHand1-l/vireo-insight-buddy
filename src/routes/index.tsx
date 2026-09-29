import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";
import data from "@/data/dashboard.json";
import { getBrief } from "@/lib/brief.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vireo CX Intelligence — Fair agent scores & defect root cause" },
      { name: "description", content: "Queue-normalised CSAT and handle time per agent, festive Pulse 2 defect analysis and rupee impact for Vireo Audio." },
      { property: "og:title", content: "Vireo CX Intelligence" },
      { property: "og:description", content: "Fair agent evaluation, root-cause lots and the rupee business case." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Agent = (typeof data.agents)[number];
const K = data.kpis;
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const pct = (n: number) => (n * 100).toFixed(1) + "%";

function Dashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Vireo Audio · Support intelligence</p>
            <h1 className="font-display text-4xl md:text-5xl mt-2">Don't retrain the bottom ten.</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {K.tickets.toLocaleString("en-IN")} tickets, {K.agents} agents, Jan 2025 – Jun 2026. Scores are compared against what each agent's queue normally gets — not a raw league table.
            </p>
          </div>
          <nav className="flex gap-4 font-mono text-xs uppercase">
            {["agents", "root-cause", "business-case", "validation"].map((s) => (
              <a key={s} href={`#${s}`} className="hover:text-primary">{s.replace("-", " ")}</a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-16">
        <Kpis />
        <Agents />
        <RootCause />
        <BusinessCase />
        <Validation />
      </main>
      <footer className="border-t border-border py-6 text-center font-mono text-xs text-muted-foreground">
        All figures computed deterministically from the uploaded exports. AI text is checked number-by-number.
      </footer>
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "bad" | "good" }) {
  return (
    <div className="border-t-2 border-foreground pt-3">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`font-display text-3xl mt-1 ${tone === "bad" ? "text-primary" : tone === "good" ? "text-accent-foreground" : ""}`}>{value}</p>
      {note && <p className="text-xs text-muted-foreground mt-1">{note}</p>}
    </div>
  );
}

function Kpis() {
  return (
    <section className="grid grid-cols-2 md:grid-cols-5 gap-6">
      <Kpi label="Avg CSAT" value={K.csat.toFixed(2)} note={`${K.csat_responses.toLocaleString("en-IN")} responses, blanks excluded`} />
      <Kpi label="Festive Pulse 2 CSAT" value={K.festive_csat.toFixed(2)} note={`vs ${K.base_csat} everywhere else`} tone="bad" />
      <Kpi label="Replacement rate" value={pct(K.festive_rate)} note={`festive lots vs ${pct(K.base_rate)} baseline`} tone="bad" />
      <Kpi label="Naive bottom-10 in Tier 2" value={`${K.naive_bottom_tier2} / 10`} note="policy forbids this comparison" />
      <Kpi label="Agents actually flagged" value={String(K.flagged)} note="after fairness checks" tone="good" />
    </section>
  );
}

function Agents() {
  const [mode, setMode] = useState<"fair" | "naive">("fair");
  const [team, setTeam] = useState("All");
  const teams = ["All", ...Array.from(new Set(data.agents.map((a) => a.team)))];
  const rows = useMemo(() => {
    const r = data.agents.filter((a) => team === "All" || a.team === team);
    return [...r].sort((a, b) => (mode === "naive" ? a.csat - b.csat : a.shrunk - b.shrunk));
  }, [mode, team]);
  return (
    <section id="agents" className="scroll-mt-6">
      <SectionHead n="01" title="Agent performance" sub="CSAT and handle time per agent. Fair mode compares each agent to the expected score for their mix of issue type, channel and defective-lot exposure, with small-sample shrinkage and a 95% confidence check." />
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="inline-flex border border-border rounded">
          {(["fair", "naive"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-4 py-2 text-sm ${mode === m ? "bg-foreground text-background" : ""}`}>
              {m === "fair" ? "Fair (queue-normalised)" : "Naive raw ranking"}
            </button>
          ))}
        </div>
        <select value={team} onChange={(e) => setTeam(e.target.value)} className="border border-border bg-card rounded px-3 py-2 text-sm">
          {teams.map((t) => <option key={t}>{t}</option>)}
        </select>
        {mode === "naive" && (
          <p className="text-sm text-primary">Warning: naive bottom 10 includes {K.naive_bottom_tier2} Tier 2 warranty agents who handle broken hardware by design.</p>
        )}
      </div>
      <div className="overflow-x-auto border border-border rounded bg-card">
        <table className="w-full text-sm">
          <thead className="font-mono text-[11px] uppercase text-muted-foreground bg-muted">
            <tr>
              {["Agent", "Team", "Tier", "Surveys", "CSAT", "Expected", "Fair gap", "95% CI", "Handle (h, median)", "vs queue", "Late 1st reply", "Hardware share", "Verdict"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => <AgentRow key={a.id} a={a} naiveBottom={mode === "naive" && i < 10 && team === "All"} />)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">Handle time = first reply to resolution (policy §10). "vs queue" = agent median ÷ median for the same issue & channel. Agents joined by ID — two different people are named Kavya Pandey.</p>
    </section>
  );
}

function AgentRow({ a, naiveBottom }: { a: Agent; naiveBottom: boolean }) {
  const verdictTone = a.flag ? "bg-primary text-primary-foreground" : a.tier === 2 ? "bg-secondary" : "bg-accent text-accent-foreground";
  return (
    <tr className={`border-t border-border ${naiveBottom ? "bg-muted" : ""}`}>
      <td className="px-3 py-2 whitespace-nowrap"><span className="font-medium">{a.name}</span> <span className="font-mono text-xs text-muted-foreground">{a.id}</span></td>
      <td className="px-3 py-2 whitespace-nowrap">{a.team}<span className="text-muted-foreground text-xs"> · {a.site} {a.shift}</span></td>
      <td className="px-3 py-2 font-mono">{a.tier}</td>
      <td className="px-3 py-2 font-mono">{a.csat_n}</td>
      <td className="px-3 py-2 font-mono">{a.csat.toFixed(2)}</td>
      <td className="px-3 py-2 font-mono text-muted-foreground">{a.expected.toFixed(2)}</td>
      <td className={`px-3 py-2 font-mono ${a.shrunk < -0.15 ? "text-primary" : ""}`}>{a.shrunk > 0 ? "+" : ""}{a.shrunk.toFixed(2)}</td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{a.ci_lo.toFixed(2)} … {a.ci_hi.toFixed(2)}</td>
      <td className="px-3 py-2 font-mono">{a.handle_med}</td>
      <td className="px-3 py-2 font-mono">{a.handle_ratio}×</td>
      <td className="px-3 py-2 font-mono">{pct(a.breach_rate)}</td>
      <td className="px-3 py-2 font-mono">{pct(a.hardware_share)}</td>
      <td className="px-3 py-2"><span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${verdictTone}`}>{a.flag ? "Coach — review" : a.flag_reason}</span></td>
    </tr>
  );
}

function SectionHead({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="mb-6 grid md:grid-cols-[80px_1fr] gap-2">
      <span className="font-mono text-primary text-sm">{n}</span>
      <div>
        <h2 className="font-display text-3xl">{title}</h2>
        <p className="text-muted-foreground mt-1 max-w-3xl">{sub}</p>
      </div>
    </div>
  );
}

function RootCause() {
  const lots = data.lots.filter((l) => l.product_sku === "VA-EB-PL2" && l.tickets >= 20).map((l) => ({
    ...l, label: l.lot_code.replace("PL2-", ""), festive: /PL2-251[0-2]/.test(l.lot_code),
  }));
  return (
    <section id="root-cause" className="scroll-mt-6">
      <SectionHead n="02" title="The real cause: festive Pulse 2 lots" sub={`Pulse 2 units made Oct–Dec 2025 were replaced on ${pct(K.festive_rate)} of tickets vs ${pct(K.base_rate)} for everything else — left-bud charging failure and pin corrosion.`} />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="border border-border rounded bg-card p-4">
          <p className="font-mono text-xs uppercase text-muted-foreground mb-2">Replacement rate by Pulse 2 lot</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={lots}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={50} />
              <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => pct(v)} />
              <ReferenceLine y={K.base_rate} stroke="var(--chart-2)" strokeDasharray="4 4" />
              <Bar dataKey="rate">{lots.map((l) => <Cell key={l.lot_code} fill={l.festive ? "var(--chart-1)" : "var(--chart-3)"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="border border-border rounded bg-card p-4">
          <p className="font-mono text-xs uppercase text-muted-foreground mb-2">Monthly CSAT vs tickets from festive lots</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.monthly}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="l" domain={[2.5, 4]} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line yAxisId="l" dataKey="csat" stroke="var(--chart-5)" dot={false} strokeWidth={2} name="CSAT" />
              <Line yAxisId="r" dataKey="festive" stroke="var(--chart-1)" dot={false} strokeWidth={2} name="Festive-lot tickets" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function BusinessCase() {
  const rows = [
    ["Excess replacements (festive lots above baseline)", `${K.excess_repl} units`],
    ["Policy cost per replacement (unit ₹1,480 + ₹340 logistics)", inr(K.policy_cost)],
    ["Fully loaded (+2 contacts × ₹290 + 1 transfer × ₹305)", inr(K.loaded_cost)],
    ["Excess spend — policy basis", inr(K.excess_policy_inr)],
    ["Excess spend — fully loaded", inr(K.excess_loaded_inr)],
    ["Late-first-reply store credits (₹350 each)", inr(K.breach_credit_inr)],
    ["Q3 training budget in question", inr(K.training_budget)],
  ];
  return (
    <section id="business-case" className="scroll-mt-6">
      <SectionHead n="03" title="Business goal, in rupees" sub="The measurable target the dashboard tracks." />
      <blockquote className="font-display text-2xl md:text-3xl leading-snug border-l-4 border-primary pl-6 max-w-4xl">
        Bring Pulse 2 replacement rate from {pct(K.festive_rate)} back to {pct(K.base_rate)} by next quarter — avoiding {inr(K.excess_policy_inr)} (policy) to {inr(K.excess_loaded_inr)} (fully loaded) of replacement cost, roughly {(K.excess_policy_inr / K.training_budget).toFixed(1)}× the training budget.
      </blockquote>
      <div className="mt-8 grid md:grid-cols-2 gap-8">
        <table className="text-sm w-full border border-border bg-card rounded">
          <tbody>{rows.map(([k, v]) => (
            <tr key={k} className="border-t border-border first:border-0"><td className="px-4 py-2">{k}</td><td className="px-4 py-2 font-mono text-right">{v}</td></tr>
          ))}</tbody>
        </table>
        <div className="text-sm space-y-3">
          <p className="font-medium">Recommended use of the ₹4,00,000</p>
          <p>• ₹2,50,000 — guided hardware intake (lot check + pin cleaning) before any replacement is issued.</p>
          <p>• ₹1,50,000 — lot quarantine & supplier recovery claim for PL2-2510 to PL2-2512.</p>
          <p>• Targeted coaching only for the {K.flagged} agents the fair model flags — no blanket retraining.</p>
          <p className="text-muted-foreground">Priya's ₹1,820 and Arjun's ₹2,500 reconcile: ₹1,820 is policy replacement cost; adding repeat contacts and a transfer gives {inr(K.loaded_cost)}.</p>
        </div>
      </div>
    </section>
  );
}

function knownNumbers(): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "number") out.push(v, v * 100);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(K);
  walk(data.agents.filter((a) => a.flag || a.tier === 2));
  out.push(1480, 340, 290, 305, 350, 2, 10, 1, 2025, 2026, 2510, 2512, 15, 95, 30);
  return out;
}

function verify(text: string) {
  const known = knownNumbers();
  const found = text.match(/\d[\d,]*\.?\d*/g) ?? [];
  return found.map((raw) => {
    const n = parseFloat(raw.replace(/,/g, ""));
    const ok = known.some((k) => Math.abs(k - n) <= Math.max(0.051, Math.abs(k) * 0.005));
    return { raw, ok };
  });
}

function Validation() {
  const brief = useServerFn(getBrief);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const facts = useMemo(
    () => JSON.stringify({ glossary: "festive_* = tickets on Pulse 2 (VA-EB-PL2) units from manufacturing lots PL2-2510 to PL2-2512 (Oct-Dec 2025), a hardware defect: left-bud charging failure / pin corrosion. base_* = all other tickets. rates are fractions (0.368 = 36.8%).", kpis: K, flagged_agents: data.agents.filter((a) => a.flag).map(({ id, name, team, csat, expected, shrunk, ci_hi }) => ({ id, name, team, csat, expected, shrunk, ci_hi })), tier2: data.agents.filter((a) => a.tier === 2).map(({ id, name, csat, expected, shrunk }) => ({ id, name, csat, expected, shrunk })) }),
    [],
  );
  const checks = useMemo(() => (text ? verify(text) : []), [text]);
  const bad = checks.filter((c) => !c.ok);
  async function run() {
    setLoading(true); setErr(null); setText("");
    try {
      const r = await brief({ data: { facts, focus: "Brief Priya Raman on where CSAT went and whether to retrain the bottom ten agents." } });
      if (r.error) setErr(r.error); else setText(r.text);
    } catch { setErr("Could not reach the AI service."); }
    setLoading(false);
  }
  return (
    <section id="validation" className="scroll-mt-6">
      <SectionHead n="04" title="Validation" sub="Data traps fixed before any metric is computed, and an AI brief that is checked against the computed figures." />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-3">
          {data.checks.map((c) => (
            <div key={c.check} className="border border-border rounded bg-card p-4 flex justify-between gap-4">
              <div><p className="font-medium text-sm">{c.check}</p><p className="text-xs text-muted-foreground">{c.unit}</p></div>
              <p className="font-mono text-sm whitespace-nowrap">{c.before.toLocaleString("en-IN")} → <span className="text-accent-foreground">{c.after}</span></p>
            </div>
          ))}
          <div className="border border-border rounded bg-card p-4 text-sm">
            <p className="font-medium">Fairness rules for a "coach" flag</p>
            <p className="text-muted-foreground mt-1">Tier 1 only (policy §6) · at least 30 surveys · gap vs queue expectation below −0.15 after shrinkage · entire 95% interval below zero.</p>
          </div>
        </div>
        <div className="border border-border rounded bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-xl">AI brief for Priya</p>
            <button onClick={run} disabled={loading} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm disabled:opacity-50">
              {loading ? "Writing…" : text ? "Regenerate" : "Generate brief"}
            </button>
          </div>
          {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
          {text && (
            <>
              <div className={`mt-4 text-xs font-mono px-3 py-2 rounded ${bad.length ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
                {bad.length ? `${bad.length} of ${checks.length} numbers NOT found in computed data: ${bad.map((b) => b.raw).join(", ")}` : `All ${checks.length} numbers match computed data`}
              </div>
              <div className="mt-4 text-sm whitespace-pre-wrap leading-relaxed">{text}</div>
            </>
          )}
          {!text && !err && !loading && <p className="mt-4 text-sm text-muted-foreground">The AI only sees the computed figures. Every number it writes is cross-checked here.</p>}
        </div>
      </div>
    </section>
  );
}
