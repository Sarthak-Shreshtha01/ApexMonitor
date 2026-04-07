import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ProjectSummary } from '../api/projects.service';

interface ProjectState {
  projects: ProjectSummary[];
  activeProjectId: string | null;
  setProjects: (projects: ProjectSummary[]) => void;
  setActiveProjectId: (projectId: string) => void;
  clearProjects: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      setProjects: (projects) => {
        const currentActive = get().activeProjectId;
        const hasCurrent = currentActive ? projects.some((project) => project.id === currentActive) : false;

        set({
          projects,
          activeProjectId: hasCurrent ? currentActive : projects[0]?.id ?? null,
        });
      },
      setActiveProjectId: (projectId) => set({ activeProjectId: projectId }),
      clearProjects: () => set({ projects: [], activeProjectId: null }),
    }),
    {
      name: 'persistroot-projects',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ projects: state.projects, activeProjectId: state.activeProjectId }),
    }
  )
);
