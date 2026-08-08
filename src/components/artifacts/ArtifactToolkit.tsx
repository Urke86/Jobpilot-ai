import { useMemo, useState } from 'react';
import {
  Copy,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  ARTIFACT_TYPE_LABELS,
  artifactPreviewText,
  type ArtifactType,
} from '@/lib/ai/artifact-schemas';
import {
  getArtifactMetadata,
  requestArtifactGeneration,
  updateArtifactContent,
  type ApplicationArtifact,
} from '@/services';

const TOOLKIT_TOOLS: {
  type: ArtifactType;
  description: string;
  needsQuestion?: boolean;
  needsInstruction?: boolean;
  needsContact?: boolean;
  needsFollowUpMeta?: boolean;
}[] = [
  {
    type: 'cv_recommendations',
    description: 'How to adapt your CV for this role',
  },
  {
    type: 'cv_summary',
    description: 'Concise tailored summary (70–120 words)',
  },
  {
    type: 'cover_letter',
    description: 'Evidence-based modern cover letter',
  },
  {
    type: 'questionnaire_answer',
    description: 'Answer one application question',
    needsQuestion: true,
  },
  {
    type: 'linkedin_message',
    description: 'Short outreach to a hiring contact',
    needsContact: true,
  },
  {
    type: 'follow_up',
    description: 'Polite follow-up after applying',
    needsFollowUpMeta: true,
  },
  {
    type: 'interview_questions',
    description: 'Likely questions tied to gaps & strengths',
  },
  {
    type: 'interview_answers',
    description: 'Honest suggested answer to a question',
    needsQuestion: true,
  },
  {
    type: 'company_research',
    description: 'Summary from saved company/job data only',
  },
  {
    type: 'custom',
    description: 'Custom instruction under anti-fabrication rules',
    needsInstruction: true,
  },
];

function formatStructured(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function EditableResult({
  artifact,
  onSaved,
}: {
  artifact: ApplicationArtifact;
  onSaved: (next: ApplicationArtifact) => void;
}) {
  const meta = getArtifactMetadata(artifact);
  const [draft, setDraft] = useState(artifact.content);
  const [saving, setSaving] = useState(false);

  const structured = meta.result
    ? formatStructured(meta.result)
    : artifact.content;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft || structured);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const next = await updateArtifactContent(artifact.id, draft);
      onSaved(next);
      toast.success('Saved edits');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">v{artifact.version}</Badge>
        {meta.model ? <span>{meta.model}</span> : null}
        {meta.duration_ms != null ? <span>{meta.duration_ms}ms</span> : null}
        {meta.usage?.total_tokens != null ? (
          <span>{meta.usage.total_tokens} tokens</span>
        ) : null}
        {meta.estimated_cost_usd != null ? (
          <span>~${meta.estimated_cost_usd}</span>
        ) : null}
      </div>
      {meta.result && typeof meta.result === 'object' ? (
        <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
          {structured}
        </pre>
      ) : null}
      <div className="space-y-2">
        <Label>Editable content</Label>
        <Textarea
          className="min-h-[160px] resize-y font-sans text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={saving || draft === artifact.content}
        >
          {saving ? 'Saving…' : 'Save edits'}
        </Button>
      </div>
    </div>
  );
}

