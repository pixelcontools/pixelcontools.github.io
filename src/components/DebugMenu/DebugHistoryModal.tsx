/**
 * Debug History Modal - Shows the undo/redo history stack
 * Accessible via Ctrl+Shift+D
 */

import { useState } from 'react';
import useCompositorStore from '../../store/compositorStore';
import { ProjectData } from '../../types/compositor.types';

interface DebugHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DebugHistoryModal({ isOpen, onClose }: DebugHistoryModalProps) {
  const history = useCompositorStore((state) => state.history);
  const project = useCompositorStore((state) => state.project);
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);

  if (!isOpen) return null;

  const getProjectSummary = (proj: ProjectData): string => {
    return `${proj.projectName} | ${proj.layers.length} layer(s) | Modified: ${new Date(proj.modified).toLocaleTimeString()}`;
  };

  const getLayerChanges = (proj1: ProjectData, proj2: ProjectData): string[] => {
    const changes: string[] = [];

    // Check layer count
    if (proj1.layers.length !== proj2.layers.length) {
      changes.push(`Layer count: ${proj1.layers.length} → ${proj2.layers.length}`);
    }

    // Check layer properties
    for (let i = 0; i < Math.max(proj1.layers.length, proj2.layers.length); i++) {
      const layer1 = proj1.layers[i];
      const layer2 = proj2.layers[i];

      if (!layer1) {
        changes.push(`Layer ${i}: removed`);
      } else if (!layer2) {
        changes.push(`Layer ${i}: added (${layer1.name})`);
      } else if (
        layer1.x !== layer2.x ||
        layer1.y !== layer2.y ||
        layer1.width !== layer2.width ||
        layer1.height !== layer2.height
      ) {
        changes.push(
          `${layer1.name}: (${layer1.x}, ${layer1.y}) → (${layer2.x}, ${layer2.y})`
        );
      }
    }

    return changes.length > 0 ? changes : ['No layer changes'];
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Debug History Modal"
      tabIndex={0}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-yellow-400">🐛</span>
            Debug History
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close debug menu"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto p-4 space-y-2">
            {/* Current Project State */}
            <div className="bg-slate-800 rounded p-3 border border-slate-700 sticky top-0">
              <div className="text-sm font-semibold text-cyan-400 mb-1">Current State</div>
              <div className="text-xs text-slate-300">
                {getProjectSummary(project)}
              </div>
            </div>

            {/* History Stack */}
            {history.past.length === 0 && history.future.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <p className="text-sm">No history entries yet</p>
              </div>
            ) : (
              <>
                {/* Past History */}
                {history.past.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-green-400 mb-2 px-1">
                      UNDO STACK ({history.past.length})
                    </div>
                    <div className="space-y-1">
                      {history.past.map((entry, idx) => (
                        <div key={`past-${idx}`}>
                          <button
                            onClick={() =>
                              setExpandedIndex(
                                expandedIndex === `past-${idx}` ? null : `past-${idx}`
                              )
                            }
                            className="w-full text-left bg-slate-800 hover:bg-slate-700 rounded px-3 py-2 text-xs transition-colors border border-slate-700 hover:border-slate-600"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-green-400">↶</span>
                              <span className="text-slate-300 flex-1">
                                {getProjectSummary(entry)}
                              </span>
                              <span className="text-slate-500">
                                {expandedIndex === `past-${idx}` ? '▼' : '▶'}
                              </span>
                            </div>
                          </button>

                          {/* Expanded Details */}
                          {expandedIndex === `past-${idx}` && (
                            <div className="bg-slate-800/50 border-l-2 border-green-400 ml-4 mt-1 p-2 rounded text-xs text-slate-300 space-y-1">
                              {getLayerChanges(
                                history.past[idx + 1] || project,
                                entry
                              ).map((change, changeIdx) => (
                                <div key={changeIdx} className="text-slate-400">
                                  • {change}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Future History */}
                {history.future.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-blue-400 mb-2 px-1 mt-4">
                      REDO STACK ({history.future.length})
                    </div>
                    <div className="space-y-1">
                      {history.future.map((entry, idx) => (
                        <div key={`future-${idx}`}>
                          <button
                            onClick={() =>
                              setExpandedIndex(
                                expandedIndex === `future-${idx}` ? null : `future-${idx}`
                              )
                            }
                            className="w-full text-left bg-slate-800 hover:bg-slate-700 rounded px-3 py-2 text-xs transition-colors border border-slate-700 hover:border-slate-600"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-blue-400">↷</span>
                              <span className="text-slate-300 flex-1">
                                {getProjectSummary(entry)}
                              </span>
                              <span className="text-slate-500">
                                {expandedIndex === `future-${idx}` ? '▼' : '▶'}
                              </span>
                            </div>
                          </button>

                          {/* Expanded Details */}
                          {expandedIndex === `future-${idx}` && (
                            <div className="bg-slate-800/50 border-l-2 border-blue-400 ml-4 mt-1 p-2 rounded text-xs text-slate-300 space-y-1">
                              {getLayerChanges(
                                project,
                                entry
                              ).map((change, changeIdx) => (
                                <div key={changeIdx} className="text-slate-400">
                                  • {change}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-800 px-6 py-3 border-t border-slate-700 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Stack size: {history.past.length + history.future.length}</span>
              <span>Max steps: {history.maxSteps}</span>
            </div>
            <div className="text-slate-500 text-xs mt-1">Press ESC or click overlay to close</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DebugHistoryModal;
