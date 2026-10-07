import Slider from '@react-native-community/slider';
import { useEffect, useState } from 'react';
import { NativeModules, StyleSheet, Text, View } from 'react-native';

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
      } catch (error) {
        setStatus('Unable to read volume state.');
      }
    };

    loadVolume();
  }, []);

  const handleVolumeChange = async (value: number) => {
    const nextValue = Math.round(value);
    setCurrentVolume(nextValue);

    if (!VolumeTileModule) {
      return;
    }

    try {
      await VolumeTileModule.setVolume(nextValue);
      setStatus(`Volume set to ${nextValue} of ${maxVolume}`);
    } catch (error) {
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
          <Text style={styles.value}>{currentVolume}</Text>
          <Text style={styles.maxValue}> / {maxVolume}</Text>
        </View>

        <Slider
          value={currentVolume}
          minimumValue={0}
          maximumValue={maxVolume}
          step={1}
          minimumTrackTintColor="#7c8cff"
          maximumTrackTintColor="#1f2937"
          thumbTintColor="#e2e8f0"
          onValueChange={handleVolumeChange}
          style={styles.slider}
        />

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
  slider: {
    width: '100%',
    height: 44,
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
