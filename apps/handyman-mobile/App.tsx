import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  acceptVisit,
  checkInVisit,
  completeVisit,
  createEvidenceUpload,
  declineVisit,
  getVisit,
  recordBeforeEvidence,
  type Visit
} from "./src/api";
import { colours } from "./src/theme";
import { initialToken, tokenFromUrl } from "./src/deepLinks";

interface EvidenceAsset {
  uri: string;
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
}

export default function App() {
  const [token, setToken] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [beforePhoto, setBeforePhoto] = useState<EvidenceAsset | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<EvidenceAsset | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    initialToken().then((value) => {
      if (value) setToken(value);
    });
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const value = tokenFromUrl(url);
      if (value) setToken(value);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!token) return;
    setDraftToken(token);
    void loadVisit(token);
  }, [token]);

  const statusLabel = useMemo(() => (visit?.status || "not opened").replaceAll("_", " "), [visit?.status]);

  async function loadVisit(activeToken = token) {
    if (!activeToken) return;
    setLoading(true);
    setError("");
    try {
      const result = await getVisit(activeToken);
      setVisit(result.visit);
    } catch (caught) {
      setVisit(null);
      setError(caught instanceof Error ? caught.message : "Unable to open visit");
    } finally {
      setLoading(false);
    }
  }

  async function submitToken() {
    const clean = draftToken.trim();
    if (!clean) return setError("Paste the visit token or open the SMS link.");
    setToken(clean);
  }

  async function accept() {
    await run("accept", async () => {
      await acceptVisit(token);
      await loadVisit();
    });
  }

  async function decline() {
    Alert.prompt?.("Decline task", "Please give a short reason.", async (reason) => {
      if (!reason || reason.trim().length < 5) return;
      await run("decline", async () => {
        await declineVisit(token, reason.trim());
        await loadVisit();
      });
    });
    if (Platform.OS !== "ios") {
      await run("decline", async () => {
        await declineVisit(token, "Handyman declined from mobile app");
        await loadVisit();
      });
    }
  }

  async function checkIn() {
    await run("check-in", async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission is required for secure check-in.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await checkInVisit(token, position.coords.latitude, position.coords.longitude);
      await loadVisit();
    });
  }

  async function capturePhoto(kind: "before" | "after") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") return setError("Camera permission is required for visit evidence.");
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      allowsEditing: false
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const contentType = normaliseContentType(asset.mimeType || "image/jpeg");
    const evidence = {
      uri: asset.uri,
      fileName: asset.fileName || `${kind}-photo.jpg`,
      contentType,
      sizeBytes: asset.fileSize || 1
    };
    if (kind === "before") setBeforePhoto(evidence);
    else setAfterPhoto(evidence);
  }

  async function uploadEvidence(photo: EvidenceAsset, kind: "before_photo" | "after_photo") {
    const ticket = await createEvidenceUpload(token, photo.fileName, kind, photo.contentType, photo.sizeBytes);
    const blob = await (await fetch(photo.uri)).blob();
    const upload = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: ticket.headers || { "content-type": photo.contentType },
      body: blob
    });
    if (!upload.ok) throw new Error("Photo upload failed. Please try again.");
    return ticket.storageKey;
  }

  async function submitCompletion() {
    if (!beforePhoto || !afterPhoto) return setError("Capture both before and after photos.");
    if (notes.trim().length < 5) return setError("Add short completion notes.");
    await run("complete", async () => {
      const beforeStorageKey = await uploadEvidence(beforePhoto, "before_photo");
      await recordBeforeEvidence(token, beforeStorageKey, beforePhoto.contentType, beforePhoto.sizeBytes);
      const afterStorageKey = await uploadEvidence(afterPhoto, "after_photo");
      await completeVisit(token, notes.trim(), afterStorageKey, afterPhoto.contentType, afterPhoto.sizeBytes);
      await loadVisit();
      setBeforePhoto(null);
      setAfterPhoto(null);
      setNotes("");
    });
  }

  async function run(label: string, work: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={styles.app}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><MaterialCommunityIcons name="shield-check-outline" size={24} color="#fff" /></View>
          <View><Text style={styles.brand}>TaskBridge</Text><Text style={styles.subBrand}>Handyman app</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>Secure visit token</Text>
          <Text style={styles.title}>Open your assigned task</Text>
          <Text style={styles.copy}>Use the SMS link or paste the visit token. The app uses the same secure TaskBridge workflow as the web visit link.</Text>
          <View style={styles.tokenRow}>
            <TextInput style={styles.input} value={draftToken} onChangeText={setDraftToken} autoCapitalize="none" placeholder="Visit token" />
            <Pressable style={styles.smallButton} onPress={submitToken}><Text style={styles.buttonText}>Open</Text></Pressable>
          </View>
          {loading && <View style={styles.loading}><ActivityIndicator color={colours.primary} /><Text>Opening visit...</Text></View>}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {visit && <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.eyebrow}>Assigned visit</Text>
            <Text style={styles.status}>{statusLabel}</Text>
          </View>
          <Text style={styles.title}>{visit.category}</Text>
          <Text style={styles.copy}>{visit.summary}</Text>
          <View style={styles.infoRow}><MaterialCommunityIcons name="map-marker-outline" size={20} color={colours.primary} /><Text style={styles.infoText}>{visit.address}</Text></View>
          <View style={styles.infoRow}><MaterialCommunityIcons name="clock-outline" size={20} color={colours.primary} /><Text style={styles.infoText}>{formatWindow(visit.preferredWindow)}</Text></View>
          <View style={styles.alertBox}><MaterialCommunityIcons name="card-account-details-star-outline" size={22} color={colours.primaryDark} /><Text style={styles.alertText}>{visit.mandatedInstruction}</Text></View>

          {["link_sent", "pending"].includes(visit.status) && <View style={styles.actionGrid}>
            <Pressable disabled={Boolean(busy)} style={styles.primaryButton} onPress={accept}><Text style={styles.buttonText}>{busy === "accept" ? "Accepting..." : "Accept task"}</Text></Pressable>
            <Pressable disabled={Boolean(busy)} style={styles.secondaryButton} onPress={decline}><Text style={styles.secondaryButtonText}>Decline</Text></Pressable>
          </View>}

          {visit.status === "accepted" && <Pressable disabled={Boolean(busy)} style={styles.primaryButton} onPress={checkIn}><Text style={styles.buttonText}>{busy === "check-in" ? "Checking location..." : "Check in securely"}</Text></Pressable>}

          {visit.status === "checked_in" && <View style={styles.evidencePanel}>
            <Text style={styles.sectionTitle}>Visit evidence</Text>
            <View style={styles.photoGrid}>
              <PhotoButton label="Before work" photo={beforePhoto} onPress={() => capturePhoto("before")} />
              <PhotoButton label="After work" photo={afterPhoto} onPress={() => capturePhoto("after")} />
            </View>
            <TextInput style={[styles.input, styles.notes]} value={notes} onChangeText={setNotes} multiline placeholder="Completion notes" />
            <Pressable disabled={Boolean(busy)} style={styles.primaryButton} onPress={submitCompletion}><Text style={styles.buttonText}>{busy === "complete" ? "Submitting..." : "Submit evidence and check out"}</Text></Pressable>
          </View>}

          {["evidence_submitted", "confirmed"].includes(visit.status) && <View style={styles.doneBox}><MaterialCommunityIcons name="check-circle-outline" size={30} color={colours.success} /><Text style={styles.doneText}>Evidence submitted. Payment remains subject to care coordinator approval.</Text></View>}
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PhotoButton({ label, photo, onPress }: { label: string; photo: EvidenceAsset | null; onPress: () => void }) {
  return <Pressable style={styles.photoButton} onPress={onPress}>
    {photo ? <Image source={{ uri: photo.uri }} style={styles.photoPreview} /> : <MaterialCommunityIcons name="camera-outline" size={30} color={colours.primary} />}
    <Text style={styles.photoLabel}>{photo ? "Retake" : label}</Text>
  </Pressable>;
}

function normaliseContentType(value: string): EvidenceAsset["contentType"] {
  if (value === "image/png" || value === "image/webp") return value;
  return "image/jpeg";
}

function formatWindow(window: Visit["preferredWindow"]) {
  if (!window.start && !window.end) return "Visit window to be confirmed";
  const start = window.start ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(window.start)) : "Start to be confirmed";
  const end = window.end ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(window.end)) : "end to be confirmed";
  return `${start} - ${end}`;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colours.canvas },
  content: { padding: 20, paddingTop: 60, gap: 16 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  logo: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#ff5f45", alignItems: "center", justifyContent: "center" },
  brand: { color: colours.ink, fontSize: 24, fontWeight: "900" },
  subBrand: { color: colours.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2 },
  card: { backgroundColor: colours.paper, borderRadius: 16, borderWidth: 1, borderColor: colours.border, padding: 18, gap: 12 },
  eyebrow: { color: "#e11d48", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.8 },
  title: { color: colours.ink, fontSize: 24, fontWeight: "900", lineHeight: 30 },
  copy: { color: colours.muted, fontSize: 15, lineHeight: 23 },
  tokenRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colours.border, backgroundColor: "#fff", color: colours.ink, fontSize: 15 },
  notes: { minHeight: 104, textAlignVertical: "top" },
  smallButton: { minWidth: 74, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colours.primary },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colours.primary, paddingHorizontal: 16 },
  secondaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: colours.border, paddingHorizontal: 16 },
  buttonText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  secondaryButtonText: { color: colours.ink, fontWeight: "900", fontSize: 15 },
  loading: { flexDirection: "row", gap: 10, alignItems: "center" },
  error: { color: colours.danger, backgroundColor: "#fff1f2", borderColor: "#fecdd3", borderWidth: 1, padding: 12, borderRadius: 10, fontWeight: "700" },
  statusRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
  status: { color: colours.primaryDark, backgroundColor: "#eef2ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontWeight: "900", textTransform: "capitalize" },
  infoRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  infoText: { flex: 1, color: colours.ink, fontWeight: "700", lineHeight: 21 },
  alertBox: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 12, backgroundColor: "#eef2ff", borderWidth: 1, borderColor: "#c7d2fe" },
  alertText: { flex: 1, color: colours.primaryDark, fontWeight: "800", lineHeight: 20 },
  actionGrid: { flexDirection: "row", gap: 10 },
  evidencePanel: { gap: 12 },
  sectionTitle: { color: colours.ink, fontSize: 18, fontWeight: "900" },
  photoGrid: { flexDirection: "row", gap: 10 },
  photoButton: { flex: 1, minHeight: 142, borderRadius: 14, borderWidth: 1, borderColor: colours.border, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoPreview: { width: "100%", height: 104 },
  photoLabel: { marginTop: 8, color: colours.ink, fontWeight: "900" },
  doneBox: { flexDirection: "row", gap: 10, alignItems: "center", padding: 14, borderRadius: 12, backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#bbf7d0" },
  doneText: { flex: 1, color: "#166534", fontWeight: "800", lineHeight: 20 }
});
