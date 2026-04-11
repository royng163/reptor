import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

const EXERCISES = [
  { id: 'squat', label: 'Squat' },
  { id: 'bicep_curl', label: 'Bicep Curl' },
  { id: 'shoulder_press', label: 'Shoulder Press' },
  { id: 'bench_press', label: 'Bench Press' },
  { id: 'lat_pulldown', label: 'Lat Pulldown' },
] as const;

type ExerciseId = (typeof EXERCISES)[number]['id'];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const openEvaluation = (exerciseId: ExerciseId) => {
    router.push({
      pathname: '/evaluation',
      params: { exerciseId },
    });
  };

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-4 pb-6">
        <Text className="text-foreground text-xl font-semibold">Select an Exercise</Text>
      </View>

      <ScrollView className="flex-1 px-4 pb-4" contentContainerStyle={{ gap: 3 }}>
        <View className="flex-row flex-wrap gap-3">
          {EXERCISES.map((exercise) => (
            <Button
              key={exercise.id}
              variant="outline"
              className="h-48 w-[48%] items-end justify-start p-4"
              onPress={() => openEvaluation(exercise.id as ExerciseId)}>
              <Text className="text-3xl font-medium tracking-tight">{exercise.label}</Text>
            </Button>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
