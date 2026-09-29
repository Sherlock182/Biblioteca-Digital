import Svg, { Line, Path } from 'react-native-svg';

/** Drawn open book for the "Nueva Biblia Viva", in the same line style as the other cover icons. */
export function OpenBookIcon({ size = 32, color = '#F2DDB0' }: { size?: number; color?: string }) {
  const line = { fill: 'none', stroke: color, strokeWidth: 6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return <Svg width={size} height={size} viewBox="0 0 100 100">
    <Path d="M50 30 C38 20 22 20 10 24 L10 78 C22 74 38 74 50 84 Z" {...line} />
    <Path d="M50 30 C62 20 78 20 90 24 L90 78 C78 74 62 74 50 84 Z" {...line} />
    <Line x1={22} y1={40} x2={38} y2={40} {...line} strokeWidth={4} />
    <Line x1={22} y1={52} x2={38} y2={52} {...line} strokeWidth={4} />
    <Line x1={62} y1={40} x2={78} y2={40} {...line} strokeWidth={4} />
    <Line x1={62} y1={52} x2={78} y2={52} {...line} strokeWidth={4} />
  </Svg>;
}
