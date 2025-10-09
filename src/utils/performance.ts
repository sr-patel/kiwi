/**
 * Performance monitoring utilities
 */

import React from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  itemCount: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 100; // Keep only last 100 measurements

  /**
   * Measure render performance
   */
  measureRender<T>(
    componentName: string,
    renderFn: () => T,
    itemCount: number = 0
  ): T {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    const result = renderFn();
    
    const endTime = performance.now();
    const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    const renderTime = endTime - startTime;
    const memoryUsage = endMemory - startMemory;
    
    this.recordMetric({
      renderTime,
      memoryUsage,
      itemCount,
      timestamp: Date.now(),
    });
    
    // Log performance warnings
    if (renderTime > 16) { // More than one frame (60fps)
      console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms for ${itemCount} items`);
    }
    
    if (memoryUsage > 10 * 1024 * 1024) { // More than 10MB
      console.warn(`High memory usage detected in ${componentName}: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    }
    
    return result;
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    if (this.metrics.length === 0) {
      return {
        averageRenderTime: 0,
        averageMemoryUsage: 0,
        totalMeasurements: 0,
        slowRenders: 0,
        highMemoryUsage: 0,
      };
    }

    const totalRenderTime = this.metrics.reduce((sum, m) => sum + m.renderTime, 0);
    const totalMemoryUsage = this.metrics.reduce((sum, m) => sum + m.memoryUsage, 0);
    const slowRenders = this.metrics.filter(m => m.renderTime > 16).length;
    const highMemoryUsage = this.metrics.filter(m => m.memoryUsage > 10 * 1024 * 1024).length;

    return {
      averageRenderTime: totalRenderTime / this.metrics.length,
      averageMemoryUsage: totalMemoryUsage / this.metrics.length,
      totalMeasurements: this.metrics.length,
      slowRenders,
      highMemoryUsage,
    };
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Higher-order component for performance monitoring
 */
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return React.memo((props: P) => {
    return performanceMonitor.measureRender(
      componentName,
      () => React.createElement(Component, props),
      (props as any).itemCount || 0
    );
  });
}

/**
 * Hook for measuring component performance
 */
export function usePerformanceMonitoring(componentName: string, itemCount: number = 0) {
  const startTime = React.useRef<number>(0);
  const startMemory = React.useRef<number>(0);

  React.useEffect(() => {
    startTime.current = performance.now();
    startMemory.current = (performance as any).memory?.usedJSHeapSize || 0;
  });

  React.useEffect(() => {
    const endTime = performance.now();
    const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    const renderTime = endTime - startTime.current;
    const memoryUsage = endMemory - startMemory.current;
    
    performanceMonitor.recordMetric({
      renderTime,
      memoryUsage,
      itemCount,
      timestamp: Date.now(),
    });
  });
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}