import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchLifeScore, type LifeScorePayload, syncBehaviorSamples } from "./lifeosApi";
import { collectBehaviorSamples, getLifeOSMobilePlatform } from "./nativeBehaviorCollectors";

type SyncState = "idle" | "syncing" | "synced" | "empty" | "error";

export default function App() {
  const [payload, setPayload] = useState<LifeScorePayload | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [accepted, setAccepted] = useState(0);

  async function refresh() {
    const data = await fetchLifeScore();
    setPayload(data);
  }

  async function syncNow() {
    setSyncState("syncing");
    try {
      const samples = await collectBehaviorSamples();
      if (samples.length === 0) {
        setSyncState("empty");
        return;
      }

      const result = await syncBehaviorSamples(samples, getLifeOSMobilePlatform());
      setAccepted(result.accepted);
      setPayload((current) => ({ ...current, lifeScore: result.lifeScore ?? current?.lifeScore }));
      setSyncState("synced");
    } catch {
      setSyncState("error");
    }
  }

  useEffect(() => {
    let mounted = true;
    refresh()
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setPayload((current) => current ?? {});
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>LifeOS AI Mobile</Text>
        <Text style={styles.title}>Goal probability in your pocket</Text>
        {!payload ? (
          <View style={styles.card}>
            <ActivityIndicator color="#bef264" />
            <Text style={styles.muted}>Loading behavior intelligence</Text>
          </View>
        ) : (
          <>
            <View style={styles.scoreCard}>
              <Text style={styles.label}>Life Score</Text>
              <Text style={styles.score}>{payload.lifeScore?.today ?? "--"}</Text>
              <Text style={styles.muted}>
                Week {payload.lifeScore?.week ?? "--"} / Month {payload.lifeScore?.month ?? "--"}
              </Text>
            </View>
            <Pressable accessibilityRole="button" disabled={syncState === "syncing"} onPress={syncNow} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{syncState === "syncing" ? "Syncing" : "Sync Device Data"}</Text>
            </Pressable>
            <Text style={styles.status}>{statusText(syncState, accepted)}</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Active Goals</Text>
              {(payload.goals ?? []).map((goal) => (
                <Text key={goal.id} style={styles.goal}>
                  {goal.title}
                </Text>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function statusText(state: SyncState, accepted: number) {
  if (state === "synced") return `${accepted} samples synced`;
  if (state === "empty") return "Native collectors are waiting for platform permissions";
  if (state === "error") return "Sync failed";
  return "Ready";
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0d09",
  },
  content: {
    gap: 16,
    padding: 20,
  },
  kicker: {
    color: "#bef264",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#f5f7f0",
    fontSize: 28,
    fontWeight: "800",
  },
  card: {
    gap: 10,
    borderColor: "#30362d",
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#151812",
    padding: 16,
  },
  scoreCard: {
    gap: 8,
    borderColor: "#bef26455",
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#1d2118",
    padding: 18,
  },
  label: {
    color: "#c4cbbb",
    fontSize: 13,
    fontWeight: "700",
  },
  score: {
    color: "#bef264",
    fontSize: 64,
    fontWeight: "900",
  },
  goal: {
    color: "#f5f7f0",
    fontSize: 16,
    fontWeight: "600",
  },
  muted: {
    color: "#8b9484",
    fontSize: 13,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#bef264",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#11140e",
    fontSize: 15,
    fontWeight: "800",
  },
  status: {
    color: "#8b9484",
    fontSize: 13,
  },
});
