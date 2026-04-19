import React from 'react';
import { View, ScrollView } from 'react-native';
import { Button } from '@/components/ui/button';
import {
  useSettingsStore,
  type ThemeMode,
  type ViewOption,
  type ModelOption,
  type CameraOption,
  type ModelConfigOption,
} from '@/lib/store';
import { Icon } from '@/components/ui/icon';
import { ChevronDown } from 'lucide-react-native';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const VIEW_OPTIONS: { value: ViewOption; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'incline', label: 'Incline' },
];

const MODEL_OPTIONS: { value: ModelOption; label: string }[] = [
  { value: 'lite', label: 'Lite' },
  { value: 'full', label: 'Full' },
  { value: 'heavy', label: 'Heavy' },
];

const CAMERA_OPTIONS: { value: CameraOption; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
];

const MODEL_CONFIG_OPTIONS: { value: ModelConfigOption; label: string }[] = [
  { value: 'LSTMTransformer', label: 'LSTM+Transformer' },
  { value: 'LSTM', label: 'LSTM Only' },
  { value: 'Transformer', label: 'Transformer Only' },
];

export default function SettingsScreen() {
  const {
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
  } = useSettingsStore();

  const renderDropdown = (
    value: string,
    onValueChange: (val: any) => void,
    options: { value: any; label: string }[]
  ) => {
    const selected = options.find((o) => o.value === value);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Text>{selected?.label}</Text>
            <Icon as={ChevronDown} className="text-muted-foreground h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-40">
          {options.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onPress={() => onValueChange(opt.value)}
              className={opt.value === value ? 'bg-accent' : ''}>
              <Text className="text-foreground flex-1 text-sm">{opt.label}</Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const SettingRow = ({
    title,
    description,
    children,
  }: {
    title: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <View className="flex-row items-center justify-between py-1.5">
      <View className="flex-1 pr-3">
        <Text className="text-foreground text-sm">{title}</Text>
        {description && <Text className="text-muted-foreground text-xs">{description}</Text>}
      </View>
      {children}
    </View>
  );

  return (
    <View className="bg-background flex-1 p-4">
      <ScrollView>
        <View className="border-border bg-card rounded-xl border px-3 py-2">
          <Text className="text-foreground mb-2 text-base font-semibold">Appearance</Text>
          <SettingRow title="Theme" description="Choose your preferred color scheme">
            {renderDropdown(themeMode, setThemeMode, THEME_OPTIONS)}
          </SettingRow>
        </View>

        <View className="border-border bg-card mt-2 rounded-xl border px-3 py-2">
          <Text className="text-foreground mb-2 text-base font-semibold">Vision</Text>
          <SettingRow title="Camera" description="Device camera to use">
            {renderDropdown(cameraOption, setCameraOption, CAMERA_OPTIONS)}
          </SettingRow>
          <View className="border-border border-t">
            <SettingRow title="Model" description="BlazePose detection model">
              {renderDropdown(modelOption, setModelOption, MODEL_OPTIONS)}
            </SettingRow>
          </View>
          <View className="border-border border-t">
            <SettingRow title="View" description="Camera angle for rule evaluation">
              {renderDropdown(viewOption, setViewOption, VIEW_OPTIONS)}
            </SettingRow>
          </View>
          <View className="border-border border-t">
            <SettingRow title="Engine Config" description="Rule config for evaluation">
              {renderDropdown(modelConfig, setModelConfig, MODEL_CONFIG_OPTIONS)}
            </SettingRow>
          </View>
        </View>

        <View className="border-border bg-card mt-2 rounded-xl border px-3 py-2">
          <Text className="text-foreground mb-2 text-base font-semibold">Debug</Text>
          <SettingRow title="Debug Mode" description="Show debug information during evaluation">
            <Switch checked={debugMode} onCheckedChange={setDebugMode} />
          </SettingRow>
        </View>
      </ScrollView>
    </View>
  );
}
