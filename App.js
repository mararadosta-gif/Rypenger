import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from "react-native";

export default function App() {
  const [screen, setScreen] = useState("welcome");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

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
            <Text style={styles.buttonText}>Přihlásit se</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setScreen("register")}
          >
            <Text style={styles.secondaryText}>Vytvořit účet</Text>
          </TouchableOpacity>
        </View>
      )}

      {screen === "login" && (
        <View style={styles.form}>
          <Text style={styles.title}>Přihlášení</Text>

          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor="#777"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Heslo"
            placeholderTextColor="#777"
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.button}
            onPress={() => setScreen("chats")}
          >
            <Text style={styles.buttonText}>Přihlásit</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setScreen("welcome")}>
            <Text style={styles.back}>← Zpět</Text>
          </TouchableOpacity>
        </View>
      )}

      {screen === "register" && (
        <View style={styles.form}>
          <Text style={styles.title}>Vytvoření účtu</Text>

          <TextInput
            style={styles.input}
            placeholder="Uživatelské jméno"
            placeholderTextColor="#777"
          />

          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor="#777"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Heslo"
            placeholderTextColor="#777"
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.button}
            onPress={() => setScreen("chats")}
          >
            <Text style={styles.buttonText}>Registrovat</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setScreen("welcome")}>
            <Text style={styles.back}>← Zpět</Text>
          </TouchableOpacity>
        </View>
      )}

      {screen === "chats" && (
        <View style={styles.chats}>
          <Text style={styles.title}>Rypenger</Text>

          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Žádné chaty</Text>
            <Text style={styles.emptyText}>
              Tady se později objeví tvoje konverzace.
            </Text>

            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>+ Nový chat</Text>
            </TouchableOpacity>
          </View>
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
});
