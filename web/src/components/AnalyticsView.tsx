import React, { useState, useEffect } from 'react';
import { PieChart, TrendingUp, Users, Award, DollarSign } from 'lucide-react';

interface CategoryItem {
  category: string;
  total: number;
  percentage: number;
  count: number;
  color: string;
}

interface MemberStat {
  memberId: string;
  name: string;
  avatarColor?: string;
  totalPaid: number;
  totalConsumed: number;
  net: number;
}

interface AnalyticsData {
  totalSpend: number;
  expenseCount: number;
  averageCostPerPerson: number;
  topSpender: { name: string; amount: number } | null;
  topCategory: { category: string; total: number } | null;
  categories: CategoryItem[];
  memberStats: MemberStat[];
}

interface AnalyticsViewProps {
  groupId: string;
  currency: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ groupId, currency }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/analytics`)
      .then((res) => res.json())
      .then((d) => {
        if (d.analytics) setData(d.analytics);
      })
      .catch((err) => console.error('Error fetching analytics:', err))
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-3" />
        Calculating spending insights...
      </div>
    );
  }

  if (!data || data.expenseCount === 0) {
    return (
      <div className="text-center py-14 px-4 rounded-3xl glass-card border border-slate-800">
        <PieChart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-slate-300">No spending data yet</h4>
        <p className="text-xs text-slate-500 mt-1">
          Add expenses to see automated charts, category breakdowns, and member comparisons.
        </p>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : `${currency} `;
    return `${symbol}${val.toFixed(2)}`;
  };

  // Compute SVG Donut Chart Paths
  let cumulativePercent = 0;
  const donutSlices = data.categories.map((cat) => {
    const startAngle = cumulativePercent * 3.6; // 360 / 100
    cumulativePercent += cat.percentage;
    const endAngle = cumulativePercent * 3.6;

    // Convert polar to cartesian
    const radius = 40;
    const center = 50;
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArcFlag = cat.percentage > 50 ? 1 : 0;
    const d =
      cat.percentage >= 99.9
        ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius} Z`
        : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    return { ...cat, path: d };
  });

  return (
    <div className="space-y-4">
      {/* 3 Metric Highlight Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl glass-card border border-slate-800">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-semibold uppercase">
            <DollarSign className="w-3.5 h-3.5 text-blue-400" />
            <span>Avg / Member</span>
          </div>
          <div className="text-xl font-extrabold text-slate-100 mt-1">
            {formatCurrency(data.averageCostPerPerson)}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl glass-card border border-slate-800">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-semibold uppercase">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Top Spender</span>
          </div>
          <div className="text-xl font-extrabold text-slate-100 mt-1 truncate">
            {data.topSpender ? data.topSpender.name : 'N/A'}
          </div>
          {data.topSpender && (
            <div className="text-[11px] text-slate-400 mt-0.5">
              {formatCurrency(data.topSpender.amount)} paid
            </div>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl glass-card border border-slate-800">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-semibold uppercase">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Total Budget</span>
          </div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">
            {formatCurrency(data.totalSpend)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{data.expenseCount} logged bills</div>
        </div>
      </div>

      {/* Category Breakdown with Donut Chart */}
      <div className="p-5 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Category Breakdown
          </h3>
          <span className="text-xs text-slate-400">{data.categories.length} categories</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* SVG Donut Chart */}
          <div className="relative w-36 h-36 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              {donutSlices.map((slice, i) => (
                <path
                  key={i}
                  d={slice.path}
                  fill={slice.color}
                  className="transition-all hover:opacity-80"
                />
              ))}
              {/* Inner cutout circle to make it a donut */}
              <circle cx="50" cy="50" r="26" fill="#090d16" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-slate-400">Total</span>
              <span className="text-xs font-bold text-slate-200">
                {currency === 'EUR' ? '€' : ''}
                {Math.round(data.totalSpend)}
              </span>
            </div>
          </div>

          {/* Legend Items */}
          <div className="flex-1 w-full space-y-2">
            {data.categories.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="capitalize text-slate-300 font-medium">{cat.category}</span>
                </div>
                <div className="flex items-center space-x-3 text-right">
                  <span className="text-slate-400 font-mono">{cat.percentage}%</span>
                  <span className="text-slate-200 font-semibold w-16 text-right">
                    {formatCurrency(cat.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Member Comparison: Paid vs Consumed */}
      <div className="p-5 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Member Comparison (Paid vs Consumed)</span>
          </h3>
        </div>

        <div className="space-y-3">
          {data.memberStats.map((stat) => {
            const maxVal = Math.max(...data.memberStats.map((s) => Math.max(s.totalPaid, s.totalConsumed)), 1);
            const paidWidth = Math.min(100, Math.round((stat.totalPaid / maxVal) * 100));
            const consumedWidth = Math.min(100, Math.round((stat.totalConsumed / maxVal) * 100));

            return (
              <div key={stat.memberId} className="space-y-1 p-2.5 rounded-2xl bg-slate-950/60 border border-slate-900">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white"
                      style={{ backgroundColor: stat.avatarColor || '#3B82F6' }}
                    >
                      {stat.name.slice(0, 1)}
                    </span>
                    <span className="font-semibold text-slate-200">{stat.name}</span>
                  </div>

                  {/* Net Balance Pill */}
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      stat.net > 0
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : stat.net < 0
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {stat.net > 0 ? `+${formatCurrency(stat.net)}` : formatCurrency(stat.net)}
                  </span>
                </div>

                {/* Progress bars: Blue for Paid, Purple for Consumed */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center text-[10px] text-slate-400">
                    <span className="w-16">Paid:</span>
                    <div className="flex-1 bg-slate-900 rounded-full h-1.5 overflow-hidden mr-2">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${paidWidth}%` }} />
                    </div>
                    <span className="w-14 text-right font-medium text-slate-200">
                      {formatCurrency(stat.totalPaid)}
                    </span>
                  </div>

                  <div className="flex items-center text-[10px] text-slate-400">
                    <span className="w-16">Share:</span>
                    <div className="flex-1 bg-slate-900 rounded-full h-1.5 overflow-hidden mr-2">
                      <div className="bg-purple-500 h-full rounded-full" style={{ width: `${consumedWidth}%` }} />
                    </div>
                    <span className="w-14 text-right font-medium text-slate-200">
                      {formatCurrency(stat.totalConsumed)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
