import React, { useState, useCallback } from 'react';

interface GeoPixelsPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddColors: (hexColors: string[]) => void;
}

interface UserProfile {
  id: number;
  name: string;
  experience: number;
  level: number;
  discordUser?: string;
  xUser?: string;
  redditUser?: string;
  moderator: boolean;
  guildTag?: string;
  isGuildOwner: boolean;
  profileLevel: number;
  bannersLevel: number;
  colors: string;
}

const GEOPIXELS_PROFILE_URL = 'https://geopixels.net/GetUserProfile';

/**
 * Convert a decimal integer color value to a hex color string.
 * e.g. 16777215 -> "#FFFFFF", 0 -> "#000000"
 */
function decimalToHex(dec: number): string {
  return '#' + Math.max(0, Math.min(16777215, dec)).toString(16).padStart(6, '0').toUpperCase();
}

/**
 * Format large numbers with commas.
 */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

const GeoPixelsPaletteModal: React.FC<GeoPixelsPaletteModalProps> = ({ isOpen, onClose, onAddColors }) => {
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [parsedColors, setParsedColors] = useState<string[]>([]);
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const handleFetch = useCallback(async () => {
    const id = parseInt(userId.trim() || '3228', 10);
    if (isNaN(id) || id <= 0) {
      setError('Please enter a valid user ID (positive integer).');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProfile(null);
    setParsedColors([]);

    try {
      const response = await fetch(GEOPIXELS_PROFILE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: id }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data: UserProfile = await response.json();

      if (!data.name) {
        throw new Error('User not found or invalid response.');
      }

      setProfile(data);

      // Parse colors
      if (data.colors && typeof data.colors === 'string') {
        const colorInts = data.colors
          .split(',')
          .map(s => s.trim())
          .filter(s => s !== '')
          .map(s => parseInt(s, 10))
          .filter(n => !isNaN(n));

        // Deduplicate while preserving order
        const seen = new Set<string>();
        const hexColors: string[] = [];
        for (const n of colorInts) {
          const hex = decimalToHex(n);
          if (!seen.has(hex)) {
            seen.add(hex);
            hexColors.push(hex);
          }
        }
        setParsedColors(hexColors);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user profile.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const handleAddPalette = () => {
    if (parsedColors.length > 0) {
      onAddColors(parsedColors);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFetch();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-800 border border-gray-600 rounded-lg shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-200">🎨 GeoPixels — Get Your Owned Colors</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none px-1"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Input */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 block">
              Enter your GeoPixels User ID to fetch your owned color palette.
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="3228"
                className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleFetch}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Fetching...
                  </>
                ) : (
                  'Fetch'
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Find your ID on <a href="https://geopixels.net" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">geopixels.net</a> — it's shown in your profile URL.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Profile + Colors */}
          {profile && (
            <div className="space-y-4">
              {/* User Info Card */}
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">{profile.name}</h3>
                    <div className="text-xs text-gray-400 mt-0.5">ID: {profile.id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-yellow-400">Level {profile.level}</div>
                    <div className="text-xs text-gray-500">{formatNumber(profile.experience)} XP</div>
                  </div>
                </div>

                {/* Profile badges / levels */}
                <div className="flex gap-3 flex-wrap">
                  <span className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-gray-300">
                    Profile Lvl {profile.profileLevel}
                  </span>
                  <span className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-gray-300">
                    Banners Lvl {profile.bannersLevel}
                  </span>
                  {profile.moderator && (
                    <span className="text-xs bg-red-900 border border-red-700 rounded px-2 py-0.5 text-red-300 font-semibold">
                      🛡️ Moderator
                    </span>
                  )}
                  {profile.isGuildOwner && (
                    <span className="text-xs bg-amber-900 border border-amber-700 rounded px-2 py-0.5 text-amber-300 font-semibold">
                      👑 Guild Owner
                    </span>
                  )}
                </div>

                {/* Socials */}
                {(profile.discordUser || profile.xUser || profile.redditUser) && (
                  <div className="flex gap-3 flex-wrap text-xs text-gray-400">
                    {profile.discordUser && (
                      <span title="Discord">💬 {profile.discordUser}</span>
                    )}
                    {profile.xUser && (
                      <span title="X / Twitter">🐦 @{profile.xUser}</span>
                    )}
                    {profile.redditUser && (
                      <span title="Reddit">🤖 u/{profile.redditUser}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Palette Preview */}
              {parsedColors.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase">
                      Owned Colors <span className="text-gray-500 font-normal">({parsedColors.length} unique)</span>
                    </h4>
                    <button
                      onClick={() => navigator.clipboard.writeText(parsedColors.join(', '))}
                      className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
                      title="Copy hex palette to clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m2 4h3a2 2 0 012 2v3m-3-3V5a2 2 0 012-2h3.071a2 2 0 011.414.586l1.414 1.414A2 2 0 0118 6.414V9m-3-3h3" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-0 bg-gray-900 p-1.5 rounded border border-gray-700">
                    {parsedColors.map((color, idx) => (
                      <div
                        key={idx}
                        className="w-5 h-5 cursor-crosshair hover:z-10 hover:scale-150 transition-transform duration-75 border border-transparent hover:border-white"
                        style={{ backgroundColor: color }}
                        title={color}
                        onMouseEnter={(e) => {
                          setHoveredColor(color);
                          setHoverPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => {
                          setHoveredColor(null);
                          setHoverPos(null);
                        }}
                        onMouseMove={(e) => {
                          setHoverPos({ x: e.clientX, y: e.clientY });
                        }}
                      />
                    ))}
                  </div>

                  {/* Hover Tooltip */}
                  {hoveredColor && hoverPos && (
                    <div
                      style={{
                        position: 'fixed',
                        left: hoverPos.x + 15,
                        top: hoverPos.y + 15,
                        zIndex: 99999,
                        pointerEvents: 'none',
                      }}
                      className="bg-gray-900 border border-gray-600 rounded p-2 shadow-xl text-xs min-w-[100px]"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 border border-gray-500 rounded-sm"
                          style={{ backgroundColor: hoveredColor }}
                        />
                        <span className="font-mono font-bold text-white">{hoveredColor}</span>
                      </div>
                    </div>
                  )}

                  {/* Add button */}
                  <button
                    onClick={handleAddPalette}
                    className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <span>🎨</span>
                    Add Palette to Pixelator
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeoPixelsPaletteModal;
