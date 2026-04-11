'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { projectsService } from '@/features/projects/api/projects.service';
import { useProjectStore } from '@/features/projects/state/project.store';
import { useDashboardStore } from '@/features/dashboard/state/dashboard.store';
import { keysService } from '../api/keys.service';
import { ROUTES } from '@/shared/routes/routes';

export function ApiKeysSection() {
  const queryClient = useQueryClient();
  const setProjectsInStore = useProjectStore((state) => state.setProjects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const timeframe = useDashboardStore((state) => state.timeframe);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [keyDialogProjectId, setKeyDialogProjectId] = useState<string | null>(null);
  const [showPlaintextFor, setShowPlaintextFor] = useState<number | null>(null);
  const [plaintextMap, setPlaintextMap] = useState<Record<number, string>>({});
  const [projectNameInput, setProjectNameInput] = useState('');
  const [keyLabelInput, setKeyLabelInput] = useState('');

  const projectsQuery = useQuery({
    queryKey: ['projects', 'mine', 'keys-page'],
    queryFn: projectsService.listMine,
  });

  const keysQuery = useQuery({
    queryKey: ['keys', 'list', 'all-projects'],
    queryFn: () => keysService.list(),
  });

  const statsQuery = useQuery({
    queryKey: ['keys', 'stats', activeProjectId ?? 'all', timeframe],
    queryFn: () => keysService.stats(activeProjectId ?? undefined, timeframe),
  });

  const createProjectMutation = useMutation({
    mutationFn: (name: string) => projectsService.create(name),
    onSuccess: async () => {
      const projects = await queryClient.fetchQuery({
        queryKey: ['projects', 'mine', 'keys-page'],
        queryFn: projectsService.listMine,
      });
      setProjectsInStore(projects);
      await queryClient.invalidateQueries({ queryKey: ['keys', 'stats'] });
      setProjectDialogOpen(false);
      setProjectNameInput('');
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: (input: { projectId: string; label: string }) => keysService.create(input),
    onSuccess: async (created) => {
      setPlaintextMap((prev) => ({ ...prev, [created.keyId]: created.plaintextKey }));
      setShowPlaintextFor(created.keyId);
      setKeyDialogProjectId(null);
      setKeyLabelInput('');
      await queryClient.invalidateQueries({ queryKey: ['keys', 'list', 'all-projects'] });
      await queryClient.invalidateQueries({ queryKey: ['keys', 'stats'] });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (input: { keyId: number; projectId: string }) => keysService.revoke(input.keyId, input.projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['keys', 'list', 'all-projects'] });
      await queryClient.invalidateQueries({ queryKey: ['keys', 'stats'] });
    },
  });

  const groupedKeys = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    const keys = keysQuery.data ?? [];

    const grouped = new Map<string, { projectId: string; projectName: string; plan: string; keys: typeof keys }>();

    for (const project of projects) {
      grouped.set(project.id, {
        projectId: project.id,
        projectName: project.name,
        plan: project.plan,
        keys: [],
      });
    }

    for (const key of keys) {
      const existing = grouped.get(key.projectId);
      if (existing) {
        existing.keys.push(key);
      } else {
        grouped.set(key.projectId, {
          projectId: key.projectId,
          projectName: key.projectName,
          plan: 'free',
          keys: [key],
        });
      }
    }

    return Array.from(grouped.values());
  }, [keysQuery.data, projectsQuery.data]);

  const onCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    const name = projectNameInput.trim();
    if (!name) return;
    await createProjectMutation.mutateAsync(name);
  };

  const onCreateKey = async (event: FormEvent) => {
    event.preventDefault();
    if (!keyDialogProjectId) return;

    const label = keyLabelInput.trim();
    if (!label) return;

    await createKeyMutation.mutateAsync({ projectId: keyDialogProjectId, label });
  };

  const totalKeys = statsQuery.data?.totalKeys ?? 0;
  const criticalProjects = statsQuery.data?.criticalProjects ?? 0;
  const healthyRate = statsQuery.data?.healthyRate ?? 100;
  const staleKeys = statsQuery.data?.staleKeys ?? 0;

  return (
    <section className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">API Keys</h1>
          <p className="text-secondary max-w-xl text-sm">
            Manage access keys for your project nodes and services. Key rotation is recommended every 90 days.
          </p>
        </div>
        <button
          onClick={() => setProjectDialogOpen(true)}
          className="bg-primary hover:bg-primary-container text-on-primary px-6 py-2.5 rounded-md font-semibold flex items-center gap-2 transition-colors"
          type="button"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      <div className="bg-error/10 border border-error/30 rounded-md p-4 flex gap-4 items-center">
        <AlertTriangle className="text-error w-5 h-5" />
        <div>
          <span className="text-error font-bold uppercase text-[10px] tracking-widest block mb-0.5">Security Protocol Critical</span>
          <p className="text-sm text-primary-foreground">
            Never share your API keys or expose them in client-side code. Store secrets in server-side environment variables only.
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {projectsQuery.isLoading || keysQuery.isLoading ? (
          <div className="text-secondary text-sm">Loading projects and keys...</div>
        ) : null}

        {groupedKeys.map((group) => (
          <section key={group.projectId} className="relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold font-mono tracking-tighter uppercase">{group.projectName}</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${group.plan === 'free' ? 'bg-surface-container-high text-secondary border-outline-variant' : 'bg-primary/10 text-primary border-primary/20'}`}>
                  {group.plan === 'free' ? 'Non-Prod' : 'Critical'}
                </span>
              </div>
              <button
                onClick={() => setKeyDialogProjectId(group.projectId)}
                className="text-xs font-medium text-secondary hover:text-white flex items-center gap-1.5 transition-colors"
                type="button"
              >
                <Plus className="w-3.5 h-3.5" />
                Generate New Key
              </button>
            </div>

            <div className="grid grid-cols-1 gap-[1px] bg-outline-variant border border-outline-variant rounded-xl overflow-hidden shadow-2xl shadow-black/40">
              <div className="grid grid-cols-12 bg-surface-container px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-secondary">
                <div className="col-span-3">Key Name</div>
                <div className="col-span-4">Access Key</div>
                <div className="col-span-2">Created</div>
                <div className="col-span-2">Last Used</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {group.keys.length === 0 ? (
                <div className="bg-surface px-6 py-5 text-sm text-secondary">No keys yet for this project.</div>
              ) : (
                group.keys.map((key) => {
                  const canReveal = Boolean(plaintextMap[key.id]);
                  const isVisible = showPlaintextFor === key.id && canReveal;
                  const masked = `${key.keyPrefix}••••••••••••`;

                  return (
                    <div key={key.id} className="grid grid-cols-12 bg-surface px-6 py-5 items-center hover:bg-surface-container-low transition-colors group">
                      <div className="col-span-3">
                        <span className="font-semibold text-white block">{key.label}</span>
                        <span className="text-[10px] text-secondary font-mono">ID: {key.id}-{key.projectId.slice(0, 4)}</span>
                      </div>
                      <div className="col-span-4 flex items-center gap-3">
                        <code className="font-mono text-sm text-primary-foreground bg-app px-3 py-1.5 rounded border border-outline-variant">
                          {isVisible ? plaintextMap[key.id] : masked}
                        </code>
                        <button
                          onClick={() => setShowPlaintextFor(isVisible ? null : key.id)}
                          className="p-1.5 hover:bg-surface-container-high rounded text-secondary hover:text-primary transition-colors"
                          type="button"
                          title={canReveal ? 'Toggle visibility' : 'Key plaintext is only available right after generation'}
                        >
                          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={async () => {
                            const valueToCopy = canReveal ? plaintextMap[key.id] : masked;
                            await navigator.clipboard.writeText(valueToCopy);
                          }}
                          className="p-1.5 hover:bg-surface-container-high rounded text-secondary hover:text-primary transition-colors"
                          type="button"
                          title="Copy key"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="col-span-2 font-mono text-xs text-secondary">
                        {new Date(key.createdAt).toISOString().slice(0, 10)}
                      </div>
                      <div className="col-span-2 font-mono text-xs text-secondary">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toISOString().slice(0, 10) : 'Never'}
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          onClick={() => revokeKeyMutation.mutate({ keyId: key.id, projectId: key.projectId })}
                          disabled={revokeKeyMutation.isPending}
                          className="text-secondary hover:text-error transition-colors"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6">
          <div className="text-secondary uppercase text-[10px] font-bold tracking-[0.2em] mb-4">Network Health</div>
          <div className="text-4xl font-mono font-bold mb-2">{healthyRate.toFixed(2)}%</div>
          <p className="text-xs text-secondary">Key hygiene health in {timeframe} window. {staleKeys} stale key(s) detected.</p>
        </div>

        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6">
          <div className="text-secondary uppercase text-[10px] font-bold tracking-[0.2em] mb-4">Keys Provisioned</div>
          <div className="text-4xl font-mono font-bold mb-2">{totalKeys}</div>
          <p className="text-xs text-secondary">{criticalProjects} critical project(s), {Math.max(0, (statsQuery.data?.projectScopeCount ?? groupedKeys.length) - criticalProjects)} non-prod project(s).</p>
        </div>

        <div className="bg-primary rounded-xl p-6 text-on-primary relative overflow-hidden">
          <div className="text-black/70 uppercase text-[10px] font-bold tracking-[0.2em] mb-4">Subscription Plan</div>
          <div className="text-2xl font-bold mb-1">KEY_GOVERNANCE</div>
          <p className="text-sm font-medium mb-4">{statsQuery.data?.createdInWindow ?? 0} key(s) created in selected window.</p>
          <Link href={ROUTES.dashboard.billing} className="block w-full py-2 bg-black text-white text-xs font-bold rounded uppercase tracking-widest text-center">Manage Billing</Link>
        </div>
      </div>

      <footer className="pt-8 border-t border-outline-variant flex justify-between items-center text-secondary text-[10px] font-mono uppercase tracking-[0.2em]">
        <div>PulseAPI Systems 2024</div>
        <div className="flex gap-6">
          <Link href={ROUTES.dashboard.logs} className="hover:text-white transition-colors">API Status</Link>
          <Link href={ROUTES.dashboard.insights} className="hover:text-white transition-colors">Insights</Link>
          <Link href={ROUTES.dashboard.settings} className="hover:text-white transition-colors">Security</Link>
        </div>
      </footer>

      {projectDialogOpen ? (
        <DialogShell title="Create Project" onClose={() => setProjectDialogOpen(false)}>
          <form onSubmit={onCreateProject} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-secondary mb-2">Project Name</label>
              <input
                value={projectNameInput}
                onChange={(event) => setProjectNameInput(event.target.value)}
                className="w-full bg-app border border-outline-variant rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="Production-Alpha"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setProjectDialogOpen(false)} className="px-4 py-2 border border-outline-variant rounded-md text-xs uppercase tracking-widest text-secondary">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-md text-xs uppercase tracking-widest font-bold" disabled={createProjectMutation.isPending}>
                {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </DialogShell>
      ) : null}

      {keyDialogProjectId ? (
        <DialogShell title="Generate API Key" onClose={() => setKeyDialogProjectId(null)}>
          <form onSubmit={onCreateKey} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-secondary mb-2">Key Label</label>
              <input
                value={keyLabelInput}
                onChange={(event) => setKeyLabelInput(event.target.value)}
                className="w-full bg-app border border-outline-variant rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="Main Gateway Primary"
              />
            </div>
            <div className="text-[11px] text-secondary">
              Project: {projectsQuery.data?.find((project) => project.id === keyDialogProjectId)?.name ?? keyDialogProjectId}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setKeyDialogProjectId(null)} className="px-4 py-2 border border-outline-variant rounded-md text-xs uppercase tracking-widest text-secondary">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-md text-xs uppercase tracking-widest font-bold" disabled={createKeyMutation.isPending}>
                {createKeyMutation.isPending ? 'Generating...' : 'Generate Key'}
              </button>
            </div>
          </form>
        </DialogShell>
      ) : null}
    </section>
  );
}

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-surface-container border border-outline-variant rounded-lg p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-secondary hover:text-white" type="button">x</button>
        </div>
        {children}
      </div>
    </div>
  );
}
