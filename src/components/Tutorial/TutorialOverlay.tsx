import { useState, useEffect, useCallback, useRef } from 'react';
import { usePortraitMode } from '../../hooks/usePortraitMode';

export interface TutorialStep {
  /** CSS selector for the element to highlight (null = center screen) */
  target: string | null;
  /** Mobile-specific selector override */
  mobileTarget?: string | null;
  /** Title shown in the tooltip card */
  title: string;
  /** Description body */
  description: string;
  /** Where to place the tooltip relative to the spotlight */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Mobile placement override */
  mobilePlacement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Called when this step becomes active */
  onEnter?: () => void;
  /** Called when leaving this step */
  onExit?: () => void;
}

const DESKTOP_STEPS: TutorialStep[] = [
  {
    target: null,
    title: 'Welcome to PixelConnect',
    description: 'A pixel-art compositor and image editor. This quick tour will walk you through the key features. Press Next to continue or Skip to dismiss.',
    placement: 'center',
  },
  {
    target: '[data-region="toolbar"]',
    title: 'Toolbar',
    description: 'Your main control bar. Rename your project, save/load files, undo/redo, toggle the grid overlay, selection borders, and layer tools from here.',
    placement: 'bottom',
  },
  {
    target: '[data-region="layer-panel"]',
    title: 'Layers Panel',
    description: 'All your layers live here. Drag to reorder, click the eye to toggle visibility, or use the lock icon. Use the + buttons at the bottom to add image, text, or shape layers.',
    placement: 'right',
  },
  {
    target: '[data-region="canvas"]',
    title: 'Canvas',
    description: 'Your workspace. Click a layer to select it, drag to move. Middle-click (or two-finger) to pan, scroll wheel (or pinch) to zoom. Drop images here to add them as layers.',
    placement: 'bottom',
  },
  {
    target: '[data-region="property-panel"]',
    title: 'Properties Panel',
    description: 'Adjust the selected layer\'s opacity, position, and dimensions. Change canvas size, background color, and shadow settings at the bottom.',
    placement: 'left',
  },
  {
    target: '[data-region="actions-menu"]',
    title: 'Modify Tools',
    description: 'With a layer selected, these tools are always available:\n\n• Transparency Mask — Remove a chosen color and make it transparent.\n• Crop — Trim the layer to a smaller region.\n• Pixelator / Resize — Resize an image or convert it into pixel art with palette matching and dithering.\n• BG Removal — Remove backgrounds with click, brush, or AI tools.',
    placement: 'left',
  },
  {
    target: '[data-region="zoom-controls"]',
    title: 'Zoom Controls',
    description: 'Zoom in/out with preset levels or use Fit to Screen to auto-center everything. The keyboard shortcut Ctrl+0 also resets zoom.',
    placement: 'bottom',
  },
  {
    target: '[data-region="file-operations"]',
    title: 'Save & Export',
    description: 'Save projects as .pixcomp files to reload later. Export to PNG for sharing. Your work also auto-saves to the browser\'s local storage.',
    placement: 'bottom',
  },
  {
    target: null,
    title: 'Keyboard Shortcuts',
    description: 'Ctrl+Z / Ctrl+Y — Undo/Redo\nCtrl+S — Save project\nDelete — Remove selected layers\nArrow keys — Nudge selected layers\nCtrl+Click — Multi-select layers',
    placement: 'center',
  },
  {
    target: null,
    title: 'You\'re all set!',
    description: 'Drop an image onto the canvas to get started, or use the Pixelator tool (in File menu) to convert images to pixel art. You can reopen this tour anytime from the ? button.',
    placement: 'center',
  },
];

