import React, { useState, useEffect, useMemo, useCallback } from 'react';

interface GroupNoiseModalProps {
  isOpen: boolean;
  onClose: () => void;
  palette: string[];
  onApply: (reducedPalette: string[]) => void;
}

interface ColorGroup {
  dominant: string;
  members: string[];
  /** User choice: which color to keep, or 'average' to merge */
  choice: string;
}

// Same threshold GeoPixels uses: squared Euclidean RGB distance
const DEFAULT_THRESHOLD_SQUARED = 2;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b))
    .toString(16).slice(1).toUpperCase();
}

function sqDist(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

function averageColors(hexColors: string[]): string {
  if (hexColors.length === 0) return '#000000';
  let rSum = 0, gSum = 0, bSum = 0;
  for (const hex of hexColors) {
    const { r, g, b } = hexToRgb(hex);
    rSum += r; gSum += g; bSum += b;
  }
  const n = hexColors.length;
  return rgbToHex(rSum / n, gSum / n, bSum / n);
}

/**
 * Groups colors using the same algorithm as GeoPixels ghost22.js:
 * Iterate colors in order, for each find the closest existing group leader.
 * If distance <= threshold, join that group; otherwise start a new group.
 */
function groupColors(palette: string[], thresholdSq: number): ColorGroup[] {
  const groups: { dominant: { r: number; g: number; b: number; hex: string }; members: string[] }[] = [];

  for (const hex of palette) {
    const rgb = hexToRgb(hex);
    let closestGroup: typeof groups[number] | null = null;
    let minDist = Infinity;

    for (const group of groups) {
      const d = sqDist(rgb, group.dominant);
      if (d < minDist) {
        minDist = d;
        closestGroup = group;
      }
    }

    if (closestGroup && minDist <= thresholdSq) {
      closestGroup.members.push(hex.toUpperCase());
    } else {
      groups.push({ dominant: { ...rgb, hex: hex.toUpperCase() }, members: [hex.toUpperCase()] });
    }
  }

  return groups.map(g => ({
    dominant: g.dominant.hex,
    members: g.members,
    choice: g.dominant.hex, // default: keep the first (dominant) color
  }));
}

const GroupNoiseModal: React.FC<GroupNoiseModalProps> = ({ isOpen, onClose, palette, onApply }) => {
  const [thresholdSq, setThresholdSq] = useState<number>(DEFAULT_THRESHOLD_SQUARED);
  const [displayThreshold, setDisplayThreshold] = useState<string>(String(DEFAULT_THRESHOLD_SQUARED));
  const [groups, setGroups] = useState<ColorGroup[]>([]);

  // Recompute groups when palette or threshold changes
  useEffect(() => {
    if (!isOpen) return;
    const computed = groupColors(palette, thresholdSq);
    setGroups(computed);
  }, [isOpen, palette, thresholdSq]);

  const conflictGroups = useMemo(() => groups.filter(g => g.members.length > 1), [groups]);
  const safeGroups = useMemo(() => groups.filter(g => g.members.length === 1), [groups]);

  const setChoice = useCallback((groupIdx: number, choice: string) => {
    setGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, choice } : g));
  }, []);

  const handleApply = useCallback(() => {
    const result: string[] = [];
    for (const group of groups) {
      if (group.members.length === 1) {
        result.push(group.members[0]);
      } else {
        if (group.choice === '__keep_all__') {
          result.push(...group.members);
        } else if (group.choice === '__average__') {
          result.push(averageColors(group.members));
        } else {
          result.push(group.choice);
        }
      }
    }
    onApply(result);
    onClose();
  }, [groups, onApply, onClose]);

  const handleReset = useCallback(() => {
    setThresholdSq(DEFAULT_THRESHOLD_SQUARED);
    setDisplayThreshold(String(DEFAULT_THRESHOLD_SQUARED));
  }, []);

  // Find the actual index in the full groups array for a conflict group
  const getGroupIndex = useCallback((group: ColorGroup) => {
    return groups.indexOf(group);
  }, [groups]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-[520px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Group Noise Detection</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Colors within {thresholdSq} squared RGB distance are grouped — matching GeoPixels behavior
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
        </div>

        {/* Threshold control */}
        <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-3">
          <span className="text-xs text-gray-400 flex-shrink-0">Threshold (d²):</span>
          <input
            type="text"
            value={displayThreshold}
            onChange={(e) => {
              setDisplayThreshold(e.target.value);
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 0) setThresholdSq(val);
            }}
            onBlur={() => {
              const val = parseInt(displayThreshold, 10);
              if (isNaN(val) || val < 0) {
                setThresholdSq(DEFAULT_THRESHOLD_SQUARED);
                setDisplayThreshold(String(DEFAULT_THRESHOLD_SQUARED));
              } else {
                setDisplayThreshold(String(val));
              }
            }}
            className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs font-mono text-center"
          />
          <div className="flex gap-1">
            {[2, 50, 100, 200].map(val => (
              <button
                key={val}
                onClick={() => { setThresholdSq(val); setDisplayThreshold(String(val)); }}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  thresholdSq === val
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
          <button
            onClick={handleReset}
            className="ml-auto text-xs text-gray-500 hover:text-gray-300 underline"
          >
            Reset
          </button>
        </div>

        {/* Summary */}
        <div className="px-4 py-2 border-b border-gray-700 text-xs text-gray-400">
          {conflictGroups.length === 0 ? (
            <span className="text-green-400">✓ No conflicting colors found — your palette is clean!</span>
          ) : (
            <span className="text-yellow-400">
              ⚠ {conflictGroups.length} group{conflictGroups.length > 1 ? 's' : ''} with similar colors detected
              ({conflictGroups.reduce((sum, g) => sum + g.members.length, 0)} colors → {conflictGroups.length} after merge)
            </span>
          )}
          <span className="ml-2 text-gray-500">
            · {safeGroups.length} unique color{safeGroups.length !== 1 ? 's' : ''} OK
          </span>
        </div>

        {/* Groups list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Conflict groups first */}
          {conflictGroups.map((group) => {
            const groupIdx = getGroupIndex(group);
            const avg = averageColors(group.members);
            return (
              <div key={groupIdx} className="bg-gray-900 rounded border border-yellow-700/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-yellow-400">
                    Group ({group.members.length} colors)
                  </span>
                  {thresholdSq <= 2 && (
                    <span className="text-xs text-gray-500">
                      — these will trigger Group Noise on GeoPixels
                    </span>
                  )}
                </div>

                {/* Color options */}
                <div className="space-y-1">
                  {group.members.map((color) => {
                    const rgb = hexToRgb(color);
                    const isSelected = group.choice === color;
                    return (
                      <label
                        key={color}
                        className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-900/40 border border-blue-600/50' : 'hover:bg-gray-800 border border-transparent'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`group-${groupIdx}`}
                          checked={isSelected}
                          onChange={() => setChoice(groupIdx, color)}
                          className="accent-blue-500"
                        />
                        <div
                          className="w-5 h-5 rounded border border-gray-600 flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-mono text-gray-300">{color}</span>
                        <span className="text-xs text-gray-600">
                          rgb({rgb.r}, {rgb.g}, {rgb.b})
                        </span>
                        {color === group.dominant && (
                          <span className="text-[10px] text-gray-500 bg-gray-700 px-1 rounded">dominant</span>
                        )}
                      </label>
                    );
                  })}

                  {/* Average option */}
                  <label
                    className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                      group.choice === '__average__' ? 'bg-blue-900/40 border border-blue-600/50' : 'hover:bg-gray-800 border border-transparent'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`group-${groupIdx}`}
                      checked={group.choice === '__average__'}
                      onChange={() => setChoice(groupIdx, '__average__')}
                      className="accent-blue-500"
                    />
                    <div
                      className="w-5 h-5 rounded border border-gray-600 flex-shrink-0"
                      style={{ backgroundColor: avg }}
                    />
                    <span className="text-xs font-mono text-gray-300">{avg}</span>
                    <span className="text-[10px] text-purple-400 bg-purple-900/30 px-1 rounded">average</span>
                  </label>

                  {/* Keep all option */}
                  <label
                    className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                      group.choice === '__keep_all__' ? 'bg-blue-900/40 border border-blue-600/50' : 'hover:bg-gray-800 border border-transparent'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`group-${groupIdx}`}
                      checked={group.choice === '__keep_all__'}
                      onChange={() => setChoice(groupIdx, '__keep_all__')}
                      className="accent-blue-500"
                    />
                    <div className="flex -space-x-1">
                      {group.members.map((c) => (
                        <div
                          key={c}
                          className="w-4 h-4 rounded border border-gray-600 flex-shrink-0"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-300">Keep all</span>
                    <span className="text-[10px] text-green-400 bg-green-900/30 px-1 rounded">no change</span>
                  </label>
                </div>
              </div>
            );
          })}

          {/* Safe colors (collapsed) */}
          {safeGroups.length > 0 && (
            <details className="group">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                {safeGroups.length} color{safeGroups.length !== 1 ? 's' : ''} with no conflicts ▶
              </summary>
              <div className="flex flex-wrap gap-1 mt-2">
                {safeGroups.map((group) => (
                  <div
                    key={group.dominant}
                    className="w-5 h-5 rounded border border-gray-700"
                    style={{ backgroundColor: group.dominant }}
                    title={group.dominant}
                  />
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 flex items-center gap-2">
          <button
            onClick={handleApply}
            disabled={conflictGroups.length === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded text-sm font-semibold transition-colors"
          >
            {conflictGroups.length === 0
              ? 'No Changes Needed'
              : `Apply — Reduce ${palette.length} → ${groups.length} colors`}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupNoiseModal;
