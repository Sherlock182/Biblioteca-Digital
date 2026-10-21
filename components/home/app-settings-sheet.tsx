import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Sheet } from '@/components/ui/sheet';
import { AppInfoSheet } from '@/components/home/app-info-sheet';
import { AppTheme, GARAMOND, mergeStyles, READER_FONTS, TEXT_SIZES, THEMES, useAppSettings, VERSE_LAYOUTS } from '@/constants/app-settings';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: undefined });

/** The sheet itself follows the selected theme, so the change is visible right away. */
function sheetTheme(theme: AppTheme) {
  const ui = theme.ui;
  return {
    accent: ui.primary, idle: ui.muted,
    styles: mergeStyles(baseStyles, {
      sheet: { backgroundColor: ui.page }, title: { color: ui.text }, section: { color: ui.accent },
      theme: { backgroundColor: ui.card, borderColor: ui.border }, themeActive: { borderColor: ui.primary, backgroundColor: ui.soft },
      themeName: { color: ui.text }, themeDescription: { color: ui.muted },
      size: { backgroundColor: ui.card, borderColor: ui.border }, sizeActive: { borderColor: ui.primary, backgroundColor: ui.primary },
      choice: { backgroundColor: ui.card, borderColor: ui.border }, choiceTitle: { color: ui.text },
      sizeLetter: { color: ui.text }, sizeLabel: { color: ui.muted }, sizeTextActive: { color: ui.primaryText },
      preview: { borderColor: ui.border }, note: { color: ui.muted },
      about: { backgroundColor: ui.card, borderColor: ui.border }, aboutText: { color: ui.text },
    }),
  };
}

export function AppSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, theme, setTheme, setTextScale, setReaderFont, setVerseLayout } = useAppSettings();
  const reader = theme.reader;
  const previewFont = settings.readerFont === 'libro' ? { fontFamily: GARAMOND.regular } : null;
  const { styles, accent, idle } = sheetTheme(theme);
  const insets = useSafeAreaInsets();
  const [infoOpen, setInfoOpen] = useState(false);
  return <Sheet visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} accessibilityLabel="Cerrar ajustes" onPress={onClose} />
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajustes</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={styles.close}>
          <MaterialIcons name="close" size={22} color={accent} />
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.body, { paddingBottom: 34 + insets.bottom }]}>
        <Text style={styles.section}>TEMA</Text>
        {THEMES.map(item => {
          const active = item.id === settings.themeId;
          return <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={'Tema ' + item.name}
            onPress={() => setTheme(item.id)} style={({ pressed }) => [styles.theme, active && styles.themeActive, pressed && styles.pressed]}>
            <View style={[styles.swatch, { backgroundColor: item.home.page }]}>
              <View style={[styles.swatchCard, { backgroundColor: item.home.card }]}>
                <View style={[styles.swatchAccent, { backgroundColor: item.home.accent }]} />
              </View>
              <View style={[styles.swatchPage, { backgroundColor: item.reader.page }]}>
                <View style={[styles.swatchLine, { backgroundColor: item.reader.text }]} />
                <View style={[styles.swatchLine, styles.swatchLineShort, { backgroundColor: item.reader.number }]} />
              </View>
            </View>
            <View style={styles.themeText}>
              <Text style={styles.themeName}>{item.name}{item.id === 'clasico' ? ' (actual de la app)' : ''}</Text>
              <Text style={styles.themeDescription}>{item.description}</Text>
            </View>
            <MaterialIcons name={active ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={active ? accent : idle} />
          </Pressable>;
        })}

        <Text style={[styles.section, styles.sectionSpaced]}>TAMAÑO DEL TEXTO DE LAS BIBLIAS</Text>
        <View style={styles.sizes}>
          {TEXT_SIZES.map(size => {
            const active = size.scale === settings.textScale;
            return <Pressable key={size.id} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={'Texto ' + size.label}
              onPress={() => setTextScale(size.scale)} style={({ pressed }) => [styles.size, active && styles.sizeActive, pressed && styles.pressed]}>
              <Text style={[styles.sizeLetter, { fontSize: 13 * size.scale + 2 }, active && styles.sizeTextActive]}>A</Text>
              <Text style={[styles.sizeLabel, active && styles.sizeTextActive]} numberOfLines={1}>{size.label}</Text>
            </Pressable>;
          })}
        </View>
        <Text style={[styles.section, styles.sectionSpaced]}>LETRA DE LA BIBLIA</Text>
        <View style={styles.sizes}>
          {READER_FONTS.map(font => {
            const active = font.id === settings.readerFont;
            return <Pressable key={font.id} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={'Letra ' + font.label}
              onPress={() => setReaderFont(font.id)} style={({ pressed }) => [styles.choice, active && styles.sizeActive, pressed && styles.pressed]}>
              <Text style={[styles.choiceTitle, { fontFamily: font.id === 'libro' ? GARAMOND.regular : SERIF }, active && styles.sizeTextActive]}>{font.label}</Text>
              <Text style={[styles.sizeLabel, active && styles.sizeTextActive]} numberOfLines={1}>{font.description}</Text>
            </Pressable>;
          })}
        </View>

        <Text style={[styles.section, styles.sectionSpaced]}>FORMA DE LECTURA</Text>
        <View style={styles.sizes}>
          {VERSE_LAYOUTS.map(layout => {
            const active = layout.id === settings.verseLayout;
            return <Pressable key={layout.id} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={'Lectura ' + layout.label}
              onPress={() => setVerseLayout(layout.id)} style={({ pressed }) => [styles.choice, active && styles.sizeActive, pressed && styles.pressed]}>
              <MaterialIcons name={layout.id === 'parrafo' ? 'notes' : 'format-list-numbered'} size={20} color={active ? theme.ui.primaryText : accent} />
              <Text style={[styles.choiceTitle, active && styles.sizeTextActive]}>{layout.label}</Text>
              <Text style={[styles.sizeLabel, active && styles.sizeTextActive]} numberOfLines={1}>{layout.description}</Text>
            </Pressable>;
          })}
        </View>

        {/* Preview of the reader with every choice above. */}
        <View style={[styles.preview, { backgroundColor: reader.page }]}>
          {settings.verseLayout === 'parrafo' ? (
            <Text style={[styles.previewText, previewFont, { color: reader.text, fontSize: 18 * settings.textScale, lineHeight: 30 * settings.textScale }]}>
              <Text style={{ color: reader.number, fontSize: 11 * settings.textScale, fontWeight: '700' }}>1 </Text>
              En el principio creó Dios los cielos y la tierra.{' '}
              <Text style={{ color: reader.number, fontSize: 11 * settings.textScale, fontWeight: '700' }}>2 </Text>
              Y la tierra estaba desordenada y vacía…
            </Text>
          ) : <>
            <Text style={[styles.previewNumber, { color: reader.number, fontSize: 15 * settings.textScale, lineHeight: 30 * settings.textScale }]}>1</Text>
            <Text style={[styles.previewText, previewFont, { color: reader.text, fontSize: 18 * settings.textScale, lineHeight: 30 * settings.textScale }]}>
              En el principio creó Dios los cielos y la tierra.
            </Text>
          </>}
        </View>
        <Text style={styles.note}>Solo cambia el texto de las Biblias. El lector de PDF mantiene su propio zoom.</Text>

        <Text style={[styles.section, styles.sectionSpaced]}>INFORMACIÓN</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Acerca de la app" onPress={() => setInfoOpen(true)}
          style={({ pressed }) => [styles.about, pressed && styles.pressed]}>
          <MaterialIcons name="info-outline" size={22} color={accent} />
          <Text style={styles.aboutText}>Acerca de la app</Text>
          <MaterialIcons name="chevron-right" size={22} color={idle} />
        </Pressable>
      </ScrollView>
    </View>
    {/* Nested so it opens on top of the settings sheet and returns to it when closed. */}
    <AppInfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} />
  </Sheet>;
}

const baseStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0007' },
  sheet: { backgroundColor: '#F7F3EB', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, maxHeight: '88%' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#30271F' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  body: { padding: 20, paddingTop: 8, paddingBottom: 34, gap: 10 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#876B50' },
  sectionSpaced: { marginTop: 12 },
  theme: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16,
    backgroundColor: '#FFFDF9', borderWidth: 1.5, borderColor: '#E5DCCF',
  },
  themeActive: { borderColor: '#65482F', backgroundColor: '#F3EBDD' },
  pressed: { opacity: 0.8 },
  swatch: { width: 64, height: 48, borderRadius: 12, padding: 5, flexDirection: 'row', gap: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#0001' },
  swatchCard: { flex: 1, borderRadius: 6, justifyContent: 'flex-end', padding: 4 },
  swatchAccent: { height: 4, borderRadius: 2, width: '70%' },
  swatchPage: { flex: 1, borderRadius: 6, padding: 4, gap: 3, justifyContent: 'center' },
  swatchLine: { height: 3, borderRadius: 2 },
  swatchLineShort: { width: '60%' },
  themeText: { flex: 1, gap: 2 },
  themeName: { fontSize: 15, fontWeight: '700', color: '#30271F' },
  themeDescription: { fontSize: 12, color: '#7C6B58' },
  sizes: { flexDirection: 'row', gap: 6 },
  size: {
    flex: 1, minHeight: 58, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: '#FFFDF9', borderWidth: 1.5, borderColor: '#E5DCCF',
  },
  sizeActive: { borderColor: '#65482F', backgroundColor: '#65482F' },
  choice: {
    flex: 1, minHeight: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 6,
    backgroundColor: '#FFFDF9', borderWidth: 1.5, borderColor: '#E5DCCF',
  },
  choiceTitle: { fontSize: 16, fontWeight: '700', color: '#4A3625' },
  sizeLetter: { fontWeight: '800', color: '#4A3625', fontFamily: SERIF },
  sizeLabel: { fontSize: 9, color: '#7C6B58', fontWeight: '600' },
  sizeTextActive: { color: '#FFF' },
  preview: { flexDirection: 'row', gap: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E5DCCF' },
  previewNumber: { fontWeight: '700', fontFamily: SERIF },
  previewText: { flex: 1, fontFamily: SERIF },
  note: { fontSize: 12, color: '#7C6B58', lineHeight: 18 },
  about: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
    backgroundColor: '#FFFDF9', borderWidth: 1.5, borderColor: '#E5DCCF',
  },
  aboutText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#30271F' },
});
