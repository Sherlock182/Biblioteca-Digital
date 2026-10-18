import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sheet } from '@/components/ui/sheet';
import { IOS_VOICE_STEPS, loadSpanishVoices, openVoiceInstaller, speakUtterance } from '@/constants/speech-engine';
import { pickVoice, PITCH_RANGE, RankedVoice, RATE_RANGE, SpeechSettings } from '@/constants/speech-voices';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppTheme, mergeStyles, useAppSettings } from '@/constants/app-settings';
import { isBackgroundReadingAvailable } from '@/modules/reader-audio';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

const SAMPLE = 'Hola. Así sonará la lectura de tus documentos.';

/** Sheet colors for the chosen theme; the classic theme is the original design. */
function sheetTheme(theme: AppTheme) {
  if (theme.id === 'clasico') {
    return { styles: baseStyles, spinner: '#79583C', accent: '#65482F', track: { true: '#A6814D', false: '#DDD1BF' }, thumb: '#FFF' };
  }
  const ui = theme.ui;
  return {
    spinner: ui.accent, accent: ui.primary, track: { true: ui.accent, false: ui.border }, thumb: ui.card,
    styles: mergeStyles(baseStyles, {
      sheet: { backgroundColor: ui.page }, title: { color: ui.text }, closeText: { color: ui.text },
      section: { color: ui.accent }, muted: { color: ui.muted },
      voice: { backgroundColor: ui.card, borderColor: ui.border }, voiceActive: { borderColor: ui.primary, backgroundColor: ui.soft },
      radio: { borderColor: ui.muted }, radioActive: { borderColor: ui.primary, backgroundColor: ui.primary },
      voiceLabel: { color: ui.text }, warning: { color: ui.danger }, playText: { color: ui.primary },
      stepLabel: { color: ui.text }, stepButton: { backgroundColor: ui.soft }, stepSign: { color: ui.text }, stepValue: { color: ui.text },
      switchRow: { backgroundColor: ui.card, borderColor: ui.border },
      banner: { backgroundColor: ui.notice }, bannerText: { color: ui.noticeText },
      bannerButton: { backgroundColor: ui.primary }, bannerButtonText: { color: ui.primaryText },
      linkText: { color: ui.primary }, help: { color: ui.muted },
    }),
  };
}

function Step({ label, value, onMinus, onPlus, minusDisabled, plusDisabled }: {
  label: string; value: string; onMinus: () => void; onPlus: () => void; minusDisabled: boolean; plusDisabled: boolean;
}) {
  const { theme } = useAppSettings();
  const { styles } = useMemo(() => sheetTheme(theme), [theme]);
  return <View style={styles.stepRow}>
    <Text style={styles.stepLabel}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={'Bajar ' + label} disabled={minusDisabled} onPress={onMinus}
      style={({ pressed }) => [styles.stepButton, (minusDisabled || pressed) && styles.dimmed]}><Text style={styles.stepSign}>−</Text></Pressable>
    <Text style={styles.stepValue}>{value}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={'Subir ' + label} disabled={plusDisabled} onPress={onPlus}
      style={({ pressed }) => [styles.stepButton, (plusDisabled || pressed) && styles.dimmed]}><Text style={styles.stepSign}>+</Text></Pressable>
  </View>;
}

