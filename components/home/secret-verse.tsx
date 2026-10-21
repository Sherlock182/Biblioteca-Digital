import { Sheet } from '@/components/ui/sheet';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';

const LOGO = require('@/assets/images/logo-paloma-cielo.png');
const VERSE = 'Lámpara es a mis pies tu palabra, Y lumbrera a mi camino.';
const REFERENCE = 'Salmos 119:105';
/** Milliseconds per letter of the typewriter. */
const LETTER_MS = 85;

/** The stage around the logo, the logo's size and the radius of its gold ring, where the fire is born. */
const STAGE = 340;
const LOGO_SIZE = 200;
const RING = 96;

// Soft flame-shaped glows; many of them rising and fading together make the fire.
const SPRITES = {
  core: require('@/assets/images/fire/fire-core.png'),
  orange: require('@/assets/images/fire/fire-orange.png'),
  red: require('@/assets/images/fire/fire-red.png'),
};
const HALO = require('@/assets/images/fire/fire-halo.png');
/** Crackling fire, a seamless 10 s loop. */
const FIRE_SOUND = require('@/assets/sounds/fuego.wav');
const FIRE_VOLUME = 0.9;
const RIM = require('@/assets/images/fire/fire-rim.png');

type Particle = {
  sprite: keyof typeof SPRITES; x: number; y: number; width: number; height: number; opacity: number;
  /** Where it ends up, from where it was born. */
  driftX: number; swayX: number; endY: number; duration: number; delay: number;
  /** Degrees it leans: straight up at the top, bending outward and up along the sides. */
  lean: string;
};

