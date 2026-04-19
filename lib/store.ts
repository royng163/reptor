import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Uniwind } from 'uniwind';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ViewOption = 'front' | 'side' | 'incline';
export type ModelOption = 'lite' | 'full' | 'heavy';
export type CameraOption = 'front' | 'back';
export type ModelConfigOption = 'LSTMTransformer' | 'LSTM' | 'Transformer';

interface SettingsState {
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  viewOption: ViewOption;
  setViewOption: (view: ViewOption) => void;
  modelOption: ModelOption;
  setModelOption: (model: ModelOption) => void;
  cameraOption: CameraOption;
  setCameraOption: (camera: CameraOption) => void;
  modelConfig: ModelConfigOption;
  setModelConfig: (config: ModelConfigOption) => void;
}

const STORAGE_KEY = '@reptor_settings';

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [debugMode, setDebugModeState] = useState(true);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [viewOption, setViewOptionState] = useState<ViewOption>('front');
  const [modelOption, setModelOptionState] = useState<ModelOption>('full');
  const [cameraOption, setCameraOptionState] = useState<CameraOption>('front');
  const [modelConfig, setModelConfigState] = useState<ModelConfigOption>('LSTMTransformer');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.debugMode !== undefined) setDebugModeState(parsed.debugMode);
          if (parsed.themeMode) setThemeModeState(parsed.themeMode);
          if (parsed.viewOption) setViewOptionState(parsed.viewOption);
          if (parsed.modelOption) setModelOptionState(parsed.modelOption);
          if (parsed.cameraOption) setCameraOptionState(parsed.cameraOption);
          if (parsed.modelConfig) setModelConfigState(parsed.modelConfig);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  // Save settings to AsyncStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    const saveSettings = async () => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            debugMode,
            themeMode,
            viewOption,
            modelOption,
            cameraOption,
            modelConfig,
          })
        );
      } catch (e) {
        console.error('Failed to save settings:', e);
      }
    };
    saveSettings();
  }, [debugMode, themeMode, viewOption, modelOption, cameraOption, modelConfig, isLoaded]);

  // Apply theme
  useEffect(() => {
    if (!isLoaded) return;
    Uniwind.setTheme(themeMode);
  }, [themeMode, isLoaded]);

  const setDebugMode = (enabled: boolean) => setDebugModeState(enabled);
  const setThemeMode = (mode: ThemeMode) => setThemeModeState(mode);
  const setViewOption = (view: ViewOption) => setViewOptionState(view);
  const setModelOption = (model: ModelOption) => setModelOptionState(model);
  const setCameraOption = (camera: CameraOption) => setCameraOptionState(camera);
  const setModelConfig = (config: ModelConfigOption) => setModelConfigState(config);

  const value: SettingsState = {
    debugMode,
    setDebugMode,
    themeMode,
    setThemeMode,
    viewOption,
    setViewOption,
    modelOption,
    setModelOption,
    cameraOption,
    setCameraOption,
    modelConfig,
    setModelConfig,
  };

  return React.createElement(SettingsContext.Provider, { value }, children);
}

export function useSettingsStore(): SettingsState {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsStore must be used within a SettingsProvider');
  }
  return context;
}
