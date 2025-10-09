// Read persisted setting to decide if enhanced color integration is enabled.
// We avoid using hooks here to keep this utility usable outside React components.
const isColorIntegrationEnabled = (): boolean => {
  try {
    const raw = localStorage.getItem('kiwi-app-storage');
    if (!raw) return true;
    const data = JSON.parse(raw);
    // Persisted under partialize in store
    if (typeof data?.state?.enableColorIntegration === 'boolean') {
      return data.state.enableColorIntegration;
    }
    if (typeof data?.enableColorIntegration === 'boolean') {
      return data.enableColorIntegration;
    }
    return true;
  } catch {
    return true;
  }
};

export const getAccentClasses = (accentColor: string, variant: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'selected' = 'bg') => {
  if (!isColorIntegrationEnabled()) {
    // Provide neutral, accessible fallbacks when integration is off
    if (variant === 'selected') {
      // Ensure good contrast in both themes when selected
      return 'bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100';
    }
    if (variant === 'text') {
      return 'text-gray-700 dark:text-gray-200';
    }
    if (variant === 'border') {
      return 'border-gray-200 dark:border-gray-700';
    }
    if (variant === 'hover') {
      return 'hover:bg-gray-100 dark:hover:bg-gray-900';
    }
    // For bg/ring or others, keep neutral
    return '';
  }
  const colorMap: { [key: string]: { [key: string]: string } } = {
    kiwi: {
      bg: 'bg-[#8E466D] dark:bg-[#A55A7F]',
      text: 'text-[#8E466D] dark:text-[#A55A7F]',
      border: 'border-[#8E466D]/20 dark:border-[#A55A7F]/30',
      ring: 'ring-[#8E466D] dark:ring-[#A55A7F]',
      hover: 'hover:bg-[#8E466D]/10 dark:hover:bg-[#A55A7F]/20',
      selected: 'bg-[#8E466D]/20 text-[#8E466D] dark:bg-[#A55A7F]/30 dark:text-[#A55A7F]',
    },
    orange: {
      bg: 'bg-orange-500 dark:bg-orange-400',
      text: 'text-orange-600 dark:text-orange-400',
      border: 'border-orange-200 dark:border-orange-700',
      ring: 'ring-orange-500 dark:ring-orange-400',
      hover: 'hover:bg-orange-50 dark:hover:bg-orange-900/20',
      selected: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    },
    blue: {
      bg: 'bg-blue-500 dark:bg-blue-400',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-700',
      ring: 'ring-blue-500 dark:ring-blue-400',
      hover: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
      selected: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    },
    green: {
      bg: 'bg-green-500 dark:bg-green-400',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-200 dark:border-green-700',
      ring: 'ring-green-500 dark:ring-green-400',
      hover: 'hover:bg-green-50 dark:hover:bg-green-900/20',
      selected: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    },
    purple: {
      bg: 'bg-purple-500 dark:bg-purple-400',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-200 dark:border-purple-700',
      ring: 'ring-purple-500 dark:ring-purple-400',
      hover: 'hover:bg-purple-50 dark:hover:bg-purple-900/20',
      selected: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    },
    red: {
      bg: 'bg-red-500 dark:bg-red-400',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-700',
      ring: 'ring-red-500 dark:ring-red-400',
      hover: 'hover:bg-red-50 dark:hover:bg-red-900/20',
      selected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    },
    pink: {
      bg: 'bg-pink-500 dark:bg-pink-400',
      text: 'text-pink-600 dark:text-pink-400',
      border: 'border-pink-200 dark:border-pink-700',
      ring: 'ring-pink-500 dark:ring-pink-400',
      hover: 'hover:bg-pink-50 dark:hover:bg-pink-900/20',
      selected: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    },
    teal: {
      bg: 'bg-teal-500 dark:bg-teal-400',
      text: 'text-teal-600 dark:text-teal-400',
      border: 'border-teal-200 dark:border-teal-700',
      ring: 'ring-teal-500 dark:ring-teal-400',
      hover: 'hover:bg-teal-50 dark:hover:bg-teal-900/20',
      selected: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    },
    indigo: {
      bg: 'bg-indigo-500 dark:bg-indigo-400',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-200 dark:border-indigo-700',
      ring: 'ring-indigo-500 dark:ring-indigo-400',
      hover: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
      selected: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    },
    cyan: {
      bg: 'bg-cyan-500 dark:bg-cyan-400',
      text: 'text-cyan-600 dark:text-cyan-400',
      border: 'border-cyan-200 dark:border-cyan-700',
      ring: 'ring-cyan-500 dark:ring-cyan-400',
      hover: 'hover:bg-cyan-50 dark:hover:bg-cyan-900/20',
      selected: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    },
    lime: {
      bg: 'bg-lime-500 dark:bg-lime-400',
      text: 'text-lime-600 dark:text-lime-400',
      border: 'border-lime-200 dark:border-lime-700',
      ring: 'ring-lime-500 dark:ring-lime-400',
      hover: 'hover:bg-lime-50 dark:hover:bg-lime-900/20',
      selected: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
    },
    amber: {
      bg: 'bg-amber-500 dark:bg-amber-400',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-700',
      ring: 'ring-amber-500 dark:ring-amber-400',
      hover: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
      selected: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    },
  };

  return colorMap[accentColor]?.[variant] || colorMap.kiwi[variant];
};

export const getAccentColor = (accentColor: string) => {
  return getAccentClasses(accentColor, 'bg');
};

export const getAccentText = (accentColor: string) => {
  return getAccentClasses(accentColor, 'text');
};

export const getAccentBorder = (accentColor: string) => {
  return getAccentClasses(accentColor, 'border');
};

export const getAccentRing = (accentColor: string) => {
  return getAccentClasses(accentColor, 'ring');
};

export const getAccentHover = (accentColor: string) => {
  return getAccentClasses(accentColor, 'hover');
};

export const getAccentSelected = (accentColor: string) => {
  return getAccentClasses(accentColor, 'selected');
}; 

// Get hex color for inline styles
export const getAccentHex = (accentColor: string) => {
  if (!isColorIntegrationEnabled()) {
    // Subtle neutral when integration is disabled
    return '#6b7280'; // gray-500
  }
  const hexMap: { [key: string]: string } = {
    kiwi: '#8E466D',
    orange: '#f97316',
    blue: '#3b82f6',
    green: '#22c55e',
    purple: '#a855f7',
    red: '#ef4444',
    pink: '#ec4899',
    teal: '#14b8a6',
    indigo: '#6366f1',
    cyan: '#06b6d4',
    lime: '#84cc16',
    amber: '#f59e0b',
  };
  
  return hexMap[accentColor] || hexMap.kiwi;
}; 