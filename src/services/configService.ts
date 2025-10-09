import defaultConfig from '../../config.json';

export interface AppConfig {
  libraryPath: string;
  requestPageSize: number;
  defaultTheme: 'light' | 'dark';
  defaultAccentColor: string;
  enableCache: boolean;
  cacheValidityHours: number;
  enablePodcastMode: boolean;
  enableColorIntegration: boolean;
  useFolderThumbnails: boolean;
  autoplayGifsInGrid: boolean;
  hideControlsWithInfoBox: boolean;
  infoBoxSize: number;
  sidebarWidth: number;
  defaultSidebarOpen: boolean;
}

class ConfigService {
  private config: AppConfig;

  constructor() {
    this.config = { ...defaultConfig } as AppConfig;
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      // Try to load from localStorage first
      const savedConfig = localStorage.getItem('app-config');
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        this.config = { ...this.config, ...parsedConfig };
      }
    } catch (error) {
      console.warn('Failed to load config from localStorage:', error);
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  public saveConfig(): void {
    try {
      localStorage.setItem('app-config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save config to localStorage:', error);
    }
  }

  public resetToDefaults(): void {
    this.config = { ...defaultConfig } as AppConfig;
    this.saveConfig();
  }

  // Convenience getters
  public get libraryPath(): string {
    return this.config.libraryPath;
  }

  public get requestPageSize(): number {
    return this.config.requestPageSize;
  }

  public get defaultTheme(): 'light' | 'dark' {
    return this.config.defaultTheme;
  }

  public get defaultAccentColor(): string {
    return this.config.defaultAccentColor;
  }

  public get enableCache(): boolean {
    return this.config.enableCache;
  }

  public get cacheValidityHours(): number {
    return this.config.cacheValidityHours;
  }

  public get enablePodcastMode(): boolean {
    return this.config.enablePodcastMode;
  }

  public get enableColorIntegration(): boolean {
    return this.config.enableColorIntegration;
  }

  public get useFolderThumbnails(): boolean {
    return this.config.useFolderThumbnails;
  }

  public get autoplayGifsInGrid(): boolean {
    return this.config.autoplayGifsInGrid;
  }

  public get hideControlsWithInfoBox(): boolean {
    return this.config.hideControlsWithInfoBox;
  }

  public get infoBoxSize(): number {
    return this.config.infoBoxSize;
  }

  public get sidebarWidth(): number {
    return this.config.sidebarWidth;
  }

  public get defaultSidebarOpen(): boolean {
    return this.config.defaultSidebarOpen;
  }
}

export const configService = new ConfigService();