export function ArtifactToolkit({
  applicationId,
  artifacts,
  onChanged,
}: {
  applicationId: string;
  artifacts: ApplicationArtifact[];
  onChanged: () => void;
}) {
  const [openType, setOpenType] = useState<ArtifactType | null>(null);
  const [generating, setGenerating] = useState(false);
  const [question, setQuestion] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [userInstruction, setUserInstruction] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [daysSince, setDaysSince] = useState('');
  const [active, setActive] = useState<ApplicationArtifact | null>(null);
  const [historyType, setHistoryType] = useState<ArtifactType | null>(null);

  const tool = TOOLKIT_TOOLS.find((t) => t.type === openType) ?? null;

  const latestByType = useMemo(() => {
    const map = new Map<string, ApplicationArtifact>();
    for (const row of artifacts) {
      if (!map.has(row.artifact_type)) map.set(row.artifact_type, row);
    }
    return map;
  }, [artifacts]);

  const history = useMemo(() => {
    if (!historyType) return [];
    return artifacts
      .filter((a) => a.artifact_type === historyType)
      .sort((a, b) => b.version - a.version);
  }, [artifacts, historyType]);

  const resetForm = () => {
    setQuestion('');
    setUserNotes('');
    setUserInstruction('');
    setContactName('');
    setContactRole('');
    setDaysSince('');
  };

  const openTool = (type: ArtifactType) => {
    setOpenType(type);
    setHistoryType(type);
    setActive(latestByType.get(type) ?? null);
    resetForm();
  };

  const generate = async () => {
    if (!openType) return;
    setGenerating(true);
    try {
      const days =
        daysSince.trim() === '' ? undefined : Number(daysSince.trim());
      const { artifact } = await requestArtifactGeneration({
        applicationId,
        artifactType: openType,
        question: question || undefined,
        userNotes: userNotes || undefined,
        userInstruction: userInstruction || undefined,
        contactName: contactName || undefined,
        contactRole: contactRole || undefined,
        daysSinceApplication:
          days != null && !Number.isNaN(days) ? days : undefined,
      });
      setActive(artifact);
      setHistoryType(openType);
      toast.success(`${ARTIFACT_TYPE_LABELS[openType]} generated`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">AI Application Toolkit</CardTitle>
              <CardDescription>
                Generate versioned materials from your profile, CV, and job
                analysis
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {TOOLKIT_TOOLS.map((item) => {
              const latest = latestByType.get(item.type);
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => openTool(item.type)}
                  className="rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {ARTIFACT_TYPE_LABELS[item.type]}
                    </span>
                    {latest ? (
                      <Badge variant="secondary" className="text-[10px]">
                        v{latest.version}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={openType != null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenType(null);
            setActive(null);
            setGenerating(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {tool ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {ARTIFACT_TYPE_LABELS[tool.type]}
                </DialogTitle>
                <DialogDescription>{tool.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {tool.needsQuestion ? (
                  <div className="space-y-2">
                    <Label>Question</Label>
                    <Textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Paste the application or interview question…"
                      className="min-h-[80px]"
                    />
                  </div>
                ) : null}
                {tool.needsInstruction ? (
                  <div className="space-y-2">
                    <Label>Custom instruction</Label>
                    <Textarea
                      value={userInstruction}
                      onChange={(e) => setUserInstruction(e.target.value)}
                      placeholder="e.g. Draft a short salary expectation response…"
                      className="min-h-[80px]"
                    />
                  </div>
                ) : null}
                {tool.needsContact ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Contact name</Label>
                      <Input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact role</Label>
                      <Input
                        value={contactRole}
                        onChange={(e) => setContactRole(e.target.value)}
                        placeholder="e.g. Hiring manager"
                      />
                    </div>
                  </div>
                ) : null}
                {tool.needsFollowUpMeta ? (
                  <div className="space-y-2">
                    <Label>Days since application</Label>
                    <Input
                      type="number"
                      min={0}
                      value={daysSince}
                      onChange={(e) => setDaysSince(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                ) : null}
                {(tool.needsQuestion ||
                  tool.needsInstruction ||
                  tool.needsContact ||
                  tool.needsFollowUpMeta) && (
                  <div className="space-y-2">
                    <Label>Optional notes</Label>
                    <Textarea
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      placeholder="Extra context for this generation…"
                      className="min-h-[60px]"
                    />
                  </div>
                )}

                <DialogFooter className="gap-2 sm:justify-between">
                  <Button
                    type="button"
                    onClick={generate}
                    disabled={generating}
                    className="gap-1.5"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {active ? 'Regenerate' : 'Generate'}
                  </Button>
                </DialogFooter>

                <Separator />

                {generating && !active ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </div>
                ) : active ? (
                  <EditableResult
                    key={active.id}
                    artifact={active}
                    onSaved={(next) => {
                      setActive(next);
                      onChanged();
                    }}
                  />
                ) : (
                  <EmptyState
                    icon={Sparkles}
                    title="No version yet"
                    description="Generate to create the first version for this tool."
                    className="border-0 py-8"
                  />
                )}

                {history.length > 1 ? (
                  <div className="space-y-2">
                    <Label>Previous versions</Label>
                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {history.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          className={`w-full rounded-md border p-2 text-left text-xs ${
                            active?.id === row.id ? 'border-primary' : ''
                          }`}
                          onClick={() => setActive(row)}
                        >
                          <div className="mb-1 flex justify-between">
                            <span>v{row.version}</span>
                            <span className="text-muted-foreground">
                              {new Date(row.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-muted-foreground">
                            {artifactPreviewText(
                              row.artifact_type,
                              row.content,
                              getArtifactMetadata(row),
                            )}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
