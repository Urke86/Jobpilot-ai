import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { EmptyState, LoadingState } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import {
  EVAL_DIMENSION_LABELS,
  EVAL_DIMENSIONS,
  type EvalDimension,
} from '@/lib/ai/prompt-registry';
import {
  acknowledgeAiAlert,
  getAiAnalyticsSummary,
  listAiAlerts,
  listAiGenerations,
  listPromptVersions,
  recordManualAiFailure,
  refreshSoftAlerts,
  submitAiEvaluation,
  type AiGenerationRow,
} from '@/services';

function usd(n: number): string {
  if (n < 0.01 && n > 0) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function AiAnalyticsPanel() {
  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useResource(getAiAnalyticsSummary, []);
  const {
    data: alerts,
    refetch: refetchAlerts,
  } = useResource(() => listAiAlerts(false), []);
  const { data: prompts, refetch: refetchPrompts } = useResource(
    listPromptVersions,
    [],
  );
  const { data: generations, refetch: refetchGens } = useResource(
    () => listAiGenerations(30),
    [],
  );

  const [busy, setBusy] = useState(false);
  const [evalGenId, setEvalGenId] = useState('');
  const [evalScores, setEvalScores] = useState<
    Partial<Record<EvalDimension, number>>
  >({});
  const [evalNote, setEvalNote] = useState('');

  const successGens = useMemo(
    () => (generations ?? []).filter((g) => g.status === 'success'),
    [generations],
  );

  const refreshAll = async () => {
    setBusy(true);
    try {
      if (summary) await refreshSoftAlerts(summary);
      refetch();
      refetchAlerts();
      refetchPrompts();
      refetchGens();
      toast.success('Analytics refreshed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setBusy(false);
    }
  };

  const simulateFailure = async () => {
    setBusy(true);
    try {
      await recordManualAiFailure({
        feature: 'assistant',
        errorCode: 'qa_simulated',
        errorMessage: 'Simulated provider failure (Phase 4E FLOW F)',
      });
      const next = await getAiAnalyticsSummary();
      await refreshSoftAlerts(next);
      refetch();
      refetchAlerts();
      refetchGens();
      toast.success('Simulated failure recorded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const submitEval = async () => {
    if (!evalGenId) {
      toast.error('Select a generation to evaluate');
      return;
    }
    setBusy(true);
    try {
      await submitAiEvaluation({
        generationId: evalGenId,
        scores: evalScores,
        explanation: evalNote || undefined,
      });
      toast.success('Evaluation saved');
      setEvalNote('');
      setEvalScores({});
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Eval failed');
    } finally {
      setBusy(false);
    }
  };

  const ack = async (id: string) => {
    try {
      await acknowledgeAiAlert(id);
      refetchAlerts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (isLoading) return <LoadingState label="Loading AI analytics…" />;
  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load AI analytics"
        description={error.message}
      />
    );
  }
  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Spend, latency, models, prompt versions, evaluations, and soft
            alerts. Tokens and secrets never appear here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void simulateFailure()}
          >
            Simulate failure
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void refreshAll()}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {(alerts ?? []).length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">Soft alerts</CardTitle>
            <CardDescription>
              In-app only — no email/Slack yet. Acknowledge after review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(alerts ?? []).map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{a.severity}</Badge>
                    <span className="font-medium">{a.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.message}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void ack(a.id)}
                >
                  <Check className="h-4 w-4" />
                  Ack
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {summary.regressionWarnings.length > 0 && (
        <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium mb-2">Regression warnings</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            {summary.regressionWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total spend" value={usd(summary.totalSpend)} />
        <MetricCard title="Monthly spend" value={usd(summary.monthlySpend)} />
        <MetricCard
          title="Generations"
          value={String(summary.totalGenerations)}
          hint={`${summary.successRate.toFixed(0)}% success`}
        />
        <MetricCard
          title="Avg latency"
          value={`${Math.round(summary.avgLatencyMs)} ms`}
          hint={`p95 ${Math.round(summary.p95LatencyMs)} ms`}
        />
        <MetricCard
          title="Most expensive feature"
          value={summary.mostExpensiveFeature ?? '—'}
        />
        <MetricCard
          title="Most used model"
          value={summary.mostUsedModel ?? '—'}
        />
        <MetricCard
          title="Avg tokens (in/out)"
          value={`${Math.round(summary.avgInputTokens)} / ${Math.round(summary.avgOutputTokens)}`}
        />
        <MetricCard
          title="Avg eval score"
          value={
            summary.avgEvalScore != null
              ? `${summary.avgEvalScore.toFixed(1)} / 5`
              : '—'
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spend over time</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="spend"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latency over time</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="latency_ms"
                  stroke="hsl(var(--chart-2, 173 58% 39%))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature usage</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.spendByFeature.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="key" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Model usage</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.spendByModel}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-3, 197 37% 24%))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent failures</CardTitle>
            <CardDescription>
              Validation, provider, and rate-limit errors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {summary.recentFailures.length === 0 ? (
              <p className="text-muted-foreground">No failures recorded.</p>
            ) : (
              summary.recentFailures.map((g) => (
                <FailureRow key={g.id} row={g} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evaluate a generation</CardTitle>
            <CardDescription>Scores 1–5 across quality dimensions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Generation</Label>
              <Select value={evalGenId} onValueChange={setEvalGenId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select successful generation" />
                </SelectTrigger>
                <SelectContent>
                  {successGens.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.feature} · {g.model ?? '—'} ·{' '}
                      {new Date(g.created_at).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EVAL_DIMENSIONS.map((dim) => (
                <div key={dim} className="space-y-1">
                  <Label className="text-xs">{EVAL_DIMENSION_LABELS[dim]}</Label>
                  <Select
                    value={
                      evalScores[dim] != null ? String(evalScores[dim]) : ''
                    }
                    onValueChange={(v) =>
                      setEvalScores((prev) => ({
                        ...prev,
                        [dim]: Number(v),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Textarea
              placeholder="Optional explanation"
              value={evalNote}
              onChange={(e) => setEvalNote(e.target.value)}
            />
            <Button disabled={busy} onClick={() => void submitEval()}>
              Submit evaluation
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prompt registry</CardTitle>
          <CardDescription>
            Historical versions are append-only — never overwritten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Feature</th>
                  <th className="py-2 pr-3">Version</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {(prompts ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{p.feature}</td>
                    <td className="py-2 pr-3 tabular-nums">{p.version}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {p.description}
                    </td>
                    <td className="py-2">
                      {p.is_active ? (
                        <Badge>active</Badge>
                      ) : (
                        <Badge variant="secondary">retired</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FailureRow({ row }: { row: AiGenerationRow }) {
  return (
    <div className="rounded-md border p-2">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{row.feature}</Badge>
        <Badge variant="destructive">{row.status}</Badge>
        {row.error_code ? (
          <span className="text-xs text-muted-foreground">{row.error_code}</span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {row.error_message || 'No message'} ·{' '}
        {new Date(row.created_at).toLocaleString()}
      </p>
    </div>
  );
}
