import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "https://rypenger.onrender.com";
const TOKEN_KEY = "@rypenger_token";

export default function App() {
  const [screen, setScreen] = useState("welcome");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(true);
  const [user, setUser] = useState(null);

  // AUTOMATICKÉ PŘIHLÁŠENÍ
  useEffect(() => {
    checkSavedLogin();
  }, []);

  const checkSavedLogin = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);

      if (!token) {
        setCheckingLogin(false);
        return;
      }

      const response = await fetch(`${API_URL}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setUser(data.user);
        setScreen("chats");
      } else {
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
    } catch (error) {
      console.log("Kontrola přihlášení:", error);
    } finally {
      setCheckingLogin(false);
    }
  };

  // REGISTRACE
  const register = async () => {
    if (!username || !email || !password) {
      Alert.alert("Chyba", "Vyplň všechna pole.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          "Registrace",
          data.error || "Registrace se nepodařila."
        );
        return;
      }

      await AsyncStorage.setItem(
        TOKEN_KEY,
        data.token
      );

      setUser(data.user);
      setUsername("");
      setEmail("");
      setPassword("");
      setScreen("chats");

      Alert.alert("Hotovo", "Účet byl vytvořen.");
    } catch (error) {
      Alert.alert(
        "Chyba připojení",
        "Nepodařilo se spojit se serverem."
      );
    } finally {
      setLoading(false);
    }
  };

  // PŘIHLÁŠENÍ
  const login = async () => {
    if (!email || !password) {
      Alert.alert("Chyba", "Zadej e-mail a heslo.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          "Přihlášení",
          data.error || "Přihlášení se nepodařilo."
        );
        return;
      }

      await AsyncStorage.setItem(
        TOKEN_KEY,
        data.token
      );

      setUser(data.user);
      setEmail("");
      setPassword("");
      setScreen("chats");
    } catch (error) {
      Alert.alert(
        "Chyba připojení",
        "Nepodařilo se spojit se serverem."
      );
    } finally {
      setLoading(false);
    }
  };

  // ODHLÁŠENÍ
  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);

    setUser(null);
    setEmail("");
    setPassword("");
    setScreen("welcome");
  };

  // NAČÍTÁNÍ
  if (checkingLogin) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.center}>
          <Text style={styles.logo}>RYPENGER</Text>
          <Text style={styles.loadingText}>
            Přihlašuji...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* WELCOME */}
      {screen === "welcome" && (
        <View style={styles.center}>
          <Text style={styles.logo}>RYPENGER</Text>

          <Text style={styles.subtitle}>
            Messenger, kde může kecat i Rýp 😏
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => setScreen("login")}
          >
            <Text style={styles.buttonText}>
              Přihlásit se
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setScreen("register")}
          >
            <Text style={styles.secondaryText}>
              Vytvořit účet
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LOGIN */}
      {screen === "login" && (
        <View style={styles.form}>
          <Text style={styles.title}>
            Přihlášení
          </Text>

          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor="#777"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Heslo"
            placeholderTextColor="#777"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={login}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading
                ? "Přihlašuji..."
                : "Přihlásit"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setScreen("welcome")}
          >
            <Text style={styles.back}>
              ← Zpět
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* REGISTER */}
      {screen === "register" && (
        <View style={styles.form}>
          <Text style={styles.title}>
            Vytvoření účtu
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Uživatelské jméno"
            placeholderTextColor="#777"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor="#777"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Heslo"
            placeholderTextColor="#777"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={register}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading
                ? "Vytvářím účet..."
                : "Registrovat"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setScreen("welcome")}
          >
            <Text style={styles.back}>
              ← Zpět
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CHATS */}
      {screen === "chats" && (
        <View style={styles.chats}>
          <Text style={styles.title}>
            Rypenger
          </Text>

          {user && (
            <Text style={styles.loggedUser}>
              Přihlášen jako: {user.username}
            </Text>
          )}

          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              Žádné chaty
            </Text>

            <Text style={styles.emptyText}>
              Tady se později objeví tvoje konverzace.
            </Text>

            <TouchableOpacity
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                + Nový chat
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={logout}>
            <Text style={styles.logout}>
              Odhlásit se
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07111f",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },

  logo: {
    fontSize: 42,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 2,
  },

  subtitle: {
    color: "#9aa8b8",
    fontSize: 16,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 35,
  },

  loadingText: {
    color: "#8997a8",
    fontSize: 16,
    marginTop: 15,
  },

  form: {
    flex: 1,
    justifyContent: "center",
    padding: 25,
  },

  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 25,
  },

  input: {
    backgroundColor: "#111e2d",
    color: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    marginBottom: 12,
  },

  button: {
    backgroundColor: "#1677ff",
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 25,
    alignItems: "center",
    marginTop: 10,
    width: "100%",
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },

  secondaryButton: {
    paddingVertical: 15,
    paddingHorizontal: 25,
    marginTop: 8,
  },

  secondaryText: {
    color: "#4d9aff",
    fontSize: 16,
    fontWeight: "600",
  },

  back: {
    color: "#4d9aff",
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
  },

  chats: {
    flex: 1,
    padding: 20,
  },

  loggedUser: {
    color: "#8997a8",
    fontSize: 15,
  },

  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "700",
  },

  emptyText: {
    color: "#8997a8",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },

  logout: {
    color: "#ff5c5c",
    textAlign: "center",
    fontSize: 16,
    marginBottom: 15,
  },
});