/** Always the same "random" numbers, so the fire is built once and looks the same every time. */
function seeded(seed: number) {
  let value = seed;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

/** How far every flame is pushed out from the ring, so the fire also shows at the sides and below. */
const OUTWARD = 26;

/**
 * The fire, in three layers of tongues born all around the ring: red ones that reach furthest, orange
 * flames, and a white-gold heart close to the ring. Each one is pushed outward and also rises, so the
 * top burns tallest, the sides lick upward and below there is still fire.
 */
function buildFire(): Particle[] {
  const random = seeded(7);
  // [sprite, count, size, rise, opacity, shortest life in ms]
  const layers = [['red', 60, 54, 40, 0.9, 1800], ['orange', 60, 44, 30, 1, 1500], ['core', 48, 28, 16, 1, 1150]] as const;
  const particles: Particle[] = [];
  for (const [sprite, count, size, rise, opacity, life] of layers) {
    for (let i = 0; i < count; i++) {
      const angle = ((i + 0.5) / count) * 2 * Math.PI - Math.PI;
      const up = 0.75 + 0.25 * Math.cos(angle / 2);
      const scale = 0.75 + 0.45 * up;
      // Long tongues; the ones below are shorter, so they glow without piling up.
      const tall = 0.6 + 0.2 * (1 + Math.cos(angle));
      const width = (size / 1.3) * scale;
      const height = size * 2 * scale * tall;
      const duration = life + random() * life * 0.45;
      particles.push({
        sprite, width, height, opacity, duration,
        x: STAGE / 2 + RING * Math.sin(angle) - width / 2,
        y: STAGE / 2 - RING * Math.cos(angle) - height / 2,
        driftX: OUTWARD * Math.sin(angle),
        swayX: (random() - 0.5) * 10,
        endY: -OUTWARD * Math.cos(angle) - rise * 2.2 * (0.25 + 0.375 * (1 + Math.cos(angle))),
        delay: random() * duration,
        lean: `${((angle * 180) / Math.PI) * 0.35}deg`,
      });
    }
  }
  return particles;
}

type Spark = { x: number; size: number; rise: number; sway: number; duration: number; delay: number };

function buildSparks(): Spark[] {
  const random = seeded(31);
  return Array.from({ length: 16 }, () => {
    const angle = (random() * 1.6 - 0.8) * Math.PI;
    return {
      x: STAGE / 2 + RING * Math.sin(angle), size: 2 + random() * 2, rise: 110 + random() * 60,
      sway: (random() - 0.5) * 30, duration: 2300 + random() * 1200, delay: random() * 2000,
    };
  });
}

const FIRE = buildFire();
const SPARKS = buildSparks();

/** Runs `value` from 0 to 1 over and over, starting after `delay`. */
function loopValue(value: Animated.Value, duration: number, delay: number) {
  const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
  const start = setTimeout(() => loop.start(), delay);
  return () => { clearTimeout(start); loop.stop(); value.setValue(0); };
}

// The little flame that burns at the pen while the verse is written: [sprite, x, width, height, rise, life ms, delay ms].
const PEN_FIRE = [
  ['red', -10, 20, 46, 34, 950, 0], ['red', 8, 18, 42, 30, 1050, 450], ['red', -2, 19, 48, 36, 1000, 750],
  ['orange', -5, 17, 40, 30, 850, 200], ['orange', 6, 16, 36, 26, 900, 600], ['orange', -12, 14, 32, 22, 1000, 350],
  ['orange', 12, 13, 30, 22, 950, 800], ['core', 0, 12, 26, 16, 750, 100], ['core', -5, 11, 22, 14, 800, 500],
  ['core', 5, 11, 22, 13, 700, 300], ['core', 0, 10, 20, 12, 650, 650],
] as const;

/** A small fire at the end of the text being written, as if each letter were burned in. */
function PenFire({ x, y, burning }: { x: number; y: number; burning: boolean }) {
  const [lives] = useState(() => PEN_FIRE.map(() => new Animated.Value(0)));
  const [shown] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!burning) return;
    const stops = lives.map((value, i) => loopValue(value, PEN_FIRE[i][5], PEN_FIRE[i][6]));
    return () => stops.forEach(stop => stop());
  }, [burning, lives]);

  // Lights when the writing starts and dies out gently when the verse is complete.
  useEffect(() => {
    Animated.timing(shown, { toValue: burning ? 1 : 0, duration: burning ? 250 : 700, useNativeDriver: true }).start();
  }, [burning, shown]);

  return <Animated.View pointerEvents="none" style={[styles.pen, { left: x, top: y, opacity: shown }]}>
    {PEN_FIRE.map(([sprite, dx, width, height, rise], i) => <Animated.Image key={i} source={SPRITES[sprite]} style={{
      position: 'absolute', left: dx - width / 2, top: -height * 0.75, width, height,
      opacity: lives[i].interpolate({ inputRange: [0, 0.15, 0.6, 1], outputRange: [0, 1, 0.6, 0] }),
      transform: [
        { translateY: lives[i].interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
        { scale: lives[i].interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
      ],
    }} />)}
  </Animated.View>;
}

/**
 * Moves the player's volume to `to` over `ms`, step by step; calls `then` at the end. Returns a cancel.
 */
function fadeVolume(player: AudioPlayer, to: number, ms: number, then?: () => void) {
  const from = player.volume;
  const steps = Math.max(1, Math.round(ms / 50));
  let step = 0;
  const timer = setInterval(() => {
    step += 1;
    player.volume = from + ((to - from) * step) / steps;
    if (step >= steps) { clearInterval(timer); then?.(); }
  }, 50);
  return () => clearInterval(timer);
}

/**
 * The sound of the logo's fire, following it: it flares up as the fire lights, softens as it settles
 * once the verse is written, and dies out with the last flame. Closing cuts it with a short fade.
 */
function useFireSound(visible: boolean, written: boolean) {
  const player = useRef<AudioPlayer | null>(null);

  // A fresh player each time the secret opens; released with a short fade when it closes.
  useEffect(() => {
    if (!visible) return;
    const sound = createAudioPlayer(FIRE_SOUND);
    sound.loop = true;
    sound.volume = 0;
    sound.play();
    player.current = sound;
    const cancel = fadeVolume(sound, FIRE_VOLUME, 800);
    return () => {
      cancel();
      player.current = null;
      fadeVolume(sound, 0, 200, () => sound.remove());
    };
  }, [visible]);

  // Same timing as the fire: settles in 1.8 s, burns 1.5 s more, then goes out over 3.5 s.
  useEffect(() => {
    const sound = player.current;
    if (!visible || !written || !sound) return;
    let cancel = fadeVolume(sound, FIRE_VOLUME * 0.55, 1800);
    const out = setTimeout(() => { cancel = fadeVolume(sound, 0, 3500, () => sound.pause()); }, 3300);
    return () => { clearTimeout(out); cancel(); };
  }, [visible, written]);
}

/**
 * "A lamp unto my feet": the logo's gold ring set on fire, flames rising and sparks flying up.
 * Once the verse is written `calm` goes from 0 to 1, a quieter burn, and then on to 2, the fire burnt out.
 */
function HolyFire({ visible, appear, glow, calm }: {
  visible: boolean; appear: Animated.Value; glow: Animated.Value; calm: Animated.Value;
}) {
  const [flames] = useState(() => FIRE.map(() => new Animated.Value(0)));
  const [sparks] = useState(() => SPARKS.map(() => new Animated.Value(0)));

  useEffect(() => {
    if (!visible) return;
    const stops = [
      ...flames.map((value, i) => loopValue(value, FIRE[i].duration, FIRE[i].delay)),
      ...sparks.map((value, i) => loopValue(value, SPARKS[i].duration, SPARKS[i].delay)),
    ];
    return () => stops.forEach(stop => stop());
  }, [flames, sparks, visible]);

  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
    opacity: Animated.multiply(appear, calm.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 0.6, 0] })),
    transform: [{ scale: calm.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 0.92, 0.8] }) }],
  }]}>
    <Animated.Image source={HALO} style={[styles.halo, {
      opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
      transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.05] }) }],
    }]} />
    {FIRE.map((p, i) => {
      const life = flames[i];
      return <Animated.Image key={i} source={SPRITES[p.sprite]} style={{
        position: 'absolute', left: p.x, top: p.y, width: p.width, height: p.height,
        // Lights up fast, burns, then is gone before it turns into a lone drop.
        opacity: life.interpolate({ inputRange: [0, 0.12, 0.55, 0.85, 1], outputRange: [0, p.opacity, p.opacity * 0.6, 0, 0] }),
        transform: [
          { translateX: life.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.driftX / 2 + p.swayX, p.driftX] }) },
          { translateY: life.interpolate({ inputRange: [0, 1], outputRange: [0, p.endY] }) },
          { rotate: p.lean },
          { scale: life.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) },
        ],
      }} />;
    })}
    <Animated.Image source={RIM} style={[styles.rim, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }]} />
    {SPARKS.map((s, i) => {
      const life = sparks[i];
      return <Animated.View key={i} style={[styles.spark, {
        left: s.x, top: STAGE / 2 - RING, width: s.size, height: s.size, borderRadius: s.size,
        opacity: life.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
        transform: [
          { translateX: life.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, s.sway, s.sway / 2] }) },
          { translateY: life.interpolate({ inputRange: [0, 1], outputRange: [0, -s.rise] }) },
        ],
      }]} />;
    })}
  </Animated.View>;
}

