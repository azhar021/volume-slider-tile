import { useEffect, useState } from 'react';
import {
  Animated,
  NativeModules,
  PanResponder,
  StatusBar,
  StyleSheet,
  Text,
  useAnimatedValue,
  View,
} from 'react-native';

const TRACK_WIDTH = 88;
const TRACK_HEIGHT = 280;

const clamp = (n: number) => Math.min(1, Math.max(0, n));

function SpeakerIcon({ level, color }: { level: number; color: string }) {
  const waves = level === 0 ? 0 : level < 0.34 ? 1 : level < 0.67 ? 2 : 3;

  return (
    <View style={iconStyles.row}>
      <View style={[iconStyles.body, { backgroundColor: color }]} />
      <View style={[iconStyles.cone, { borderRightColor: color }]} />
      <View style={iconStyles.waves}>
        {[1, 2, 3].map((i) => {
          const r = 5 * i;
          return (
            <View
              key={i}
              style={[
                iconStyles.wave,
                {
                  width: r * 2,
                  height: r * 2,
                  borderRadius: r,
                  left: -r,
                  top: 16 - r,
                  borderRightColor: color,
                  opacity: i <= waves ? 1 : 0.18,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

type VolumePillProps = {
  value: number;
  max: number;
  onChange: (value: number) => void;
};

function createVolumeGesture(
  fill: Animated.Value,
  scale: Animated.Value,
  setDragFraction: (fraction: number | null) => void,
) {
  const g = {
    dragging: false,
    start: 0,
    fraction: 0,
    lastStep: 0,
    max: 0,
    onChange: (_value: number) => {},
  };

  const sync = (value: number, max: number, onChange: (value: number) => void) => {
    g.max = max;
    g.onChange = onChange;
    if (g.dragging) {
      return;
    }
    g.fraction = max > 0 ? value / max : 0;
    g.lastStep = value;
    Animated.timing(fill, { toValue: g.fraction, duration: 150, useNativeDriver: true }).start();
  };

  const settle = () => {
    g.dragging = false;
    g.fraction = g.max > 0 ? g.lastStep / g.max : 0;
    setDragFraction(null);
    Animated.parallel([
      Animated.spring(fill, { toValue: g.fraction, useNativeDriver: true, speed: 30, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      g.dragging = true;
      g.start = g.fraction;
      fill.stopAnimation();
      setDragFraction(g.fraction);
      Animated.spring(scale, { toValue: 1.04, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
    },
    onPanResponderMove: (_, state) => {
      const f = clamp(g.start - state.dy / TRACK_HEIGHT);
      g.fraction = f;
      fill.setValue(f);
      setDragFraction(f);

      const step = Math.round(f * g.max);
      if (step !== g.lastStep) {
        g.lastStep = step;
        g.onChange(step);
      }
    },
    onPanResponderRelease: settle,
    onPanResponderTerminate: settle,
  });

  return { panResponder, sync };
}

function VolumePill({ value, max, onChange }: VolumePillProps) {
  const valueFraction = max > 0 ? value / max : 0;
  const fill = useAnimatedValue(valueFraction);
  const scale = useAnimatedValue(1);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const [{ panResponder, sync }] = useState(() => createVolumeGesture(fill, scale, setDragFraction));

  useEffect(() => {
    sync(value, max, onChange);
  }, [value, max, onChange, sync]);

  const displayFraction = dragFraction ?? valueFraction;

  const translateY = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [TRACK_HEIGHT, 0],
    extrapolate: 'clamp',
  });

  const stepBy = (delta: number) => {
    const next = Math.min(max, Math.max(0, value + delta));
    if (next !== value) {
      onChange(next);
    }
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Volume"
      accessibilityValue={{ min: 0, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => stepBy(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={[styles.pill, { transform: [{ scale }] }]}
    >
      <Animated.View style={[styles.pillFill, { transform: [{ translateY }] }]} />
      <View style={styles.pillIcon} pointerEvents="none">
        <SpeakerIcon level={displayFraction} color={displayFraction > 0.12 ? '#1c1917' : '#f5f5f4'} />
      </View>
    </Animated.View>
  );
}

const { VolumeTileModule } = NativeModules as {
  VolumeTileModule?: {
    getVolumeStatus: () => Promise<{ current: number; max: number; summary: string }>;
    setVolume: (level: number) => Promise<string>;
    openVolumePopup: () => Promise<string>;
  };
};

export default function App() {
  const [currentVolume, setCurrentVolume] = useState(8);
  const [maxVolume, setMaxVolume] = useState(15);

  useEffect(() => {
    const loadVolume = async () => {
      if (!VolumeTileModule) {
        return;
      }

      try {
        const result = await VolumeTileModule.getVolumeStatus();
        setCurrentVolume(result.current ?? 0);
        setMaxVolume(result.max ?? 15);
      } catch {
        // Keep defaults when native module is unavailable.
      }
    };

    loadVolume();
  }, []);

  const volumePercent = maxVolume > 0 ? Math.round((currentVolume / maxVolume) * 100) : 0;

  const handleVolumeChange = async (value: number) => {
    const nextValue = Math.round(value);
    setCurrentVolume(nextValue);

    if (!VolumeTileModule) {
      return;
    }

    try {
      await VolumeTileModule.setVolume(nextValue);
    } catch {
      // Ignore write failures; UI still reflects the drag.
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <Text style={styles.brand}>Volume</Text>
      <Text style={styles.percent}>{volumePercent}%</Text>
      <Text style={styles.hint}>Drag to adjust media volume</Text>

      <View style={styles.pillWrap}>
        <VolumePill value={currentVolume} max={maxVolume} onChange={handleVolumeChange} />
      </View>

      <Text style={styles.footer}>Quick Settings tile opens the same control</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0a09',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  orbTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#1c1917',
  },
  orbBottom: {
    position: 'absolute',
    bottom: -140,
    left: -100,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: '#292524',
    opacity: 0.55,
  },
  brand: {
    color: '#a8a29e',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  percent: {
    color: '#fafaf9',
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: -2.4,
    marginBottom: 6,
  },
  hint: {
    color: '#78716c',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 36,
  },
  pillWrap: {
    alignItems: 'center',
  },
  pill: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: 44,
    backgroundColor: 'rgba(68, 64, 60, 0.55)',
    overflow: 'hidden',
  },
  pillFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#fafaf9',
  },
  pillIcon: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    color: '#57534e',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});

const iconStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  body: {
    width: 7,
    height: 11,
    borderRadius: 1.5,
  },
  cone: {
    width: 0,
    height: 0,
    marginLeft: -2,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderRightWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  waves: {
    width: 18,
    height: 32,
    marginLeft: 2,
  },
  wave: {
    position: 'absolute',
    borderWidth: 2.5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
});
