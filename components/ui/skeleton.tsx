import { useEffect, useState } from 'react';
import { Animated, DimensionValue, Easing, StyleSheet, View } from 'react-native';

/** Placeholder blocks that softly pulse while their content loads, shaped like what is coming. */
export function Skeleton({ color, blocks }: {
  color: string;
  /** One entry per block: its width and height (and radius, 6 when left out). */
  blocks: { width: DimensionValue; height: number; radius?: number }[];
}) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View accessibilityLabel="Cargando" accessibilityRole="progressbar"
    style={[styles.wrap, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }) }]}>
    {blocks.map((block, index) => (
      <View key={index} style={{ width: block.width, height: block.height, borderRadius: block.radius ?? 6, backgroundColor: color }} />
    ))}
  </Animated.View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
});
