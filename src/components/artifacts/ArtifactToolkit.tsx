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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

function formatGenerationMeta(artifact: ApplicationArtifact): string {
  const meta = getArtifactMetadata(artifact);
  const parts: string[] = [`v${artifact.version}`];
  if (meta.model) parts.push(meta.model);
  if (meta.duration_ms != null) parts.push(`${meta.duration_ms}ms`);
  if (meta.usage?.total_tokens != null) {
    parts.push(`${meta.usage.total_tokens} tokens`);
  }
  if (meta.estimated_cost_usd != null) {
    parts.push(`~$${meta.estimated_cost_usd}`);
  }
  return parts.join(' · ');
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
  const [rawOpen, setRawOpen] = useState(false);

  const hasStructuredResult =
    meta.result != null && typeof meta.result === 'object';
  const rawStructured = hasStructuredResult
    ? JSON.stringify(meta.result, null, 2)
    : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
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
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {formatGenerationMeta(artifact)}
      </p>

      <div className="space-y-2">
        <Label htmlFor={`artifact-content-${artifact.id}`}>
          Artifact content
        </Label>
        <Textarea
          id={`artifact-content-${artifact.id}`}
          className="min-h-[240px] resize-y font-sans text-sm leading-relaxed"
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

      {rawStructured ? (
        <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              {rawOpen ? 'Hide raw output' : 'View raw output'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {rawStructured}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
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

  const needsExtraInputs =
    !!tool &&
    (tool.needsQuestion ||
      tool.needsInstruction ||
      tool.needsContact ||
      tool.needsFollowUpMeta);

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
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          {tool ? (
            <>
              <DialogHeader className="space-y-1.5 border-b px-6 py-4 text-left">
                <DialogTitle>{ARTIFACT_TYPE_LABELS[tool.type]}</DialogTitle>
                <DialogDescription>{tool.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 overflow-y-auto px-6 py-4">
                {needsExtraInputs ? (
                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    {tool.needsQuestion ? (
                      <div className="space-y-2">
                        <Label htmlFor="artifact-question">Question</Label>
                        <Textarea
                          id="artifact-question"
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          placeholder="Paste the application or interview question…"
                          className="min-h-[80px]"
                        />
                      </div>
                    ) : null}
                    {tool.needsInstruction ? (
                      <div className="space-y-2">
                        <Label htmlFor="artifact-instruction">
                          Custom instruction
                        </Label>
                        <Textarea
                          id="artifact-instruction"
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
                          <Label htmlFor="artifact-contact-name">
                            Contact name
                          </Label>
                          <Input
                            id="artifact-contact-name"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            placeholder="Optional"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="artifact-contact-role">
                            Contact role
                          </Label>
                          <Input
                            id="artifact-contact-role"
                            value={contactRole}
                            onChange={(e) => setContactRole(e.target.value)}
                            placeholder="e.g. Hiring manager"
                          />
                        </div>
                      </div>
                    ) : null}
                    {tool.needsFollowUpMeta ? (
                      <div className="space-y-2">
                        <Label htmlFor="artifact-days-since">
                          Days since application
                        </Label>
                        <Input
                          id="artifact-days-since"
                          type="number"
                          min={0}
                          value={daysSince}
                          onChange={(e) => setDaysSince(e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="artifact-notes">Optional notes</Label>
                      <Textarea
                        id="artifact-notes"
                        value={userNotes}
                        onChange={(e) => setUserNotes(e.target.value)}
                        placeholder="Extra context for this generation…"
                        className="min-h-[60px]"
                      />
                    </div>
                  </div>
                ) : null}

                {generating && !active ? (
                  <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
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
                    <div className="max-h-36 space-y-2 overflow-y-auto">
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

              <DialogFooter className="gap-2 border-t px-6 py-3 sm:justify-between">
                <p className="self-center text-xs text-muted-foreground">
                  {active
                    ? 'Regenerate creates a new version.'
                    : 'Uses your profile, CV, and job analysis.'}
                </p>
                <Button
                  type="button"
                  variant={active ? 'outline' : 'default'}
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
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
