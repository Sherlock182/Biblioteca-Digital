import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Sheet } from '@/components/ui/sheet';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AppTheme, mergeStyles, useAppSettings } from '@/constants/app-settings';
import Constants from 'expo-constants';
import { ComponentProps, useRef, useState } from 'react';
import { successFeedback, tapFeedback } from '@/constants/haptics';
import { SecretVerse } from '@/components/home/secret-verse';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type InfoRow = { icon: ComponentProps<typeof MaterialIcons>['name']; label: string; value: string; url?: string;
  /** Brand logo from FontAwesome, used instead of `icon` (e.g. GitHub). */
  brand?: ComponentProps<typeof FontAwesome>['name'];
  /** Tapping it SECRET_TAPS times reveals the hidden verse, like Android's build number. */
  secret?: boolean };

const SECRET_TAPS = 7;
/** Taps further apart than this start the count again. */
const SECRET_PAUSE_MS = 2000;

const LOGO = require('@/assets/images/logo-paloma-cielo.png');

/** Rows shown in "Acerca de". Add `url` (https:, mailto:, tel:, https://wa.me/…) to make a row tappable. */
const INFO_ROWS: InfoRow[] = [
  { icon: 'person-outline', label: 'Desarrollado por', value: 'Ing. Oseas Nahun Montalvo Rogel' },
  { icon: 'mail-outline', label: 'Correo electrónico', value: '4603642023@mail.utec.edu.sv', url: 'mailto:4603642023@mail.utec.edu.sv' },
  { icon: 'code', brand: 'github', label: 'GitHub', value: 'github.com/Sherlock182', url: 'https://github.com/Sherlock182' },
  { icon: 'info-outline', label: 'Versión', value: Constants.expoConfig?.version ?? '1.0.0', secret: true },
];

/** Same theming as the settings sheet, so both feel like one app. */
function sheetTheme(theme: AppTheme) {
  const ui = theme.ui;
  return {
    accent: ui.primary,
    styles: mergeStyles(baseStyles, {
      sheet: { backgroundColor: ui.page }, title: { color: ui.text }, appName: { color: ui.text }, church: { color: ui.muted },
      row: { backgroundColor: ui.card, borderColor: ui.border }, rowLabel: { color: ui.muted }, rowValue: { color: ui.text },
      footer: { color: ui.muted }, countdown: { color: ui.muted },
    }),
  };
}

export function AppInfoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useAppSettings();
  const { styles, accent } = sheetTheme(theme);
  const insets = useSafeAreaInsets();
  const [taps, setTaps] = useState(0);
  const [secretOpen, setSecretOpen] = useState(false);
  const lastTap = useRef(0);

  const tapVersion = () => {
    const now = Date.now();
    const count = now - lastTap.current > SECRET_PAUSE_MS ? 1 : taps + 1;
    lastTap.current = now;
    if (count >= SECRET_TAPS) {
      setTaps(0);
      successFeedback();
      setSecretOpen(true);
    } else {
      setTaps(count);
      tapFeedback();
    }
  };
  // The countdown shows from the third tap, as on Android.
  const left = SECRET_TAPS - taps;
  const countdown = taps >= 3 ? `Estás a ${left} ${left === 1 ? 'toque' : 'toques'} de un secreto` : null;

  return <Sheet visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} accessibilityLabel="Cerrar información" onPress={onClose} />
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>Acerca de</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={styles.close}>
          <MaterialIcons name="close" size={22} color={accent} />
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.body, { paddingBottom: 34 + insets.bottom }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Logo de Biblioteca Digital" />
        <Text style={styles.appName}>Biblioteca Digital</Text>
        <Text style={styles.church}>Biblias y lecturas disponibles sin internet</Text>

        {INFO_ROWS.map(row => {
          const content = <>
            {row.brand
              ? <FontAwesome name={row.brand} size={22} color={accent} style={styles.brandIcon} />
              : <MaterialIcons name={row.icon} size={22} color={accent} />}
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
            {row.url ? <MaterialIcons name="open-in-new" size={18} color={accent} /> : null}
          </>;
          if (row.secret) return <View key={row.label} style={styles.secretRow}>
            <Pressable accessibilityLabel={row.label + ': ' + row.value} onPress={tapVersion}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{content}</Pressable>
            {countdown ? <Text style={styles.countdown}>{countdown}</Text> : null}
          </View>;
          return row.url
            ? <Pressable key={row.label} accessibilityRole="link" accessibilityLabel={row.label + ': ' + row.value}
              onPress={() => Linking.openURL(row.url!)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{content}</Pressable>
            : <View key={row.label} style={styles.row}>{content}</View>;
        })}
      </ScrollView>
    </View>
    <SecretVerse visible={secretOpen} onClose={() => setSecretOpen(false)} />
  </Sheet>;
}

const baseStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0007' },
  sheet: { backgroundColor: '#F7F3EB', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, maxHeight: '88%' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#30271F' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  body: { padding: 20, paddingTop: 4, paddingBottom: 34, gap: 10 },
  logo: { width: 180, height: 180, alignSelf: 'center', marginBottom: 4 },
  appName: { fontSize: 24, fontWeight: '800', color: '#30271F', textAlign: 'center' },
  church: { fontSize: 13, color: '#7C6B58', textAlign: 'center', marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12,
    backgroundColor: '#FFFDF9', borderWidth: 1.5, borderColor: '#E5DCCF',
  },
  brandIcon: { width: 22, textAlign: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#876B50', textTransform: 'uppercase' },
  rowValue: { fontSize: 15, fontWeight: '600', color: '#30271F' },
  pressed: { opacity: 0.8 },
  secretRow: { gap: 6 },
  countdown: { fontSize: 13, fontWeight: '700', color: '#7C6B58', textAlign: 'center' },
  footer: { fontSize: 12, color: '#7C6B58', lineHeight: 18, textAlign: 'center', marginTop: 8 },
});