const MOBILE_STEPS: TutorialStep[] = [
  {
    target: null,
    title: 'Welcome to PixelConnect',
    description: 'A pixel-art compositor and image editor, optimized for mobile. This quick tour will show you around. Tap Next to continue.',
    placement: 'center',
  },
  {
    target: '[data-region="toolbar"]',
    title: 'Toolbar',
    description: 'Two rows: top has project name, file ops, and undo/redo. Bottom row has grid, borders, tools toggles, and zoom controls.',
    placement: 'bottom',
  },
  {
    target: '[data-region="canvas"]',
    title: 'Canvas',
    description: 'One-finger to pan, pinch to zoom. Tap a layer to select it, then drag to move. Drop or upload images to add layers.',
    placement: 'center',
  },
  {
    target: '#btn-mobile-layers-toggle',
    title: 'Layers Panel (☰)',
    description: 'Tap the ☰ button in the bottom-left corner to open the layers drawer. Reorder layers, toggle visibility, and create text or shape layers from here.',
    placement: 'top',
  },
  {
    target: '#btn-mobile-properties-toggle',
    title: 'Properties Panel (⚙)',
    description: 'Tap the ⚙ button in the bottom-right corner. Adjust opacity, position, canvas size, and background color.',
    placement: 'top',
  },
  {
    target: '#btn-mobile-properties-toggle',
    title: 'Modify Tools',
    description: 'With a layer selected, open Properties (⚙) to find the Modify section with these tools:\n\n• Transparency Mask — Remove a color and make it transparent.\n• Crop — Trim the layer to a smaller region.\n• Pixelator / Resize — Resize an image or convert it to pixel art with palette matching and dithering.\n• BG Removal — Remove backgrounds with click, brush, or AI tools.',
    placement: 'top',
  },
  {
    target: '[data-region="zoom-controls"]',
    title: 'Zoom Controls',
    description: 'Use Fit to Screen to auto-center your canvas, or tap +/− for fine control. Pinch gestures work on the canvas too.',
    placement: 'top',
  },
  {
    target: null,
    title: 'You\'re all set!',
    description: 'Drop an image onto the canvas to get started, or use the Pixelator tool (in the file menu) to convert images to pixel art. Reopen this tour anytime from the ? button in the toolbar.',
    placement: 'center',
  },
];

const LOCALSTORAGE_KEY = 'pixelconnect_tutorial_seen';

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