export function VoiceSettingsSheet({ visible, settings, onChange, onClose }: {
  visible: boolean; settings: SpeechSettings; onChange: (settings: SpeechSettings) => void; onClose: () => void;
}) {
  const [voices, setVoices] = useState<RankedVoice[] | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [help, setHelp] = useState('');
  const mounted = useRef(true);
  const { theme } = useAppSettings();
  const { styles, spinner, accent, track, thumb } = useMemo(() => sheetTheme(theme), [theme]);
  useEffect(() => () => { mounted.current = false; }, []);

  // The previous list stays visible while refreshing; the spinner only shows on first load.
  const refresh = useCallback(async () => {
    const list = await loadSpanishVoices();
    if (mounted.current) setVoices(list);
  }, []);
  useEffect(() => { if (visible) void refresh(); }, [visible, refresh]);

  const stopPreview = useCallback(() => { setPreviewing(null); return Speech.stop().catch(() => undefined); }, []);
  const close = () => { void stopPreview(); setHelp(''); onClose(); };
  const preview = async (voiceId: string | null) => {
    const key = voiceId || 'default';
    await stopPreview();
    setPreviewing(key);
    try { await speakUtterance(SAMPLE, { voiceId, rate: settings.rate, pitch: settings.pitch }); }
    catch { if (mounted.current && voiceId) setFailed(current => ({ ...current, [voiceId]: true })); }
    finally { if (mounted.current) setPreviewing(current => current === key ? null : current); }
  };
  const install = async () => {
    await stopPreview();
    const opened = await openVoiceInstaller();
    if (Platform.OS === 'ios') setHelp(IOS_VOICE_STEPS);
    else if (!opened) setHelp('Busca en Ajustes: "Salida de texto a voz" → Motor de Google → Instalar datos de voz → Español.');
    // The installer screen returns here when closed: pick up newly downloaded voices.
    void refresh();
  };

  const insets = useSafeAreaInsets();
  const selected = voices ? pickVoice(voices, settings.voiceId) : null;
  const hasEnhanced = !!voices?.some(voice => voice.enhanced);
  const change = (patch: Partial<SpeechSettings>) => onChange({ ...settings, ...patch });
  const round = (value: number) => Math.round(value * 100) / 100;
  const pitchLabel = settings.pitch === 1 ? 'Normal' : settings.pitch < 1 ? 'Más grave' : 'Más agudo';

  return <Sheet visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={close}>
    <Pressable style={styles.backdrop} accessibilityLabel="Cerrar ajustes de voz" onPress={close} />
    <View style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajustes de voz</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={close} style={styles.close}><Text style={styles.closeText}>✕</Text></Pressable>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.stepLabel}>Seguir leyendo con la pantalla apagada</Text>
          <Text style={styles.muted}>{isBackgroundReadingAvailable
            ? 'Muestra controles en la notificación y en la pantalla de bloqueo.'
            : 'Disponible en la app instalada (APK). En Expo Go la lectura se detiene al salir de la app.'}</Text>
        </View>
        <Switch accessibilityLabel="Seguir leyendo con la pantalla apagada" disabled={!isBackgroundReadingAvailable}
          value={isBackgroundReadingAvailable && settings.background} onValueChange={background => change({ background })}
          trackColor={track} thumbColor={thumb} />
      </View>
      <Text style={styles.section}>VOZ</Text>
      {voices === null ? <View style={styles.loading}><ActivityIndicator color={spinner} /><Text style={styles.muted}>Buscando voces del teléfono…</Text></View>
        : <View style={styles.listContent}>
          {voices.length === 0 && <Text style={styles.muted}>No se encontraron voces en español. Se usará la voz predeterminada del teléfono.</Text>}
          {voices.map(voice => {
            const active = selected?.identifier === voice.identifier;
            const broken = failed[voice.identifier];
            return <View key={voice.identifier} style={[styles.voice, active && styles.voiceActive]}>
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={voice.label}
                onPress={() => change({ voiceId: voice.identifier })} style={styles.voiceMain}>
                <View style={[styles.radio, active && styles.radioActive]} />
                <View style={styles.voiceText}>
                  <Text style={styles.voiceLabel}>{voice.label}</Text>
                  {broken && <Text style={styles.warning}>No respondió en la prueba. Si falla al leer, se usará otra voz.</Text>}
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={'Probar ' + voice.label} onPress={() => void preview(voice.identifier)} style={styles.play}>
                {previewing === voice.identifier ? <ActivityIndicator size="small" color={accent} /> : <Text style={styles.playText}>▶</Text>}
              </Pressable>
            </View>;
          })}
        </View>}
      <Step label="Velocidad" value={settings.rate + '×'}
        minusDisabled={settings.rate <= RATE_RANGE.min} plusDisabled={settings.rate >= RATE_RANGE.max}
        onMinus={() => change({ rate: round(Math.max(RATE_RANGE.min, settings.rate - RATE_RANGE.step)) })}
        onPlus={() => change({ rate: round(Math.min(RATE_RANGE.max, settings.rate + RATE_RANGE.step)) })} />
      <Step label="Tono" value={pitchLabel + (settings.pitch === 1 ? '' : ' (' + settings.pitch.toFixed(1) + ')')}
        minusDisabled={settings.pitch <= PITCH_RANGE.min} plusDisabled={settings.pitch >= PITCH_RANGE.max}
        onMinus={() => change({ pitch: round(Math.max(PITCH_RANGE.min, settings.pitch - PITCH_RANGE.step)) })}
        onPlus={() => change({ pitch: round(Math.min(PITCH_RANGE.max, settings.pitch + PITCH_RANGE.step)) })} />
      {voices !== null && !hasEnhanced && <View style={styles.banner}>
        <Text style={styles.bannerText}>{voices.length ? 'Tu teléfono no tiene voces de alta calidad en español.' : 'Tu teléfono no tiene una voz en español instalada.'} Puedes descargar una gratis; después funciona sin internet.</Text>
        <Pressable accessibilityRole="button" onPress={() => void install()} style={styles.bannerButton}><Text style={styles.bannerButtonText}>Instalar voz gratis</Text></Pressable>
      </View>}
      {voices !== null && hasEnhanced && <Pressable accessibilityRole="button" onPress={() => void install()} style={styles.link}>
        <Text style={styles.linkText}>Descargar más voces del teléfono</Text>
      </Pressable>}
      {!!help && <Text style={styles.help}>{help}</Text>}
      </ScrollView>
    </View>
  </Sheet>;
}

const baseStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0006' },
  sheet: { backgroundColor: '#F7F3EB', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28, gap: 10, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 19, fontWeight: '700', color: '#30271F' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 18, color: '#65482F' },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: '#876B50' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  body: { flexGrow: 0, flexShrink: 1 }, bodyContent: { gap: 10, paddingBottom: 8 }, listContent: { gap: 8 },
  muted: { color: '#6C5D4E', fontSize: 13, lineHeight: 19 },
  voice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFDF9', borderRadius: 14, borderWidth: 1, borderColor: '#E5DCCF' },
  voiceActive: { borderColor: '#65482F', backgroundColor: '#F3EBDD' },
  voiceMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 52 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#A08A70' },
  radioActive: { borderColor: '#65482F', backgroundColor: '#65482F' },
  voiceText: { flex: 1, gap: 2 }, voiceLabel: { color: '#30271F', fontSize: 14, fontWeight: '600' },
  warning: { color: '#8E5447', fontSize: 11 },
  play: { minWidth: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  playText: { color: '#65482F', fontSize: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  stepLabel: { flex: 1, color: '#30271F', fontSize: 15, fontWeight: '600' },
  stepButton: { minWidth: 44, minHeight: 44, borderRadius: 12, backgroundColor: '#EBE3D6', alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontSize: 20, color: '#493725' },
  stepValue: { minWidth: 110, textAlign: 'center', color: '#493725', fontSize: 14, fontWeight: '600' },
  dimmed: { opacity: 0.4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#FFFDF9', borderRadius: 14, borderWidth: 1, borderColor: '#E5DCCF' },
  switchText: { flex: 1, gap: 2 },
  banner: { backgroundColor: '#FFF0CD', borderRadius: 14, padding: 12, gap: 10, marginTop: 4 },
  bannerText: { color: '#65482F', fontSize: 13, lineHeight: 19 },
  bannerButton: { backgroundColor: '#65482F', borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  bannerButtonText: { color: '#FFF', fontWeight: '700' },
  link: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  linkText: { color: '#65482F', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  help: { color: '#6C5D4E', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
