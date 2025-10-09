/**
 * Utility functions for PWA functionality
 */

export const isPWAInstalled = (): boolean => {
  // Check for standalone mode (iOS)
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  // Check for navigator.standalone (iOS Safari)
  if (window.navigator && 'standalone' in window.navigator && (window.navigator as any).standalone) {
    return true;
  }
  
  // Check for TWA (Chrome)
  if (document.referrer.includes('android-app://')) {
    return true;
  }
  
  return false;
};

export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isChrome = (): boolean => {
  return /Chrome/i.test(navigator.userAgent) && !/Edg/i.test(navigator.userAgent);
};

export const supportsPWA = (): boolean => {
  // PWA installability only requires service worker + manifest; push/notifications are optional
  return 'serviceWorker' in navigator;
};

export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  const width = window.innerWidth;
  
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

/**
 * Register the service worker
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    console.log('Service Worker registered successfully:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

/**
 * Handle PWA update
 */
export const handlePWAUpdate = (registration: ServiceWorkerRegistration): void => {
  if (registration.waiting) {
    // New version available
    const updateConfirmed = confirm('A new version is available. Update now?');
    if (updateConfirmed) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }
};

/**
 * Show native share if available, otherwise fallback to custom share
 */
export const shareContent = async (data: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<boolean> => {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      console.error('Native share failed:', error);
    }
  }
  
  // Fallback: Copy to clipboard
  if (navigator.clipboard && data.url) {
    try {
      await navigator.clipboard.writeText(data.url);
      return true;
    } catch (error) {
      console.error('Clipboard write failed:', error);
    }
  }
  
  return false;
};

/**
 * Handle add to home screen prompt
 */
export const showAddToHomeScreen = (): void => {
  if (isIOS() && !isPWAInstalled()) {
    // Show iOS instructions
    alert('To install this app on your iOS device, tap the share button and then "Add to Home Screen".');
  } else if (isAndroid() && !isPWAInstalled()) {
    // Show Android instructions
    alert('To install this app, tap the menu button in your browser and select "Add to Home Screen" or "Install App".');
  }
};

/**
 * Get safe area insets for devices with notches
 */
export const getSafeAreaInsets = () => {
  const style = getComputedStyle(document.documentElement);
  
  return {
    top: style.getPropertyValue('env(safe-area-inset-top)') || '0px',
    right: style.getPropertyValue('env(safe-area-inset-right)') || '0px',
    bottom: style.getPropertyValue('env(safe-area-inset-bottom)') || '0px',
    left: style.getPropertyValue('env(safe-area-inset-left)') || '0px'
  };
};

/**
 * Prevent zoom on double tap (iOS)
 */
export const preventZoom = (element: HTMLElement): (() => void) => {
  let lastTouchEnd = 0;
  
  const handleTouchEnd = (e: TouchEvent) => {
    const now = new Date().getTime();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  };
  
  element.addEventListener('touchend', handleTouchEnd, { passive: false });
  
  return () => {
    element.removeEventListener('touchend', handleTouchEnd);
  };
};