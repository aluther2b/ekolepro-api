// src/components/ActiveSessionsList.jsx
import React, { useEffect, useState } from "react";
import { 
  View, Text, StyleSheet, FlatList, 
  ActivityIndicator, TouchableOpacity, Alert, RefreshControl 
} from "react-native";
import { getActiveSessions, forceLogoutSession } from "../services/admin/sessions.service.js";

export default function ActiveSessionsList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Récupère les sessions
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await getActiveSessions();
      setSessions(data);
    } catch (err) {
      console.error(err);
      Alert.alert("Erreur", "Impossible de récupérer les sessions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Rafraîchissement manuel
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  };

  // Déconnexion d'une session
  const handleLogout = async (sessionId) => {
    Alert.alert(
      "Déconnecter la session",
      "Voulez-vous vraiment déconnecter cette session ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnecter",
          style: "destructive",
          onPress: async () => {
            try {
              await forceLogoutSession(sessionId);
              Alert.alert("Succès", "Session déconnectée !");
              fetchSessions(); // actualise la liste
            } catch (err) {
              console.error(err);
              Alert.alert("Erreur", "Impossible de déconnecter cette session.");
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.user_name} ({item.role})</Text>
      <Text style={styles.text}>École: {item.ecole}</Text>
      <Text style={styles.text}>Device: {item.device_id}</Text>
      <Text style={styles.text}>Connecté: {new Date(item.connected_at).toLocaleString()}</Text>
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => handleLogout(item.id)}
      >
        <Text style={styles.buttonText}>Déconnecter</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#6200ee" />;

  if (sessions.length === 0) return (
    <View style={styles.empty}>
      <Text>Aucune session active pour le moment.</Text>
    </View>
  );

  return (
    <FlatList
      data={sessions}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ padding: 16 }}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
  },
  text: {
    fontSize: 14,
    marginTop: 4,
  },
  button: {
    marginTop: 10,
    backgroundColor: "#d32f2f",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  empty: {
    flex: 1,
    marginTop: 50,
    alignItems: "center",
  },
});