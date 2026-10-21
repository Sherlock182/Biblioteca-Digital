import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { OpenBookIcon } from '@/components/home/open-book-icon';
import type { SacredBook } from '@/constants/scripture';
import { ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Every cover is drawn at this size and scaled, so a small and a large one look exactly alike.
const BASE_WIDTH = 112;
const BASE_HEIGHT = 122;

/** Holds a base-size drawing scaled to `width`, taking up only the scaled space. */
function Scaled({ width, children }: { width: number; children: ReactNode }) {
  const scale = width / BASE_WIDTH;
  const height = BASE_HEIGHT * scale;
  return <View style={{ width, height }}>
    <View style={[styles.base, {
      left: (width - BASE_WIDTH) / 2, top: (height - BASE_HEIGHT) / 2, transform: [{ scale }],
    }]}>{children}</View>
  </View>;
}

/** The drawing inside the cover's round seal, in the cover's text color. */
function SealIcon({ book }: { book: SacredBook }) {
  const color = book.colors.text;
  if (book.icon === 'open-book') return <OpenBookIcon size={32} />;
  if (book.icon === 'church') return <MaterialIcons name="church" size={24} color={color} />;
  if (book.icon === 'book') return <MaterialIcons name="menu-book" size={22} color={color} />;
  if (book.icon === 'globe') return <MaterialIcons name="public" size={24} color={color} />;
  if (book.icon === 'flame') return <MaterialIcons name="local-fire-department" size={24} color={color} />;
  // A cross with a soft golden glow behind it.
  return <View style={styles.crossGlow}>
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M12 2.5v19M5.5 8.5h13" stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  </View>;
}

/** The cover swinging open on its left edge as `opening` goes from 0 to 1. */
function openingTransform(opening?: Animated.Value) {
  return opening ? {
    transformOrigin: 'left center' as const,
    transform: [{ perspective: 500 }, { rotateY: opening.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-118deg'] }) }],
  } : null;
}

/** A first page with lines of text, seen once the cover opens. */
function InsidePage() {
  return <View style={[StyleSheet.absoluteFill, styles.insidePage]}>
    {[78, 92, 70, 88, 64, 84, 74].map((size, index) => (
      <View key={index} style={[styles.insideLine, { width: size + '%' }, index === 0 && styles.insideHeading]} />
    ))}
  </View>;
}

/**
 * A Bible drawn as a closed book: spine, cover with its seal and short name, and the page edges.
 * With `opening`, the cover swings open to show the first page.
 */
export function BibleCover({ book, width = BASE_WIDTH, opening }: { book: SacredBook; width?: number; opening?: Animated.Value }) {
  return <Scaled width={width}>
    <View style={styles.bookShape}>
      <View style={[styles.bookSpine, { backgroundColor: book.colors.spine }]} />
      <View style={styles.coverSlot}>
        {opening && <InsidePage />}
        <Animated.View style={[StyleSheet.absoluteFill, styles.bookCover, { backgroundColor: book.colors.cover }, openingTransform(opening)]}>
          <View style={styles.bookTopBand} />
          <View style={styles.bookTopBandShade} />
          <View style={styles.bookShine} />
          <View style={styles.bookSealOuter}>
            <View style={styles.bookSealInner}>
              <SealIcon book={book} />
            </View>
          </View>
          <Text numberOfLines={1} style={styles.bookMiniTitle}>{book.shortName}</Text>
          <View style={styles.bookLine} />
          <View style={styles.bookLineThin} />
        </Animated.View>
      </View>
      <View style={styles.bookPages} />
    </View>
  </Scaled>;
}

/** The PDF library drawn as a small stack of printed pages with a red "PDF" tab. */
export function PdfStack({ width = BASE_WIDTH }: { width?: number }) {
  return <Scaled width={width}>
    <View style={styles.pdfDocumentStack}>
      <View style={[styles.pdfSheet, { transform: [{ translateY: 8 }, { translateX: 8 }] }]} />
      <View style={[styles.pdfSheet, { transform: [{ translateY: 4 }, { translateX: 4 }] }]} />
      <View style={[styles.pdfSheet, styles.pdfDocumentContainer]}>
        <View style={styles.pdfPageMain}>
          <View style={styles.pdfTextLine} />
          <View style={[styles.pdfTextLine, { width: '85%' }]} />
          <View style={[styles.pdfTextLine, { marginTop: 6, width: '90%' }]} />
          <View style={[styles.pdfTextLine, { width: '80%' }]} />
        </View>
        <View style={styles.pdfRibbon}>
          <Text style={styles.pdfRibbonText}>PDF</Text>
        </View>
      </View>
    </View>
  </Scaled>;
}

const styles = StyleSheet.create({
  base: { position: 'absolute', width: BASE_WIDTH, height: BASE_HEIGHT },
  bookShape: { width: BASE_WIDTH, height: BASE_HEIGHT, flexDirection: 'row', alignItems: 'stretch' },
  bookSpine: {
    width: 15,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  coverSlot: { flex: 1 },
  insidePage: { backgroundColor: '#FBF6EA', borderRadius: 3, paddingTop: 14, paddingHorizontal: 9, gap: 6 },
  insideLine: { height: 3, borderRadius: 2, backgroundColor: '#B9AE9C' },
  insideHeading: { height: 5, backgroundColor: '#8A7A62', alignSelf: 'center', marginBottom: 4 },
  bookCover: {
    backfaceVisibility: 'hidden',
    borderRadius: 8,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    paddingTop: 9,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  bookTopBand: { position: 'absolute', top: 0, left: 0, right: 0, height: 16, backgroundColor: 'rgba(15,10,7,0.45)' },
  bookTopBandShade: { position: 'absolute', top: 16, left: 0, right: 0, height: 5, backgroundColor: 'rgba(255,255,255,0.08)' },
  bookShine: {
    position: 'absolute',
    top: -18,
    left: -10,
    width: 34,
    height: 170,
    backgroundColor: 'rgba(255,255,255,0.13)',
    transform: [{ rotate: '12deg' }],
  },
  bookSealOuter: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(246,214,151,0.72)',
    backgroundColor: 'rgba(30,18,9,0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 4,
    elevation: 2,
  },
  bookSealInner: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,234,194,0.6)',
    backgroundColor: 'rgba(24,15,8,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossGlow: { shadowColor: '#FDE68A', shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  bookMiniTitle: {
    marginTop: 8,
    maxWidth: 72,
    fontSize: 10,
    fontWeight: '900',
    color: '#F7E5C8',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  bookLine: { marginTop: 7, width: 44, height: 3, borderRadius: 99, backgroundColor: 'rgba(255,233,191,0.56)' },
  bookLineThin: { marginTop: 4, width: 28, height: 2, borderRadius: 99, backgroundColor: 'rgba(255,233,191,0.38)' },
  bookPages: {
    width: 10,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#F3EEE4',
    borderWidth: 1,
    borderColor: '#D8CFC1',
  },
  pdfDocumentStack: { width: BASE_WIDTH, height: BASE_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  pdfSheet: {
    position: 'absolute',
    width: 100,
    height: 110,
    backgroundColor: '#F5E6C0',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#C9AC78',
  },
  pdfDocumentContainer: { backgroundColor: '#E8E8E8', borderColor: '#BBB', zIndex: 10, overflow: 'hidden' },
  pdfPageMain: { flex: 1, backgroundColor: '#FAFAFA', paddingHorizontal: 10, paddingTop: 10, justifyContent: 'flex-start' },
  pdfTextLine: { height: 3, backgroundColor: '#4A4A4A', borderRadius: 1.5, marginBottom: 5 },
  pdfRibbon: {
    backgroundColor: '#E53935',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 4,
  },
  pdfRibbonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
});
