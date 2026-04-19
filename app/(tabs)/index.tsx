import React from 'react';
import { View, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

const EXERCISES = [
  { id: 'squat', label: 'Squat', image: require('@/assets/exercises/bodyweight-squat.png') },
  {
    id: 'bicep_curl',
    label: 'Bicep Curl',
    image: require('@/assets/exercises/dumbbell-biceps-curl.png'),
  },
  {
    id: 'shoulder_press',
    label: 'Shoulder Press',
    image: require('@/assets/exercises/seated-shoulder-press.png'),
  },
  {
    id: 'bench_press',
    label: 'Bench Press',
    image: require('@/assets/exercises/dumbbell-bench-press.png'),
  },
  {
    id: 'lat_pulldown',
    label: 'Lat Pulldown',
    image: require('@/assets/exercises/lat-pulldown.png'),
  },
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

      <ScrollView className="flex-1 px-4 pb-4">
        <View className="flex-row flex-wrap gap-3">
          {EXERCISES.map((exercise) => (
            <Button
              key={exercise.id}
              variant="outline"
              className="h-52 w-[48%] flex-col items-start justify-end p-2"
              onPress={() => openEvaluation(exercise.id as ExerciseId)}>
              <Image source={exercise.image} resizeMode="contain" className="h-30 w-full" />

              <View className="px-2">
                <Text className="text-2xl font-medium tracking-tight">{exercise.label}</Text>
              </View>
            </Button>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
