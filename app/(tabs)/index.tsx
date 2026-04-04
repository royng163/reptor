import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

const EXERCISES = ['squat', 'bicep_curl', 'shoulder_press', 'bench_press', 'lat_pulldown'] as const;
type ExerciseId = (typeof EXERCISES)[number];

export default function HomeScreen() {
  const router = useRouter();

  const openEvaluation = (exerciseId: ExerciseId) => {
    router.push({
      pathname: '/evaluation',
      params: { exerciseId },
    });
  };

  return (
    <View className="flex-1 gap-4 p-4">
      <Text>Select Exercise</Text>

      {EXERCISES.map((id) => (
        <Button key={id} onPress={() => openEvaluation(id)} variant="outline">
          <Text className="capitalize">{id.replace(/_/g, ' ')}</Text>
        </Button>
      ))}
    </View>
  );
}
