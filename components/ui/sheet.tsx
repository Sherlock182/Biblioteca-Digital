import { ReactNode, useEffect, useState } from 'react';
import { Animated, BackHandler, Easing, StyleSheet, useWindowDimensions } from 'react-native';

/**
 * Drop-in replacement for the transparent React Native `Modal` used by the app's sheets. A Modal opens
 * in its own Android window, with its own system bars; this sheet is drawn inside the screen instead,
 * so it shares the screen's bars, with the same slide / fade animation and the back button closing it.
 *
 * It must be one of the last children of the screen's root view, so it covers the whole screen.
 */
export function Sheet({ visible, animationType = 'slide', onRequestClose, children }: {
  visible: boolean;
  animationType?: 'slide' | 'fade' | 'none';
  onRequestClose?: () => void;
  children: ReactNode;
  // Accepted for compatibility with Modal; the sheet always covers the screen edge to edge.
  transparent?: boolean;
  statusBarTranslucent?: boolean;
  navigationBarTranslucent?: boolean;
}) {
  const { height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));
  // Stays mounted while the closing animation runs.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: animationType === 'none' ? 0 : visible ? 260 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    return () => animation.stop();
  }, [animationType, mounted, progress, visible]);

  // Android back button closes the sheet on top (the last one opened registers last and runs first).
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose?.();
      return true;
    });
    return () => subscription.remove();
  }, [onRequestClose, visible]);

  if (!mounted) return null;
  const motion = animationType === 'slide'
    ? { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }
    : { opacity: progress };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.layer, motion]} pointerEvents={visible ? 'auto' : 'none'}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 1000, elevation: 1000 },
});
