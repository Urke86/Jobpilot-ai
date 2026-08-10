import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '@/components/common';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface TooltipPayload {
  name?: string;
  value?: number;
  payload?: { name: string; count: number };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-sm font-medium text-foreground">
        {label ?? payload[0].payload?.name}
      </p>
      <p className="text-sm text-muted-foreground">
        {payload[0].value}{' '}
        {payload[0].value === 1 ? 'item' : 'items'}
      </p>
    </div>
  );
}

const pipelineColors = [
  'hsl(217, 91%, 60%)',
  'hsl(217, 91%, 53%)',
  'hsl(200, 80%, 50%)',
  'hsl(45, 93%, 47%)',
  'hsl(160, 70%, 40%)',
  'hsl(280, 65%, 55%)',
  'hsl(0, 72%, 55%)',
  'hsl(220, 10%, 50%)',
];

export default function DashboardCharts({
  jobsBySource,
  applicationsByStatus,
}: {
  jobsBySource: { name: string; count: number }[];
  applicationsByStatus: { name: string; count: number }[];
}) {
  const hasSourceData = jobsBySource.some((row) => row.count > 0);
  const hasPipelineData = applicationsByStatus.some((row) => row.count > 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jobs by Source</CardTitle>
          <CardDescription>
            Where your opportunities are coming from
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasSourceData ? (
            <EmptyState
              title="No source data yet"
              description="Add jobs with a source to see this chart."
              className="border-0 py-10"
            />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={jobsBySource}
                  layout="vertical"
                  margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
                  barCategoryGap="20%"
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={100}
                    tick={{
                      fontSize: 13,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(217, 91%, 53%)"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application Pipeline</CardTitle>
          <CardDescription>
            Current status of all your applications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasPipelineData ? (
            <EmptyState
              title="No applications yet"
              description="Start an application from a job to populate this chart."
              className="border-0 py-10"
            />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={applicationsByStatus}
                  margin={{ top: 0, right: 8, bottom: 0, left: -16 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 12,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tick={{
                      fontSize: 12,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {applicationsByStatus.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={pipelineColors[index % pipelineColors.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
