import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Light touch feedback. Phones without a vibration motor (and the web) simply ignore it.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

/** A tick for choosing something: a Bible, a book, a chapter, a tab. */
export function tapFeedback() {
  if (enabled) void Haptics.selectionAsync().catch(() => undefined);
}

/** A happy double buzz for a discovery (the hidden verse in "Acerca de"). */
export function successFeedback() {
  if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/** A soft knock for the main action of a screen (opening a Bible, continuing to read). */
export function pressFeedback() {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
