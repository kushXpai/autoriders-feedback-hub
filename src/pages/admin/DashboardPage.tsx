import { useState, useMemo } from 'react';
import { Users, CheckCircle2, TrendingUp, Award, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { quarterKpiData, recentActivity } from '@/data/mockData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const orderedQuarters = [
  { id: 'q3-2024', label: 'Q3 2024' },
  { id: 'q4-2024', label: 'Q4 2024' },
  { id: 'q1-2025', label: 'Q1 2025' },
  { id: 'q2-2025', label: 'Q2 2025' },
  { id: 'q3-2025', label: 'Q3 2025' },
  { id: 'q4-2025', label: 'Q4 2025' },
  { id: 'q1-2026', label: 'Q1 2026' },
];

const availableQuarters = [...orderedQuarters].reverse();

function getDefaultQuarter(): string {
  // Current date is March 2026 → latest completed quarter is Q4 2025
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let qNum: number;
  let qYear: number;
  if (month <= 3) {
    qNum = 4;
    qYear = year - 1;
  } else if (month <= 6) {
    qNum = 1;
    qYear = year;
  } else if (month <= 9) {
    qNum = 2;
    qYear = year;
  } else {
    qNum = 3;
    qYear = year;
  }
  return `q${qNum}-${qYear}`;
}

export default function DashboardPage() {
  const [selectedQuarter, setSelectedQuarter] = useState(getDefaultQuarter);
  const [trendMetric, setTrendMetric] = useState<'satisfaction' | 'serviceInitiation' | 'serviceDelivery' | 'driverQuality'>('satisfaction');
  const data = quarterKpiData[selectedQuarter] ?? quarterKpiData['q4-2025'];
  const metrics = data.metrics;
  const kpi = data.kpi;
  const quarterLabel = availableQuarters.find(q => q.id === selectedQuarter)?.label ?? selectedQuarter;

  // Previous quarter for comparison
  const prevQuarter = useMemo(() => {
    const idx = orderedQuarters.findIndex(q => q.id === selectedQuarter);
    if (idx > 0) return quarterKpiData[orderedQuarters[idx - 1].id] ?? null;
    return null;
  }, [selectedQuarter]);
  const prevMetrics = prevQuarter?.metrics ?? null;

  function delta(current: number, previous: number | undefined | null): { value: string; positive: boolean } | null {
    if (previous == null) return null;
    const diff = current - previous;
    if (diff === 0) return null;
    const sign = diff > 0 ? '+' : '';
    return { value: `${sign}${diff % 1 === 0 ? diff : diff.toFixed(1)}`, positive: diff > 0 };
  }

  const responseRatePct = (m: typeof metrics) => (m.currentQuarterResponded / m.currentQuarterTotal) * 100;

  const metricCards = [
    { label: 'Active Customers', value: metrics.totalActiveCustomers, icon: Users, color: 'text-primary', bg: 'bg-primary/10', change: delta(metrics.totalActiveCustomers, prevMetrics?.totalActiveCustomers) },
    { label: 'Response Rate', value: `${metrics.currentQuarterResponded}/${metrics.currentQuarterTotal}`, icon: CheckCircle2, color: 'text-accent', bg: 'bg-accent/10', sub: `${responseRatePct(metrics).toFixed(0)}%`, change: prevMetrics ? delta(Math.round(responseRatePct(metrics)), Math.round(responseRatePct(prevMetrics))) : null },
    { label: 'Overall Satisfaction', value: `${metrics.overallSatisfaction}%`, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10', change: prevMetrics ? delta(metrics.overallSatisfaction, prevMetrics.overallSatisfaction) : null },
    { label: 'Incentive Status', value: metrics.incentiveApplies ? 'Eligible' : metrics.penaltyApplies ? 'Penalty' : 'Neutral', icon: Award, color: metrics.incentiveApplies ? 'text-accent' : metrics.penaltyApplies ? 'text-destructive' : 'text-muted-foreground', bg: metrics.incentiveApplies ? 'bg-accent/10' : metrics.penaltyApplies ? 'bg-destructive/10' : 'bg-muted', change: null },
  ];

  const kpiCards = [
    { label: 'Service Initiation', pct: kpi.serviceInitiation.pct, avg: kpi.serviceInitiation.avg },
    { label: 'Service Delivery', pct: kpi.serviceDelivery.pct, avg: kpi.serviceDelivery.avg },
    { label: 'Driver Quality', pct: kpi.driverQuality.pct, avg: kpi.driverQuality.avg },
    { label: 'Overall Service', pct: kpi.overallService.pct, avg: kpi.overallService.avg },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{quarterLabel} performance overview</p>
        </div>
        <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableQuarters.map(q => (
              <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metric cards */}
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
                  card.change.positive
                    ? 'text-accent bg-accent/10'
                    : 'text-destructive bg-destructive/10'
                )}>
                  {card.change.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {card.change.value}
                </span>
              ) : (
                <ArrowUpRight className="w-4 h-4 text-muted-foreground/40" />
              )}
            </div>
            <div className="mt-4">
              <p className="text-2xl font-semibold text-foreground tabular-nums">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
              {card.sub && <p className="text-xs text-muted-foreground mt-0.5">({card.sub} completion)</p>}
            </div>
          </div>
        ))}
      </div>

      {/* KPI Section */}
      <div
        className="bg-card rounded-xl border border-border p-6 animate-fade-in-up"
        style={{ animationDelay: '320ms', animationFillMode: 'both' }}
      >
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">{quarterLabel} KPI Breakdown</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(kpi => (
            <div key={kpi.label} className="bg-secondary/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground font-medium mb-2">{kpi.label}</p>
              <p className="text-2xl font-semibold text-foreground tabular-nums">{kpi.pct}%</p>
              <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-700"
                  style={{ width: `${kpi.pct}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">Avg score: {kpi.avg}/4.00</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trend + Recent — side by side on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div
          className="xl:col-span-2 bg-card rounded-xl border border-border p-6 animate-fade-in-up"
          style={{ animationDelay: '360ms', animationFillMode: 'both' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-foreground">Performance Trend Since Inception</h2>
            <div className="flex gap-1 flex-wrap">
              {([
                { key: 'satisfaction', label: 'Overall' },
                { key: 'serviceInitiation', label: 'Initiation' },
                { key: 'serviceDelivery', label: 'Delivery' },
                { key: 'driverQuality', label: 'Driver' },
              ] as const).map(opt => (
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
            <LineChart
              data={orderedQuarters.map(q => {
                const d = quarterKpiData[q.id];
                if (!d) return { quarter: q.label, value: null };
                const val = trendMetric === 'satisfaction'
                  ? d.metrics.overallSatisfaction
                  : d.kpi[trendMetric].pct;
                return { quarter: q.label, value: val };
              })}
              margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="quarter"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[70, 100]}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
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
                formatter={(value: number) => [`${value}%`, trendMetric === 'satisfaction' ? 'Satisfaction' : 'Score']}
              />
              <ReferenceLine y={85} stroke="hsl(var(--accent))" strokeDasharray="4 4" strokeOpacity={0.5} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                activeDot={{ r: 6, fill: 'hsl(var(--accent))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Dashed line indicates 85% incentive threshold</p>
        </div>

        <div
          className="bg-card rounded-xl border border-border p-6 animate-fade-in-up"
          style={{ animationDelay: '400ms', animationFillMode: 'both' }}
        >
          <h2 className="text-sm font-semibold text-foreground mb-4">Recent Submissions</h2>
          <div className="space-y-3">
            {recentActivity.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-secondary/50 transition-colors"
              >
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
                  {item.timeAgo}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