/**
 * The surprise hidden behind "Versión" in "Acerca de": the logo catches fire, the dove beats its wings
 * and the verse writes itself letter by letter. A tap anywhere (or the back button) closes it.
 */
export function SecretVerse({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [letters, setLetters] = useState(0);
  const [pen, setPen] = useState({ x: 0, y: 0 });
  const [appear] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));
  const [flap] = useState(() => new Animated.Value(0));
  const [signature] = useState(() => new Animated.Value(0));
  const [calm] = useState(() => new Animated.Value(0));

  // Logo: grows in, beats its wings twice, then the fire's light keeps breathing around it.
  useEffect(() => {
    if (!visible) return;
    appear.setValue(0); flap.setValue(0); glow.setValue(0); signature.setValue(0); calm.setValue(0);
    const beat = Animated.sequence([
      Animated.timing(flap, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(flap, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    const intro = Animated.sequence([
      Animated.spring(appear, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      beat, beat,
    ]);
    const breathe = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    intro.start();
    breathe.start();
    return () => { intro.stop(); breathe.stop(); };
  }, [appear, calm, flap, glow, signature, visible]);

  // Typewriter: one more letter every LETTER_MS, then the reference fades in.
  useEffect(() => {
    if (!visible) return;
    let shown = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        shown += 1;
        setLetters(shown);
        if (shown >= VERSE.length) {
          clearInterval(timer);
          Animated.timing(signature, { toValue: 1, duration: 700, useNativeDriver: true }).start();
          // The verse is written: the logo's fire settles down, burns a while longer, then goes out.
          Animated.sequence([
            Animated.timing(calm, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.delay(1500),
            Animated.timing(calm, { toValue: 2, duration: 3500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]).start();
        }
      }, LETTER_MS);
    }, 900);
    // Blank again on closing, so the next time it writes itself from the start.
    return () => { clearTimeout(start); if (timer) clearInterval(timer); setLetters(0); };
  }, [calm, signature, visible]);

  const logoScale = Animated.add(
    appear.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
    flap.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }),
  );
  const done = letters >= VERSE.length;
  useFireSound(visible, done);

  return <Sheet visible={visible} animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} accessibilityRole="button" accessibilityLabel={`${VERSE} ${REFERENCE}. Toca para cerrar`} onPress={onClose}>
      <View style={styles.stage}>
        <HolyFire visible={visible} appear={appear} glow={glow} calm={calm} />
        <Animated.View style={{ opacity: appear, transform: [{ scale: logoScale }] }}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </Animated.View>
      </View>
      <View style={styles.verseBox}>
        <Text style={styles.verse} onTextLayout={event => {
          // The pen sits at the end of the last line written so far.
          const last = event.nativeEvent.lines.at(-1);
          if (last) setPen({ x: last.x + last.width, y: last.y + last.height * 0.7 });
        }}>
          {VERSE.slice(0, letters)}
          {done ? null : <Text style={styles.cursor}>|</Text>}
        </Text>
        <PenFire x={pen.x} y={pen.y} burning={visible && letters > 0 && !done} />
      </View>
      <Animated.Text style={[styles.reference, { opacity: signature }]}>{REFERENCE}</Animated.Text>
      <Animated.Text style={[styles.hint, { opacity: signature }]}>Toca para cerrar</Animated.Text>
    </Pressable>
  </Sheet>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,10,30,0.95)', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  stage: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', left: 0, top: 0, width: STAGE, height: STAGE },
  rim: { position: 'absolute', left: (STAGE - 224) / 2, top: (STAGE - 224) / 2, width: 224, height: 224 },
  spark: { position: 'absolute', backgroundColor: '#FFF2B0' },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  verseBox: { alignSelf: 'stretch', minHeight: 90 },
  pen: { position: 'absolute', width: 0, height: 0 },
  verse: { fontSize: 22, lineHeight: 32, fontWeight: '600', fontStyle: 'italic', color: '#FFF6DA', textAlign: 'center' },
  cursor: { color: '#F2C75C', fontStyle: 'normal' },
  reference: { fontSize: 15, fontWeight: '800', letterSpacing: 1.5, color: '#F2C75C', textTransform: 'uppercase' },
  hint: { position: 'absolute', bottom: 90, fontSize: 12, color: 'rgba(255,246,218,0.6)' },
});
