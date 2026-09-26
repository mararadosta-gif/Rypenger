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
  FlatList,
  KeyboardAvoidingView,
  Platform,
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

  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);

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
        loadConversations(token);
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

      loadConversations(data.token);
    } catch (error) {
      Alert.alert(
        "Chyba připojení",
        "Nepodařilo se spojit se serverem."
      );
    } finally {
      setLoading(false);
    }
  };

  // NAČTENÍ CHATŮ
  const loadConversations = async (savedToken = null) => {
    try {
      const token =
        savedToken ||
        (await AsyncStorage.getItem(TOKEN_KEY));

      if (!token) return;

      const response = await fetch(
        `${API_URL}/conversations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.log("Načítání chatů:", error);
    }
  };

  // VYHLEDÁNÍ UŽIVATELŮ
  const searchUsers = async (text) => {
    setSearch(text);

    if (text.trim().length < 2) {
      setUsers([]);
      return;
    }

    setSearchLoading(true);

    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);

      const response = await fetch(
        `${API_URL}/users/search?q=${encodeURIComponent(
          text.trim()
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setUsers(data.users || []);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.log("Hledání uživatelů:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  // OTEVŘENÍ / VYTVOŘENÍ CHATU
  const openChatWithUser = async (selectedUser) => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);

      const response = await fetch(
        `${API_URL}/conversations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: selectedUser.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          "Chyba",
          data.error || "Chat se nepodařilo vytvořit."
        );
        return;
      }

      const chat = {
        id: data.conversation.id,
        user: data.conversation.user,
      };

      setCurrentChat(chat);
      setSearch("");
      setUsers([]);
      setMessages([]);
      setScreen("chat");

      loadMessages(chat.id);
      loadConversations(token);
    } catch (error) {
      Alert.alert(
        "Chyba připojení",
        "Nepodařilo se spojit se serverem."
      );
    }
  };

  // OTEVŘENÍ EXISTUJÍCÍHO CHATU
  const openExistingChat = (chat) => {
    setCurrentChat(chat);
    setMessages([]);
    setScreen("chat");
    loadMessages(chat.id);
  };

  // NAČTENÍ ZPRÁV
  const loadMessages = async (conversationId) => {
    setMessagesLoading(true);

    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);

      const response = await fetch(
        `${API_URL}/conversations/${conversationId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.log("Načítání zpráv:", error);
    } finally {
      setMessagesLoading(false);
    }
  };

  // ODESLÁNÍ ZPRÁVY
  const sendMessage = async () => {
    const text = messageText.trim();

    if (!text || !currentChat) return;

    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);

      const response = await fetch(
        `${API_URL}/conversations/${currentChat.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          "Chyba",
          data.error || "Zprávu se nepodařilo odeslat."
        );
        return;
      }

      setMessages((oldMessages) => [
        ...oldMessages,
        data.message,
      ]);

      setMessageText("");
    } catch (error) {
      Alert.alert(
        "Chyba připojení",
        "Nepodařilo se odeslat zprávu."
      );
    }
  };

  // ODHLÁŠENÍ
  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);

    setUser(null);
    setEmail("");
    setPassword("");
    setConversations([]);
    setCurrentChat(null);
    setMessages([]);
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

      {/* CHAT LIST */}
      {screen === "chats" && (
        <View style={styles.chats}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                Rypenger
              </Text>

              {user && (
                <Text style={styles.loggedUser}>
                  @{user.username}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.newChatButton}
            onPress={() => {
              setSearch("");
              setUsers([]);
              setScreen("newChat");
            }}
          >
            <Text style={styles.newChatText}>
              + Nový chat
            </Text>
          </TouchableOpacity>

          {conversations.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                Žádné chaty
              </Text>

              <Text style={styles.emptyText}>
                Založ první konverzaci.
              </Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingTop: 15,
              }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.chatItem}
                  onPress={() =>
                    openExistingChat(item)
                  }
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.user.username
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>

                  <Text style={styles.chatName}>
                    {item.user.username}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          <TouchableOpacity onPress={logout}>
            <Text style={styles.logout}>
              Odhlásit se
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* NOVÝ CHAT */}
      {screen === "newChat" && (
        <View style={styles.chats}>
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={() => {
                setSearch("");
                setUsers([]);
                setScreen("chats");
              }}
            >
              <Text style={styles.backButton}>
                ←
              </Text>
            </TouchableOpacity>

            <Text style={styles.topTitle}>
              Nový chat
            </Text>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Hledat uživatele..."
            placeholderTextColor="#777"
            value={search}
            onChangeText={searchUsers}
            autoCapitalize="none"
            autoFocus
          />

          {searchLoading && (
            <Text style={styles.searchStatus}>
              Hledám...
            </Text>
          )}

          {!searchLoading &&
            search.length >= 2 &&
            users.length === 0 && (
              <Text style={styles.searchStatus}>
                Žádný uživatel nenalezen.
              </Text>
            )}

          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userItem}
                onPress={() =>
                  openChatWithUser(item)
                }
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.username
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>

                <View>
                  <Text style={styles.userName}>
                    {item.username}
                  </Text>

                  <Text style={styles.userEmail}>
                    {item.email}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* CHAT */}
      {screen === "chat" && currentChat && (
        <KeyboardAvoidingView
          style={styles.chatScreen}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity
              onPress={() => {
                setCurrentChat(null);
                setMessages([]);
                setScreen("chats");
                loadConversations();
              }}
            >
              <Text style={styles.backButton}>
                ←
              </Text>
            </TouchableOpacity>

            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName}>
                {currentChat.user.username}
              </Text>

              <Text style={styles.chatHeaderStatus}>
                online chat
              </Text>
            </View>
          </View>

          {messagesLoading ? (
            <View style={styles.center}>
              <Text style={styles.loadingText}>
                Načítám zprávy...
              </Text>
            </View>
          ) : (
            <FlatList
              style={styles.messageList}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                padding: 15,
                flexGrow: 1,
                justifyContent:
                  messages.length === 0
                    ? "center"
                    : "flex-end",
              }}
              renderItem={({ item }) => {
                const mine =
                  String(item.senderId) ===
                  String(user?.id);

                return (
                  <View
                    style={[
                      styles.messageRow,
                      mine
                        ? styles.messageRowMine
                        : styles.messageRowOther,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        mine
                          ? styles.myBubble
                          : styles.otherBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          mine
                            ? styles.myMessageText
                            : styles.otherMessageText,
                        ]}
                      >
                        {item.message}
                      </Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyChatText}>
                  Zatím tu není žádná zpráva.
                  {"\n"}
                  Napiš něco 😏
                </Text>
              }
            />
          )}

          <View style={styles.messageInputRow}>
            <TextInput
              style={styles.
