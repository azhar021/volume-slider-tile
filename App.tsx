import { useEffect, useState } from 'react';
import {
  Animated,
  NativeModules,
  PanResponder,
  StyleSheet,
  Text,
  useAnimatedValue,
  View,
} from 'react-native';

const TRACK_WIDTH = 120;
const TRACK_HEIGHT = 300;

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
                  opacity: i <= waves ? 1 : 0.2,
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
      Animated.spring(scale, { toValue: 1.05, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
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
        <SpeakerIcon level={displayFraction} color={displayFraction > 0.12 ? '#1f2937' : '#e2e8f0'} />
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
  const [status, setStatus] = useState('Loading volume...');

  useEffect(() => {
    const loadVolume = async () => {
      if (!VolumeTileModule) {
        setStatus('Native Android module is not available for volume control.');
        return;
      }

      try {
        const result = await VolumeTileModule.getVolumeStatus();
        setCurrentVolume(result.current ?? 0);
        setMaxVolume(result.max ?? 15);
        setStatus(result.summary ?? 'Volume status ready');
      } catch {
        setStatus('Unable to read volume state.');
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
      const percent = maxVolume > 0 ? Math.round((nextValue / maxVolume) * 100) : 0;
      setStatus(`Volume set to ${percent}%`);
    } catch {
      setStatus('Could not update volume from the app.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.glow} />

      <View style={styles.panel}>
        <Text style={styles.kicker}>Audio control</Text>
        <Text style={styles.title}>Volume Slider Tile</Text>
        <Text style={styles.subtitle}>One tile opens a popup slider</Text>

        <View style={styles.valueRow}>
          <Text style={styles.value}>{volumePercent}</Text>
          <Text style={styles.maxValue}>%</Text>
        </View>

        <View style={styles.pillWrap}>
          <VolumePill value={currentVolume} max={maxVolume} onChange={handleVolumeChange} />
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusText}>{status}</Text>
        </View>

        <Text style={styles.helperText}>
          Use the custom Quick Settings tile to open a popup with the same slider control. The tile is a
          single action that opens the volume dialog directly from Android.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050b14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  glow: {
    position: 'absolute',
    top: -80,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: '#111827',
    opacity: 0.95,
  },
  panel: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 28,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    shadowColor: '#020617',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    zIndex: 1,
  },
  kicker: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 18,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 18,
  },
  value: {
    color: '#f8fafc',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  maxValue: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '600',
  },
  pillWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  pill: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: 36,
    backgroundColor: 'rgba(51, 65, 85, 0.65)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  pillFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#f8fafc',
  },
  pillIcon: {
    position: 'absolute',
    bottom: 26,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusBox: {
    marginTop: 18,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  statusLabel: {
    color: '#bfdbfe',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statusText: {
    color: '#f8fafc',
    fontSize: 14,
    lineHeight: 20,
  },
  helperText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 18,
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
