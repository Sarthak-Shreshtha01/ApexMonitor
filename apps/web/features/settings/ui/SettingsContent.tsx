'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/features/settings/api/user.service';
import { teamService } from '@/features/settings/api/team.service';
import { projectsService, ProjectSummary } from '@/features/projects/api/projects.service';
import { Loader2 } from 'lucide-react';

interface SettingsContentProps {
  projectId: string;
  isEditProfileOpen: boolean;
  setIsEditProfileOpen: (open: boolean) => void;
  isAddMemberOpen: boolean;
  setIsAddMemberOpen: (open: boolean) => void;
  editFormData: { name: string; email: string; company: string; jobTitle: string; timezone: string };
  setEditFormData: (data: { name: string; email: string; company: string; jobTitle: string; timezone: string }) => void;
  addMemberFormData: { email: string; role: 'owner' | 'editor' | 'viewer' };
  setAddMemberFormData: (data: { email: string; role: 'owner' | 'editor' | 'viewer' }) => void;
}

export function SettingsContent({
  projectId,
  isEditProfileOpen,
  setIsEditProfileOpen,
  isAddMemberOpen,
  setIsAddMemberOpen,
  editFormData,
  setEditFormData,
  addMemberFormData,
  setAddMemberFormData,
}: SettingsContentProps) {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  // Queries
  const profileQuery = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => userService.getProfile(),
  });

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.listMine(),
  });

  const membersQuery = useQuery({
    queryKey: ['projectMembers', projectId],
    queryFn: () => teamService.listMembers(projectId),
    enabled: !!projectId,
  });

  const currentProject = projectsQuery.data?.find((p: ProjectSummary) => p.id === projectId);

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: (data: { name: string; email: string; company: string; jobTitle: string; timezone: string }) => userService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      setIsEditProfileOpen(false);
      showToast('Profile updated successfully');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      showToast(message);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { email: string; role: 'owner' | 'editor' | 'viewer' }) =>
      teamService.addMember(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
      setIsAddMemberOpen(false);
      setAddMemberFormData({ email: '', role: 'viewer' });
      showToast('Member added successfully');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to add member';
      showToast(message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'owner' | 'editor' | 'viewer' }) =>
      teamService.updateMemberRole(projectId, memberId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
      showToast('Role updated successfully');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update role';
      showToast(message);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => teamService.removeMember(projectId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
      showToast('Member removed successfully');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to remove member';
      showToast(message);
    },
  });

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const handleEditProfileOpen = () => {
    if (profileQuery.data) {
      setEditFormData({
        name: profileQuery.data.name,
        email: profileQuery.data.email,
        company: profileQuery.data.company ?? '',
        jobTitle: profileQuery.data.jobTitle ?? '',
        timezone: profileQuery.data.timezone ?? 'UTC',
      });
    }
    setIsEditProfileOpen(true);
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(editFormData);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (addMemberFormData.email.trim()) {
      addMemberMutation.mutate(addMemberFormData);
    }
  };

  return (
    <div className="text-on-background antialiased overflow-x-hidden selection:bg-[#FF4500]/30">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100]">
          <div className="bg-[#131313] border border-[#FF4500] text-[#FF4500] px-6 py-3 rounded shadow-[0_0_20px_rgba(255,69,0,0.2)]">
            <span className="text-xs font-bold uppercase tracking-widest">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="min-h-screen">
        <div className="max-w-6xl mx-auto p-8 lg:p-12">
          {/* Page Header */}
          <header className="mb-12">
            <h1 className="text-4xl font-bold tracking-tighter text-on-background mb-2">Workspace Settings</h1>
            <p className="text-zinc-500 text-sm">Manage your global PulseAPI configuration, team access, and identity.</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Profile & Config */}
            <div className="lg:col-span-4 space-y-8">
              {/* User Profile Section */}
              <section className="bg-[#131313] p-6 rounded-lg border border-zinc-700 relative overflow-hidden group hover:border-zinc-600 transition-colors">
                {profileQuery.isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 animate-spin text-[#FF4500]" />
                  </div>
                ) : profileQuery.data ? (
                  <>
                    <div className="flex items-start justify-between mb-6">
                      <div className="h-16 w-16 rounded-lg overflow-hidden border border-zinc-700 group-hover:border-[#FF4500]/50 transition-colors flex items-center justify-center bg-gradient-to-br from-[#FF4500] to-[#ff8a6b]">
                        <span className="text-2xl font-bold text-white">
                          {profileQuery.data.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="bg-[#FF4500]/10 text-[#FF4500] text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border border-[#FF4500]/20">
                        Owner
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest block mb-1">
                          Display Name
                        </label>
                        <p className="text-lg font-medium">{profileQuery.data.name}</p>
                      </div>
                      <div>
                        <label className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest block mb-1">
                          Email Address
                        </label>
                        <p className="text-sm font-mono text-zinc-300">{profileQuery.data.email}</p>
                      </div>
                      <div>
                        <label className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest block mb-1">
                          Company
                        </label>
                        <p className="text-sm text-zinc-300">{profileQuery.data.company || 'Not set'}</p>
                      </div>
                      <div>
                        <label className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest block mb-1">
                          Job Title
                        </label>
                        <p className="text-sm text-zinc-300">{profileQuery.data.jobTitle || 'Not set'}</p>
                      </div>
                      <div>
                        <label className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest block mb-1">
                          Timezone
                        </label>
                        <p className="text-sm text-zinc-300">{profileQuery.data.timezone || 'Not set'}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleEditProfileOpen}
                      className="mt-8 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-widest transition-all rounded border border-zinc-700 hover:border-zinc-600 active:scale-95"
                    >
                      Edit Identity
                    </button>
                  </>
                ) : null}
              </section>

              {/* Project Configuration Section */}
              <section className="bg-[#131313] p-6 rounded-lg border border-zinc-700">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
                  <span className="text-sm">⚙️</span>
                  Project Config
                </h3>
                {projectsQuery.isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-[#FF4500]" />
                  </div>
                ) : currentProject ? (
                  <>
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <label className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">Project Name</label>
                        <div className="w-full bg-black border border-zinc-700 rounded p-3 text-sm text-white">
                          {currentProject.name}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">Project ID</label>
                        <div className="bg-black border border-dashed border-zinc-700 p-3 rounded flex items-center justify-between">
                          <code className="font-mono text-xs text-[#FF8C6B] break-all">{currentProject.id}</code>
                          <button
                            onClick={() => {
                              if (currentProject) copyToClipboard(currentProject.id, 'projectId');
                            }}
                            className="text-zinc-600 hover:text-white transition-colors ml-2 flex-shrink-0"
                          >
                            {copiedStates['projectId'] ? (
                              <span className="text-[10px] font-bold text-green-400">✓</span>
                            ) : (
                              <span className="text-sm">📋</span>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">Plan</label>
                        <div className="w-full bg-black border border-zinc-700 rounded p-3 text-sm text-white capitalize">
                          {currentProject.plan}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">Rate Limit</label>
                        <div className="w-full bg-black border border-zinc-700 rounded p-3 text-sm text-white">
                          {currentProject.rateLimitRpm.toLocaleString()} req/min
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </section>
            </div>

            {/* Right Column: Team Management */}
            <div className="lg:col-span-8">
              <section className="bg-[#131313] rounded-lg border border-zinc-700 flex flex-col">
                <div className="p-6 border-b border-zinc-700 flex justify-between items-center bg-[#1a1919]/50">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">Team Management</h3>
                    <p className="text-zinc-500 text-xs mt-1">{currentProject ? `Control access for ${currentProject.name}` : 'Loading...'}</p>
                  </div>
                  <button
                    onClick={() => setIsAddMemberOpen(true)}
                    disabled={membersQuery.isLoading}
                    className="flex items-center gap-2 bg-[#FF4500] hover:bg-[#ff6a1a] text-white px-4 py-2 rounded font-bold text-xs uppercase tracking-widest transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                  >
                    {membersQuery.isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="text-sm">👥</span>
                    )}
                    Add Member
                  </button>
                </div>

                {/* Members Table */}
                {membersQuery.isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-6 h-6 animate-spin text-[#FF4500]" />
                  </div>
                ) : membersQuery.data && membersQuery.data.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-zinc-700 bg-[#0A0A0A]">
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Member</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Role</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Joined</th>
                            <th className="px-6 py-4 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {membersQuery.data && membersQuery.data.map((member) => (
                            <tr key={member.userId} className="hover:bg-zinc-900/50 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FF4500] to-[#ff8a6b] flex items-center justify-center font-bold text-[10px] text-white border border-zinc-700 group-hover:border-[#FF4500]/50 transition-colors">
                                    {member.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-white">{member.name}</p>
                                    <p className="text-[11px] text-zinc-500 font-mono">{member.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <select
                                  value={member.role}
                                  onChange={(e) =>
                                    updateRoleMutation.mutate({
                                      memberId: member.userId,
                                      role: e.target.value as 'owner' | 'editor' | 'viewer',
                                    })
                                  }
                                  disabled={updateRoleMutation.isPending}
                                  className="bg-black border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF4500] capitalize cursor-pointer disabled:opacity-50"
                                >
                                  <option value="owner">Owner</option>
                                  <option value="editor">Editor</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs text-zinc-400">
                                  {new Date(member.createdAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => removeMemberMutation.mutate(member.userId)}
                                  disabled={removeMemberMutation.isPending}
                                  className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-zinc-800 disabled:opacity-50"
                                  title="Remove member"
                                >
                                  <span className="text-sm">🗑️</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 border-t border-zinc-700 text-center bg-[#0A0A0A]/50 text-[11px] text-zinc-500">
                      {membersQuery.data.length} member{membersQuery.data.length !== 1 ? 's' : ''}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-zinc-500">No members yet. Add your first team member!</p>
                  </div>
                )}
              </section>

              {/* Advanced Security Card */}
              <section className="mt-8 bg-gradient-to-br from-[#1a1919] to-[#0A0A0A] p-8 rounded-lg border border-zinc-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <span className="text-[120px]">🔒</span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl font-bold tracking-tight text-white mb-2">Advanced Protection</h3>
                  <p className="text-zinc-400 text-sm max-w-md mb-6">
                    Upgrade your security with Two-Factor Authentication, Custom Domain SSL, and IP Whitelisting.
                  </p>
                  <button className="px-6 py-2 bg-transparent border-2 border-[#FF4500] text-[#FF4500] font-bold text-xs uppercase tracking-widest hover:bg-[#FF4500] hover:text-black transition-all">
                    Enhance Security
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#131313] border border-zinc-700 p-8 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-2">Edit Identity</h3>
            <p className="text-sm text-zinc-500 mb-6">Update your display name and email.</p>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-zinc-700 rounded p-3 text-sm text-white focus:outline-none focus:border-[#FF4500]"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-zinc-700 rounded p-3 text-sm text-white focus:outline-none focus:border-[#FF4500]"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={editFormData.company}
                  onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-zinc-700 rounded p-3 text-sm text-white focus:outline-none focus:border-[#FF4500]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  value={editFormData.jobTitle}
                  onChange={(e) => setEditFormData({ ...editFormData, jobTitle: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-zinc-700 rounded p-3 text-sm text-white focus:outline-none focus:border-[#FF4500]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={editFormData.timezone}
                  onChange={(e) => setEditFormData({ ...editFormData, timezone: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-zinc-700 rounded p-3 text-sm text-white focus:outline-none focus:border-[#FF4500]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="px-4 py-2 bg-[#FF4500] hover:bg-[#ff6a1a] text-white text-xs font-bold uppercase tracking-widest rounded disabled:opacity-50"
                >
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#131313] border border-zinc-700 p-8 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-2">Invite Team Member</h3>
            <p className="text-sm text-zinc-500 mb-6">Add a new member to your team.</p>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="member@example.com"
                  value={addMemberFormData.email}
                  onChange={(e) => setAddMemberFormData({ ...addMemberFormData, email: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-zinc-700 rounded p-3 text-sm text-white focus:outline-none focus:border-[#FF4500]"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Role</label>
                <select
                  value={addMemberFormData.role}
                  onChange={(e) => {
                    const role = e.target.value as 'owner' | 'editor' | 'viewer';
                    setAddMemberFormData({ ...addMemberFormData, role });
                  }}
                  className="w-full bg-[#0A0A0A] border border-zinc-700 rounded p-3 text-sm text-white focus:outline-none focus:border-[#FF4500]"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending}
                  className="px-4 py-2 bg-[#FF4500] hover:bg-[#ff6a1a] text-white text-xs font-bold uppercase tracking-widest rounded disabled:opacity-50"
                >
                  {addMemberMutation.isPending ? 'Adding...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
