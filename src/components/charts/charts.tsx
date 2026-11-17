"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export interface Series {
  key: string;
  label: string;
  /** Categorical slot 1–3, assigned in fixed order. */
  slot?: 1 | 2 | 3;
}

const axisTick = { fontSize: 11, fill: "var(--chart-axis)" };

function ChartTooltip({ active, payload, label, unit, series }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; unit?: string; series: Series[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 rounded-sm" style={{ background: `var(--chart-${s?.slot ?? 1})` }} />
            {s?.label}: <span className="font-medium tabular-nums text-foreground">{p.value}{unit}</span>
          </p>
        );
      })}
    </div>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm" style={{ background: `var(--chart-${s.slot ?? 1})` }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function ChartCard<T extends Record<string, string | number>>({
  title,
  description,
  data,
  xKey,
  series,
  type = "bar",
  unit = "",
  yMax,
  height = 240,
  emptyText = "No data yet",
}: {
  title: string;
  description?: string;
  data: T[];
  xKey: keyof T & string;
  series: Series[];
  type?: "bar" | "line";
  unit?: string;
  yMax?: number;
  height?: number;
  emptyText?: string;
}) {
  const [tableView, setTableView] = useState(false);
  const minValue = Math.min(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const yDomain: [number, number | "auto"] = [minValue < 0 ? Math.floor(minValue) : 0, yMax ?? "auto"];
  const isEmpty = !data.length || data.every((d) => series.every((s) => !Number(d[s.key])));
  return (
    <Card>
      <CardHeader className="items-center">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex items-center gap-3">
          <Legend series={series} />
          {!isEmpty && (
            <Button variant="ghost" size="icon-sm" onClick={() => setTableView((v) => !v)} aria-label={tableView ? "Show chart" : "Show data table"} title={tableView ? "Chart view" : "Table view"}>
              {tableView ? <BarChart3 /> : <Table2 />}
            </Button>
          )}
        </div>
      </CardHeader>
      {isEmpty ? (
        <EmptyState icon={BarChart3} title={emptyText} description="This chart fills in as students complete exams." className="py-10" />
      ) : tableView ? (
        <div className="max-h-[280px] overflow-y-auto">
          <Table>
            <THead><TR><TH>{xKey}</TH>{series.map((s) => <TH key={s.key} className="text-right">{s.label}</TH>)}</TR></THead>
            <TBody>{data.map((d, i) => <TR key={i}><TD>{String(d[xKey])}</TD>{series.map((s) => <TD key={s.key} className="text-right tabular-nums">{d[s.key]}{unit}</TD>)}</TR>)}</TBody>
          </Table>
        </div>
      ) : (
        <CardContent className="pt-4">
          <div style={{ height }} role="img" aria-label={`${title} chart`}>
            <ResponsiveContainer width="100%" height="100%">
              {type === "bar" ? (
                <BarChart data={data as Record<string, string | number>[]} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={2} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey={xKey as string} tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} interval="preserveStartEnd" />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} domain={yDomain} />
                  <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltip unit={unit} series={series} />} />
                  {minValue < 0 && <ReferenceLine y={0} stroke="var(--chart-axis)" />}
                  {series.map((s) => (
                    <Bar key={s.key} dataKey={s.key} fill={`var(--chart-${s.slot ?? 1})`} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={data as Record<string, string | number>[]} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey={xKey as string} tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} minTickGap={24} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} domain={yDomain} />
                  <Tooltip cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} content={<ChartTooltip unit={unit} series={series} />} />
                  {series.map((s) => (
                    <Line key={s.key} type="monotone" dataKey={s.key} stroke={`var(--chart-${s.slot ?? 1})`} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
