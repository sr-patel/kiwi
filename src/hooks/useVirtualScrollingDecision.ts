import { useMemo } from 'react';

interface UseVirtualScrollingDecisionProps {
  itemCount: number;
  isMobile: boolean;
  currentView: {
    type: 'grid' | 'list';
    thumbnailSize: 'small' | 'medium' | 'large';
  };
  forceVirtualScrolling?: boolean;
}

interface VirtualScrollingDecision {
  shouldUseVirtualScrolling: boolean;
  threshold: number;
  reason: string;
}

// Performance thresholds for different scenarios
const VIRTUAL_SCROLLING_THRESHOLDS = {
  mobile: {
    grid: 500,    // Lower threshold for mobile due to performance constraints
    list: 1000,
  },
  desktop: {
    grid: 1000,   // Higher threshold for desktop
    list: 2000,
  },
  // Force virtual scrolling for very large datasets regardless of device
  force: 50000,
};

export function useVirtualScrollingDecision({
  itemCount,
  isMobile,
  currentView,
  forceVirtualScrolling = false,
}: UseVirtualScrollingDecisionProps): VirtualScrollingDecision {
  return useMemo(() => {
    // Force virtual scrolling if explicitly requested
    if (forceVirtualScrolling) {
      return {
        shouldUseVirtualScrolling: true,
        threshold: VIRTUAL_SCROLLING_THRESHOLDS.force,
        reason: 'Force enabled',
      };
    }

    // Get threshold based on device and view type
    const deviceThresholds = isMobile ? VIRTUAL_SCROLLING_THRESHOLDS.mobile : VIRTUAL_SCROLLING_THRESHOLDS.desktop;
    const threshold = deviceThresholds[currentView.type];

    // Determine if we should use virtual scrolling
    const shouldUse = itemCount >= threshold;

    // Generate reason for debugging
    let reason = `Item count: ${itemCount}, Threshold: ${threshold}`;
    if (shouldUse) {
      reason += ` (${itemCount >= VIRTUAL_SCROLLING_THRESHOLDS.force ? 'Very large dataset' : 'Performance optimization'})`;
    } else {
      reason += ' (Standard rendering)';
    }

    return {
      shouldUseVirtualScrolling: shouldUse,
      threshold,
      reason,
    };
  }, [itemCount, isMobile, currentView.type, forceVirtualScrolling]);
}