import { ReactNode, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';

/** A piece of the text with its own style and touch handlers (a verse, its number, a note mark…). */
export type DropCapSpan = {
  key: string;
  text: string;
  style?: StyleProp<TextStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Rendered right after this span's text (e.g. a note icon); not measured, so keep it narrow. */
  after?: ReactNode;
};

const GAP = 6;

/**
 * Text that opens with a large initial letter (a drop cap) as in printed Bibles. React Native cannot
 * wrap text around a box, so the text is measured at the width left next to the letter: what fits on
 * the first `lines` lines goes beside it, the rest continues below at full width.
 */
export function DropCapText({ letter, spans, textStyle, letterStyle, lineHeight, lines = 2 }: {
  letter: string;
  spans: DropCapSpan[];
  textStyle: StyleProp<TextStyle>;
  letterStyle?: StyleProp<TextStyle>;
  /** Line height of textStyle, in pixels: sizes the letter to exactly `lines` lines. */
  lineHeight: number;
  lines?: number;
}) {
  const [width, setWidth] = useState(0);
  const [letterWidth, setLetterWidth] = useState(0);
  const [split, setSplit] = useState<{ text: string; at: number } | null>(null);
  const plain = spans.map(span => span.text).join('');
  // A measurement of another text (or before the first one) is not used.
  const at = split?.text === plain ? split.at : plain.length;
  const capHeight = lineHeight * lines;

  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={styles.row}>
      <Text onLayout={event => setLetterWidth(event.nativeEvent.layout.width)}
        style={[styles.letter, { fontSize: capHeight * 0.92, lineHeight: capHeight, height: capHeight }, letterStyle]}>
        {letter}
      </Text>
      <Text style={[textStyle, styles.beside]}>{renderSpans(spans, 0, at)}</Text>
    </View>
    {at < plain.length && <Text style={textStyle}>{renderSpans(spans, at, plain.length)}</Text>}

    {/* Invisible copy at the width beside the letter, to know where its first lines end. */}
    {width > 0 && letterWidth > 0 && (
      <Text pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
        style={[textStyle, styles.measure, { width: width - letterWidth - GAP }]}
        onTextLayout={event => {
          let end = event.nativeEvent.lines.slice(0, lines).reduce((sum, line) => sum + line.text.length, 0);
          // Always cut between words, even if a platform counts a line's characters slightly differently.
          const measured = end;
          while (end > 0 && end < plain.length && !/\s/.test(plain[end - 1])) end--;
          if (end === 0) end = measured;
          if (split?.text !== plain || split.at !== end) setSplit({ text: plain, at: end });
        }}>
        {plain}
      </Text>
    )}
  </View>;
}

/** The spans cut to the characters [from, to) of their joined text, keeping each one's style and handlers. */
function renderSpans(spans: DropCapSpan[], from: number, to: number) {
  const out: ReactNode[] = [];
  let offset = 0;
  for (const span of spans) {
    const start = offset;
    const end = offset + span.text.length;
    offset = end;
    const sliceStart = Math.max(from, start);
    const sliceEnd = Math.min(to, end);
    const isLastPiece = end <= to && end > from;
    if (sliceEnd <= sliceStart && !(isLastPiece && span.after)) continue;
    out.push(
      <Text key={span.key + ':' + from} style={span.style} onPress={span.onPress} onLongPress={span.onLongPress}>
        {span.text.slice(sliceStart - start, sliceEnd - start)}
        {isLastPiece ? span.after : null}
      </Text>,
    );
  }
  return out;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: GAP },
  letter: { fontWeight: '700', includeFontPadding: false, textAlignVertical: 'top', marginTop: 2 },
  beside: { flex: 1 },
  measure: { position: 'absolute', opacity: 0, left: 0, top: 0 },
});
