import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AppTheme } from '@/constants/app-settings';
import { displayBookName, LastReading } from '@/constants/reading-history';
import { getCollectionById } from '@/constants/scripture';
import { DimensionValue, Pressable, StyleSheet, Text, View } from 'react-native';

export function ContinueReadingCard({ reading, theme, onPress }: { reading: LastReading; theme: AppTheme; onPress: () => void }) {
  const colors = theme.home;
  const isPdf = reading.kind === 'pdf';
  const title = isPdf ? reading.title : displayBookName(reading.book) + ' ' + reading.chapter;
  const detail = isPdf
    ? 'Página ' + reading.page + ' de ' + reading.totalPages
    : getCollectionById(reading.collectionId)?.title ?? 'Biblia';
  const progress = isPdf ? Math.min(100, reading.page / Math.max(1, reading.totalPages) * 100) : null;
  return <Pressable accessibilityRole="button" accessibilityLabel={'Continuar leyendo ' + title} onPress={onPress}
    style={({ pressed }) => [styles.card, { backgroundColor: colors.panel, borderColor: colors.panelBorder }, pressed && styles.pressed]}>
    <View style={[styles.icon, { backgroundColor: colors.accent }]}>
      <MaterialIcons name={isPdf ? 'description' : 'menu-book'} size={22} color={colors.card} />
    </View>
    <View style={styles.body}>
      <Text style={[styles.kicker, { color: colors.accent }]}>CONTINUAR LEYENDO</Text>
      <Text style={[styles.title, { color: colors.panelText }]} numberOfLines={1}>{title}</Text>
      <Text style={[styles.detail, { color: colors.muted }]} numberOfLines={1}>{detail}</Text>
      {progress !== null && <View style={[styles.track, { backgroundColor: colors.panelBorder }]}>
        <View style={[styles.fill, { backgroundColor: colors.accent, width: (progress + '%') as DimensionValue }]} />
      </View>}
    </View>
    <MaterialIcons name="play-circle-filled" size={34} color={colors.accent} />
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  title: { fontSize: 16, fontWeight: '700' },
  detail: { fontSize: 12 },
  track: { height: 3, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 3 },
});
