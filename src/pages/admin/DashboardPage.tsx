// src/pages/admin/DashboardPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { Users, CheckCircle2, TrendingUp, Award, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { supabase } from '@/supabase/client';
import type { DashboardMetric, QuarterReport, Quarter, FeedbackAssignment, Customer } from '@/types/database.types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

type TrendMetric = 'satisfaction' | 'si' | 'sd' | 'dq';

interface RecentItem {
  id: number;
  customerName: string;
  quarter: string;
  submittedAt: string;
}

function getDefaultQuarter(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month <= 3) return `q4-${year - 1}`;
  if (month <= 6) return `q1-${year}`;
  if (month <= 9) return `q2-${year}`;
  return `q3-${year}`;
}

export default function DashboardPage() {
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState(getDefaultQuarter);
  const [metrics, setMetrics] = useState<DashboardMetric | null>(null);
  const [prevMetrics, setPrevMetrics] = useState<DashboardMetric | null>(null);
  const [reports, setReports] = useState<QuarterReport[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('satisfaction');
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Load all quarters once
  useEffect(() => {
    supabase
      .from('quarters')
      .select('*')
      .order('year', { ascending: true })
      .then(({ data }) => {
        if (data) setQuarters(data);
      });
  }, []);

  // Load all quarter reports for trend chart
  useEffect(() => {
    supabase
      .from('quarter_reports')
      .select('*')
      .then(({ data }) => {
        if (data) setReports(data);
      });
  }, []);

  // Load dashboard metrics for selected quarter + previous quarter
  useEffect(() => {
    setLoadingMetrics(true);
    const fetchMetrics = async () => {
      const { data } = await supabase
        .from('dashboard_metrics')
        .select('*')
        .eq('quarter_id', selectedQuarter)
        .single();
      setMetrics(data ?? null);

      // Find previous quarter
      const orderedIds = quarters
        .slice()
        .sort((a, b) => a.year * 10 + a.quarter_number - (b.year * 10 + b.quarter_number))
        .map(q => q.id);
      const idx = orderedIds.indexOf(selectedQuarter);
      if (idx > 0) {
        const { data: prev } = await supabase
          .from('dashboard_metrics')
          .select('*')
          .eq('quarter_id', orderedIds[idx - 1])
          .single();
        setPrevMetrics(prev ?? null);
      } else {
        setPrevMetrics(null);
      }

      setLoadingMetrics(false);
    };
    if (quarters.length > 0) fetchMetrics();
  }, [selectedQuarter, quarters]);

  // Load recent submitted assignments
  useEffect(() => {
    const fetchRecent = async () => {
      const { data: assignments } = await supabase
        .from('feedback_assignments')
        .select('id, customer_id, quarter_id, submitted_at')
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(6) as { data: (FeedbackAssignment & { submitted_at: string })[] | null };

      if (!assignments?.length) return;

      const customerIds = [...new Set(assignments.map(a => a.customer_id))];
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds) as { data: Pick<Customer, 'id' | 'name'>[] | null };

      const customerMap = Object.fromEntries((customers ?? []).map(c => [c.id, c.name]));
      const quarterMap = Object.fromEntries(quarters.map(q => [q.id, q.label]));

      setRecentItems(
        assignments.map(a => ({
          id: a.id,
          customerName: customerMap[a.customer_id] ?? 'Unknown',
          quarter: quarterMap[a.quarter_id] ?? a.quarter_id,
          submittedAt: a.submitted_at,
        }))
      );
    };
    if (quarters.length > 0) fetchRecent();
  }, [quarters]);

  const orderedQuarters = useMemo(
    () =>
      quarters
        .slice()
        .sort((a, b) => a.year * 10 + a.quarter_number - (b.year * 10 + b.quarter_number)),
    [quarters]
  );

  const availableQuarters = useMemo(() => [...orderedQuarters].reverse(), [orderedQuarters]);
  const quarterLabel = quarters.find(q => q.id === selectedQuarter)?.label ?? selectedQuarter;

  function delta(current: number, previous: number | null | undefined) {
    if (previous == null) return null;
    const diff = current - previous;
    if (diff === 0) return null;
    return { value: `${diff > 0 ? '+' : ''}${Number.isInteger(diff) ? diff : diff.toFixed(1)}`, positive: diff > 0 };
  }

  const responseRatePct = (m: DashboardMetric) =>
    m.current_quarter_total > 0
      ? (m.current_quarter_responded / m.current_quarter_total) * 100
      : 0;

  const metricCards = metrics
    ? [
        {
          label: 'Active Customers',
          value: metrics.total_active_customers,
          icon: Users,
          color: 'text-primary',
          bg: 'bg-primary/10',
          change: delta(metrics.total_active_customers, prevMetrics?.total_active_customers),
        },
        {
          label: 'Response Rate',
          value: `${metrics.current_quarter_responded}/${metrics.current_quarter_total}`,
          icon: CheckCircle2,
          color: 'text-accent',
          bg: 'bg-accent/10',
          sub: `${responseRatePct(metrics).toFixed(0)}%`,
          change: prevMetrics
            ? delta(Math.round(responseRatePct(metrics)), Math.round(responseRatePct(prevMetrics)))
            : null,
        },
        {
          label: 'Overall Satisfaction',
          value: `${Number(metrics.overall_satisfaction).toFixed(1)}%`,
          icon: TrendingUp,
          color: 'text-primary',
          bg: 'bg-primary/10',
          change: prevMetrics
            ? delta(Number(metrics.overall_satisfaction), Number(prevMetrics.overall_satisfaction))
            : null,
        },
        {
          label: 'Incentive Status',
          value: metrics.incentive_applies ? 'Eligible' : metrics.penalty_applies ? 'Penalty' : 'Neutral',
          icon: Award,
          color: metrics.incentive_applies
            ? 'text-accent'
            : metrics.penalty_applies
            ? 'text-destructive'
            : 'text-muted-foreground',
          bg: metrics.incentive_applies
            ? 'bg-accent/10'
            : metrics.penalty_applies
            ? 'bg-destructive/10'
            : 'bg-muted',
          change: null,
        },
      ]
    : [];

  const kpiCards = metrics
    ? [
        { label: 'Service Initiation', pct: Number(metrics.si_pct), avg: Number(metrics.si_avg) },
        { label: 'Service Delivery', pct: Number(metrics.sd_pct), avg: Number(metrics.sd_avg) },
        { label: 'Driver Quality', pct: Number(metrics.dq_pct), avg: Number(metrics.dq_avg) },
        { label: 'Overall Service', pct: Number(metrics.os_pct), avg: Number(metrics.os_avg) },
      ]
    : [];

  const reportMap = useMemo(
    () => Object.fromEntries(reports.map(r => [r.quarter_id, r])),
    [reports]
  );

  const trendData = orderedQuarters.map(q => {
    const r = reportMap[q.id];
    if (!r) return { quarter: q.label, value: null };
    const value =
      trendMetric === 'satisfaction'
        ? Number(r.overall_pct)
        : trendMetric === 'si'
        ? Number(r.si_pct)
        : trendMetric === 'sd'
        ? Number(r.sd_pct)
        : Number(r.dq_pct);
    return { quarter: q.label, value };
  });

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  if (loadingMetrics && !metrics) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{quarterLabel} performance overview</p>
        </div>
        <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableQuarters.map(q => (
              <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metric cards */}
      {metrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map((card, i) => (
            <div
              key={card.label}
              className="bg-card rounded-xl border border-border p-5 animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-start justify-between">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', card.bg)}>
                  <card.icon className={cn('w-5 h-5', card.color)} />
                </div>
                {card.change ? (
                  <span className={cn(
                    'flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md',
                    card.change.positive ? 'text-accent bg-accent/10' : 'text-destructive bg-destructive/10'
                  )}>
                    {card.change.positive
                      ? <ArrowUpRight className="w-3 h-3" />
                      : <ArrowDownRight className="w-3 h-3" />}
                    {card.change.value}
                  </span>
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground/40" />
                )}
              </div>
              <div className="mt-4">
                <p className="text-2xl font-semibold text-foreground tabular-nums">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                {'sub' in card && card.sub && (
                  <p className="text-xs text-muted-foreground mt-0.5">({card.sub} completion)</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          No metrics available for {quarterLabel}.
        </div>
      )}

      {/* KPI breakdown */}
      {metrics && (
        <div className="bg-card rounded-xl border border-border p-6 animate-fade-in-up"
          style={{ animationDelay: '320ms', animationFillMode: 'both' }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">{quarterLabel} KPI Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map(kpi => (
              <div key={kpi.label} className="bg-secondary/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground font-medium mb-2">{kpi.label}</p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{kpi.pct.toFixed(1)}%</p>
                <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700"
                    style={{ width: `${kpi.pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Avg score: {kpi.avg.toFixed(2)}/4.00</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend + Recent */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-card rounded-xl border border-border p-6 animate-fade-in-up"
          style={{ animationDelay: '360ms', animationFillMode: 'both' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-foreground">Performance Trend Since Inception</h2>
            <div className="flex gap-1 flex-wrap">
              {([
                { key: 'satisfaction' as TrendMetric, label: 'Overall' },
                { key: 'si' as TrendMetric, label: 'Initiation' },
                { key: 'sd' as TrendMetric, label: 'Delivery' },
                { key: 'dq' as TrendMetric, label: 'Driver' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setTrendMetric(opt.key)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors active:scale-95',
                    trendMetric === opt.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  domain={[60, 100]}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Score']}
                />
                <ReferenceLine y={85} stroke="hsl(var(--accent))" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                  activeDot={{ r: 6, fill: 'hsl(var(--accent))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Dashed line indicates 85% incentive threshold</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 animate-fade-in-up"
          style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">Recent Submissions</h2>
          <div className="space-y-3">
            {recentItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent submissions.</p>
            ) : (
              recentItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {item.customerName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.customerName}</p>
                      <p className="text-xs text-muted-foreground">{item.quarter}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {timeAgo(item.submittedAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}