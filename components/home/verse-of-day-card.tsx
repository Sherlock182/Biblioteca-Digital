import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AppTheme } from '@/constants/app-settings';
import { expandForSpeech } from '@/constants/pdf-speech-text';
import { loadSpeechSettings, speakWithFallback } from '@/constants/speech-engine';
import { DailyVerse, getVerseOfDay } from '@/constants/verse-of-day';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: undefined });
const today = () => new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

export function VerseOfDayCard({ theme }: { theme: AppTheme }) {
  const colors = theme.home;
  const [verse, setVerse] = useState<DailyVerse | null | undefined>(undefined);
  const [speaking, setSpeaking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareCard = useRef<View>(null);
  const session = useRef(0);

  useEffect(() => {
    let alive = true;
    void getVerseOfDay().then(result => { if (alive) setVerse(result); });
    return () => { alive = false; };
  }, []);

  const stop = useCallback(() => {
    session.current += 1;
    setSpeaking(false);
    void Speech.stop().catch(() => undefined);
  }, []);
  // Leaving the home screen stops the reading.
  useFocusEffect(useCallback(() => stop, [stop]));

  const listen = async () => {
    if (!verse) return;
    if (speaking) { stop(); return; }
    const mine = ++session.current;
    setSpeaking(true);
    try {
      const { voiceId, rate, pitch } = await loadSpeechSettings();
      for (const part of [expandForSpeech(verse.text), expandForSpeech(verse.reference)]) {
        if (mine !== session.current) return;
        await speakWithFallback(part, { voiceId, rate, pitch, isActive: () => mine === session.current });
      }
    } catch { /* the phone's voice is unavailable: just stop */ }
    if (mine === session.current) setSpeaking(false);
  };

  const share = async () => {
    if (!verse || sharing) return;
    const message = '“' + verse.text + '”\n— ' + verse.reference + ' (RV1960)';
    setSharing(true);
    try {
      const uri = await captureRef(shareCard, { format: 'png', quality: 1, result: 'tmpfile', width: 1080 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir versículo', UTI: 'public.png' });
      } else await Share.share({ message });
    } catch {
      // Could not draw the image on this phone: share it as text instead.
      await Share.share({ message }).catch(() => undefined);
    } finally { setSharing(false); }
  };

  return <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.panelBorder }]}>
    <View style={styles.header}>
      <MaterialIcons name="wb-sunny" size={16} color={colors.accent} />
      <Text style={[styles.kicker, { color: colors.accent }]}>VERSÍCULO DEL DÍA</Text>
      <Text style={[styles.date, { color: colors.muted }]} numberOfLines={1}>{today()}</Text>
    </View>
    {verse === undefined ? <ActivityIndicator color={colors.accent} style={styles.loading} />
      : verse === null ? <Text style={[styles.text, { color: colors.panelText }]}>No se pudo cargar el versículo de hoy.</Text>
      : <>
        <Text style={[styles.text, { color: colors.panelText }]}>“{verse.text}”</Text>
        <Text style={[styles.reference, { color: colors.accent }]}>{verse.reference}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={speaking ? 'Detener' : 'Escuchar versículo'} onPress={() => void listen()}
            style={({ pressed }) => [styles.action, { borderColor: colors.panelBorder }, pressed && styles.pressed]}>
            <MaterialIcons name={speaking ? 'stop' : 'volume-up'} size={18} color={colors.panelText} />
            <Text style={[styles.actionText, { color: colors.panelText }]}>{speaking ? 'Detener' : 'Escuchar'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Compartir versículo" onPress={() => void share()} disabled={sharing}
            style={({ pressed }) => [styles.action, { borderColor: colors.panelBorder }, (pressed || sharing) && styles.pressed]}>
            {sharing ? <ActivityIndicator size="small" color={colors.panelText} /> : <MaterialIcons name="share" size={18} color={colors.panelText} />}
            <Text style={[styles.actionText, { color: colors.panelText }]}>Compartir</Text>
          </Pressable>
        </View>
      </>}
    {verse && <View pointerEvents="none" style={styles.offscreen}>
      {/* Drawn off screen and captured as the shared image. */}
      <View ref={shareCard} collapsable={false} style={[styles.shareCard, { backgroundColor: theme.home.card }]}>
        <View style={[styles.shareFrame, { borderColor: theme.home.accent }]}>
          <Text style={[styles.shareKicker, { color: theme.home.accent }]}>VERSÍCULO DEL DÍA</Text>
          <Text style={[styles.shareText, { color: theme.home.text }]}>“{verse.text}”</Text>
          <View style={[styles.shareRule, { backgroundColor: theme.home.accent }]} />
          <Text style={[styles.shareReference, { color: theme.home.accent }]}>{verse.reference}</Text>
          <Text style={[styles.shareVersion, { color: theme.home.muted }]}>Reina Valera 1960</Text>
          <Text style={[styles.shareBrand, { color: theme.home.muted }]}>Biblioteca Digital</Text>
        </View>
      </View>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 18, borderWidth: 1, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  date: { flex: 1, textAlign: 'right', fontSize: 11 },
  loading: { paddingVertical: 18 },
  text: { fontSize: 17, lineHeight: 26, fontStyle: 'italic', fontFamily: SERIF },
  reference: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  action: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  offscreen: { position: 'absolute', left: -2000, top: 0 },
  shareCard: { width: 360, padding: 18 },
  shareFrame: { borderWidth: 1.5, borderRadius: 16, paddingVertical: 34, paddingHorizontal: 24, alignItems: 'center', gap: 14 },
  shareKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  shareText: { fontSize: 21, lineHeight: 31, textAlign: 'center', fontStyle: 'italic', fontFamily: SERIF },
  shareRule: { width: 44, height: 2, borderRadius: 2 },
  shareReference: { fontSize: 16, fontWeight: '800' },
  shareVersion: { fontSize: 11, letterSpacing: 1, marginTop: -8 },
  shareBrand: { fontSize: 10, letterSpacing: 2, marginTop: 10, textTransform: 'uppercase' },
});
