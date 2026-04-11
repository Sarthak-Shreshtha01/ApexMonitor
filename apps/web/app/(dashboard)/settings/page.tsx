'use client';

import React, { useState } from 'react';
import { useProjectStore } from '@/features/projects/state/project.store';
import { SettingsContent } from '@/features/settings/ui/SettingsContent';

export default function SettingsPage() {
  const projectId = useProjectStore((state) => state.activeProjectId) || '';

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: '', email: '' });
  const [addMemberFormData, setAddMemberFormData] = useState<{ email: string; role: 'owner' | 'editor' | 'viewer' }>({ email: '', role: 'viewer' });

  return (
    <div className="min-h-screen bg-[#0A0A0A] ">
      <SettingsContent
        projectId={projectId}
        isEditProfileOpen={isEditProfileOpen}
        setIsEditProfileOpen={setIsEditProfileOpen}
        isAddMemberOpen={isAddMemberOpen}
        setIsAddMemberOpen={setIsAddMemberOpen}
        editFormData={editFormData}
        setEditFormData={setEditFormData}
        addMemberFormData={addMemberFormData}
        setAddMemberFormData={setAddMemberFormData}
      />
    </div>
  );
}