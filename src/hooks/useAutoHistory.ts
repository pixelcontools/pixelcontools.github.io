/**
 * Custom hook for automatic history tracking
 * Debounces and tracks significant state changes
 * EXCLUDES viewport changes (pan/zoom) as those are UI navigation state, not project state
 */

import { useEffect, useRef } from 'react';
import useCompositorStore from '../store/compositorStore';
import { ProjectData } from '../types/compositor.types';

/**
 * Creates a comparison object excluding viewport to avoid tracking nav changes
 */
function getProjectWithoutViewport(project: ProjectData): Omit<ProjectData, 'viewport'> {
  const { viewport, ...rest } = project;
  return rest;
}

export function useAutoHistory() {
  const project = useCompositorStore((state) => state.project);
  const pushHistory = useCompositorStore((state) => state.pushHistory);
  const lastHistoryPushAt = useCompositorStore((state) => state._lastHistoryPushAt);
  const lastProjectRef = useRef(project);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Check if project actually changed (excluding viewport which is just UI navigation state)
    const projectWithoutViewport = getProjectWithoutViewport(project);
    const lastProjectWithoutViewport = getProjectWithoutViewport(lastProjectRef.current);
    const projectChanged = JSON.stringify(projectWithoutViewport) !== JSON.stringify(lastProjectWithoutViewport);

    if (projectChanged) {
      // Skip if history was just manually pushed (e.g., stopDraggingLayer)
      // Give it 100ms window to avoid double-pushing
      if (lastHistoryPushAt && Date.now() - lastHistoryPushAt < 100) {
        lastProjectRef.current = project;
        return;
      }

      // Debounce history push by 500ms
      debounceTimerRef.current = setTimeout(() => {
        pushHistory();
        lastProjectRef.current = project;
      }, 500);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [project, pushHistory, lastHistoryPushAt]);
}

export default useAutoHistory;