function TutorialOverlay({ isOpen, onClose }: TutorialOverlayProps) {
  const isPortrait = usePortraitMode();
  const steps = isPortrait ? MOBILE_STEPS : DESKTOP_STEPS;
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  // Ref to measure actual tooltip height for positioning
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  // Compute spotlight rect for the current step's target
  const updateSpotlight = useCallback(() => {
    if (!isOpen) return;
    const selector = (isPortrait && step.mobileTarget !== undefined) ? step.mobileTarget : step.target;
    if (!selector) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(selector);
    if (el) {
      setSpotlightRect(el.getBoundingClientRect());
    } else {
      setSpotlightRect(null);
    }
  }, [isOpen, step, isPortrait]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [updateSpotlight]);

  // Reset step when opened
  useEffect(() => {
    if (isOpen) setCurrentStep(0);
  }, [isOpen]);

  // Fire onEnter/onExit callbacks when the active step changes
  useEffect(() => {
    if (!isOpen) return;
    step.onEnter?.();
    return () => {
      step.onExit?.();
    };
  }, [currentStep, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleFinish = () => {
    localStorage.setItem(LOCALSTORAGE_KEY, 'true');
    onClose();
  };

  const placement = (isPortrait && step.mobilePlacement) ? step.mobilePlacement : (step.placement || 'bottom');

  // Compute tooltip position — always clamped to stay in viewport
  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlightRect || placement === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const pad = 16;
    const tooltipW = Math.min(360, window.innerWidth - 32);
    // Use measured height if available, otherwise a safe estimate
    const tooltipH = tooltipRef.current ? tooltipRef.current.offsetHeight : 280;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Clamp helpers
    const clampX = (x: number) => Math.max(16, Math.min(x, vw - tooltipW - 16));
    const clampY = (y: number) => Math.max(16, Math.min(y, vh - tooltipH - 16));

    let style: React.CSSProperties;

    switch (placement) {
      case 'bottom':
        style = {
          position: 'fixed',
          top: clampY(spotlightRect.bottom + pad),
          left: clampX(spotlightRect.left),
          maxWidth: tooltipW,
        };
        break;
      case 'top':
        style = {
          position: 'fixed',
          top: clampY(spotlightRect.top - pad - tooltipH),
          left: clampX(spotlightRect.left),
          maxWidth: tooltipW,
        };
        break;
      case 'right': {
        const idealLeft = spotlightRect.right + pad;
        // If tooltip would overflow right, fall back to placing inside the spotlight area or centered
        const left = idealLeft + tooltipW > vw ? clampX(spotlightRect.left + 16) : idealLeft;
        style = {
          position: 'fixed',
          top: clampY(spotlightRect.top + (spotlightRect.height - tooltipH) / 2),
          left,
          maxWidth: tooltipW,
        };
        break;
      }
      case 'left': {
        const idealRight = vw - spotlightRect.left + pad;
        // If tooltip would overflow left, fall back
        const useRight = spotlightRect.left - pad - tooltipW < 0 ? undefined : idealRight;
        style = {
          position: 'fixed',
          top: clampY(spotlightRect.top + (spotlightRect.height - tooltipH) / 2),
          ...(useRight !== undefined
            ? { right: useRight, maxWidth: tooltipW }
            : { left: clampX(spotlightRect.right - tooltipW), maxWidth: tooltipW }),
        };
        break;
      }
      default:
        style = {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }

    return style;
  };

  // Build spotlight clip-path (inverted rectangle cutout)
  const getOverlayStyle = (): React.CSSProperties => {
    if (!spotlightRect) return {};
    const p = 6; // padding around element
    const x = spotlightRect.left - p;
    const y = spotlightRect.top - p;
    const w = spotlightRect.width + p * 2;
    const h = spotlightRect.height + p * 2;
    const r = 8; // border radius
    // Invert: full-screen polygon with a rounded-rect hole via inset
    return {
      clipPath: `polygon(
        0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
        ${x}px ${y + r}px,
        ${x + r}px ${y}px,
        ${x + w - r}px ${y}px,
        ${x + w}px ${y + r}px,
        ${x + w}px ${y + h - r}px,
        ${x + w - r}px ${y + h}px,
        ${x + r}px ${y + h}px,
        ${x}px ${y + h - r}px,
        ${x}px ${y + r}px
      )`,
    };
  };

  return (
    <div className="fixed inset-0 z-[400]" role="dialog" aria-modal="true" aria-label="Tutorial">
      {/* Dark overlay with spotlight cutout */}
      <div
        className="absolute inset-0 bg-black/70 transition-all duration-300"
        style={getOverlayStyle()}
        onClick={handleFinish}
      />

      {/* Spotlight border glow */}
      {spotlightRect && (
        <div
          className="absolute border-2 border-blue-400/60 rounded-lg pointer-events-none transition-all duration-300"
          style={{
            left: spotlightRect.left - 6,
            top: spotlightRect.top - 6,
            width: spotlightRect.width + 12,
            height: spotlightRect.height + 12,
            boxShadow: '0 0 20px rgba(96, 165, 250, 0.3)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="bg-gray-900 border border-gray-600 rounded-xl shadow-2xl p-5 z-[401] text-gray-200 flex flex-col"
        style={(() => {
          const base = getTooltipStyle();
          const mw = Math.min(380, window.innerWidth - 32);
          // Compute maxHeight based on the actual top position so the card never overflows the viewport
          const topVal = typeof base.top === 'number' ? base.top : 16;
          const mh = base.transform ? window.innerHeight - 32 : window.innerHeight - topVal - 16;
          return { ...base, maxWidth: mw, maxHeight: mh };
        })()}
      >
        {/* Step counter */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <span className="text-xs text-gray-500 font-mono">{currentStep + 1} / {steps.length}</span>
          <button
            onClick={handleFinish}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Skip tour
          </button>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-white mb-2 flex-shrink-0">{step.title}</h3>

        {/* Description — scrollable when content is tall */}
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line mb-4 overflow-y-auto flex-shrink min-h-0">{step.description}</p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4 flex-shrink-0">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentStep ? 'bg-blue-500' : i < currentStep ? 'bg-blue-800' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-3 flex-shrink-0">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-gray-700 hover:bg-gray-600 text-gray-200"
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-blue-600 hover:bg-blue-500 text-white"
          >
            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useTutorialFirstVisit() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!seen) {
      setIsFirstVisit(true);
      // Small delay to let the app render first
      const timer = setTimeout(() => setShowTutorial(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  return { showTutorial, setShowTutorial, isFirstVisit };
}

export default TutorialOverlay;
