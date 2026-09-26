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
  Modal,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "https://rypenger.onrender.com";
const TOKEN_KEY = "@rypenger_token";

function AppContent() {
  const insets = useSafeAreaInsets();

  const [screen, setScreen] = useState("welcome");

  const [token, setToken] = useState(null);
  const [me, setMe] = useState(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");

  const [searchText, setSearchText] = useState("");
  const [users, setUsers] = useState([]);

  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [groupInfo, setGroupInfo] = useState(null);

  const [membersVisible, setMembersVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState("");

  // ==================================================
  // API
  // ==================================================

  const api = async (path, options = {}) => {
    const savedToken =
      token || (await AsyncStorage.getItem(TOKEN_KEY));

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (savedToken) {
      headers.Authorization = `Bearer ${savedToken}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.error || "Něco se pokazilo."
      );
    }

    return data;
  };

  // ==================================================
  // START / LOGIN CHECK
  // ==================================================

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    try {
      const savedToken =
        await AsyncStorage.getItem(TOKEN_KEY);

      if (!savedToken) {
        setScreen("welcome");
        return;
      }

      const response = await fetch(
        `${API_URL}/me`,
        {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.user) {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setScreen("welcome");
        return;
      }

      setToken(savedToken);
      setMe(data.user);
      setScreen("chats");

      loadConversations(savedToken);
    } catch (error) {
      console.log("Kontrola přihlášení:", error);
      setScreen("welcome");
    }
  };

  // ==================================================
  // REGISTRACE
  // ==================================================

  const register = async () => {
    if (
      !username.trim() ||
      !email.trim() ||
      !password
    ) {
      Alert.alert(
        "Rypenger",
        "Vyplň všechna pole."
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Rypenger",
        "Heslo musí mít alespoň 6 znaků."
      );
      return;
    }

    try {
      setLoading(true);

      const data = await api("/register", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      await AsyncStorage.setItem(
        TOKEN_KEY,
        data.token
      );

      setToken(data.token);
      setMe(data.user);

      setUsername("");
      setEmail("");
      setPassword("");

      setScreen("chats");

      loadConversations(data.token);
    } catch (error) {
      Alert.alert(
        "Registrace",
        error.message
      );
    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // PŘIHLÁŠENÍ
  // ==================================================

  const login = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        "Přihlášení",
        "Vyplň email a heslo."
      );
      return;
    }

    try {
      setLoading(true);

      const data = await api("/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      await AsyncStorage.setItem(
        TOKEN_KEY,
        data.token
      );

      setToken(data.token);
      setMe(data.user);

      setEmail("");
      setPassword("");

      setScreen("chats");

      loadConversations(data.token);
    } catch (error) {
      Alert.alert(
        "Přihlášení",
        error.message
      );
    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // ODHLÁŠENÍ
  // ==================================================

  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);

    setToken(null);
    setMe(null);
    setConversations([]);
    setCurrentChat(null);
    setMessages([]);
    setGroupInfo(null);

    setScreen("welcome");
  };

  // ==================================================
  // CHATY
  // ==================================================

  const loadConversations = async (
    customToken = null
  ) => {
    try {
      const savedToken =
        customToken ||
        token ||
        (await AsyncStorage.getItem(TOKEN_KEY));

      if (!savedToken) return;

      const response = await fetch(
        `${API_URL}/conversations`,
        {
          headers: {
            Authorization:
              `Bearer ${savedToken}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setConversations(
          data.conversations || []
        );
      }
    } catch (error) {
      console.log(
        "Načítání chatů:",
        error
      );
    }
  };

  // ==================================================
  // OTEVŘENÍ CHATU
  // ==================================================

  const openChat = async (chat) => {
    setCurrentChat(chat);
    setMessages([]);
    setGroupInfo(null);
    setScreen("chat");

    await loadMessages(chat.id);

    if (chat.type === "group") {
      await loadGroupInfo(chat.id);
    }
  };

  // ==================================================
  // NOVÝ 1:1 CHAT
  // ==================================================

  const openChatWithUser = async (
    selectedUser
  ) => {
    try {
      setLoading(true);

      const data = await api(
        "/conversations",
        {
          method: "POST",
          body: JSON.stringify({
            userId: selectedUser.id,
          }),
        }
      );

      const conversation =
        data.conversation;

      if (!conversation) {
        throw new Error(
          "Server nevrátil vytvořený chat."
        );
      }

      const chat = {
        id: conversation.id,
        type: "private",
        user:
          conversation.user ||
          selectedUser,
      };

      setSearchText("");
      setUsers([]);

      setCurrentChat(chat);
      setMessages([]);
      setGroupInfo(null);
      setScreen("chat");

      await loadMessages(chat.id);
      await loadConversations();
    } catch (error) {
      Alert.alert(
        "Nový chat",
        error.message
      );
    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // ZPRÁVY
  // ==================================================

  const loadMessages = async (
    conversationId,
    silent = false
  ) => {
    try {
      if (!silent) {
        setMessagesLoading(true);
      }

      const data = await api(
        `/conversations/${conversationId}/messages`
      );

      setMessages(
        data.messages || []
      );
    } catch (error) {
      if (!silent) {
        Alert.alert(
          "Zprávy",
          error.message
        );
      }
    } finally {
      if (!silent) {
        setMessagesLoading(false);
      }
    }
  };

  // ==================================================
  // ODESLÁNÍ ZPRÁVY
  // ==================================================

  const sendMessage = async () => {
    const text =
      messageText.trim();

    if (!text || !currentChat) {
      return;
    }

    try {
      setMessageText("");

      const data = await api(
        `/conversations/${currentChat.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            message: text,
          }),
        }
      );

      setMessages((oldMessages) => {
        const newMessages = [
          ...oldMessages,
        ];

        if (data.message) {
          const exists =
            newMessages.some(
              (item) =>
                String(item.id) ===
                String(data.message.id)
            );

          if (!exists) {
            newMessages.push(
              data.message
            );
          }
        }

        if (data.rypMessage) {
          const exists =
            newMessages.some(
              (item) =>
                String(item.id) ===
                String(data.rypMessage.id)
            );

          if (!exists) {
            newMessages.push(
              data.rypMessage
            );
          }
        }

        return newMessages;
      });

      loadConversations();
    } catch (error) {
      setMessageText(text);

      Alert.alert(
        "Zpráva",
        error.message
      );
    }
  };

  // ==================================================
  // VYHLEDÁVÁNÍ UŽIVATELŮ
  // ==================================================

  const searchUsers = async (text) => {
    setSearchText(text);

    if (text.trim().length < 2) {
      setUsers([]);
      return;
    }

    try {
      const data = await api(
        `/users/search?q=${encodeURIComponent(
          text.trim()
        )}`
      );

      setUsers(data.users || []);
    } catch (error) {
      console.log(
        "Hledání uživatelů:",
        error
      );
    }
  };

  // ==================================================
  // SKUPINY
  // ==================================================

  const toggleUserSelection = (
    selectedUser
  ) => {
    setSelectedUsers((oldUsers) => {
      const exists =
        oldUsers.some(
          (item) =>
            String(item.id) ===
            String(selectedUser.id)
        );

      if (exists) {
        return oldUsers.filter(
          (item) =>
            String(item.id) !==
            String(selectedUser.id)
        );
      }

      return [
        ...oldUsers,
        selectedUser,
      ];
    });
  };

  const createGroup = async () => {
    const name =
      groupName.trim();

    if (!name) {
      Alert.alert(
        "Skupina",
        "Napiš název skupiny."
      );
      return;
    }

    if (
      selectedUsers.length === 0
    ) {
      Alert.alert(
        "Skupina",
        "Vyber alespoň jednoho člověka."
      );
      return;
    }

    try {
      setLoading(true);

      const data = await api(
        "/groups",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            memberIds:
              selectedUsers.map(
                (item) => item.id
              ),
          }),
        }
      );

      const group =
        data.group ||
        data.conversation;

      if (!group) {
        throw new Error(
          "Server nevrátil vytvořenou skupinu."
        );
      }

      const chat = {
        id: group.id,
        type: "group",
        name:
          group.name || name,
        members:
          group.members || [],
      };

      setGroupName("");
      setSelectedUsers([]);
      setSearchText("");
      setUsers([]);

      setCurrentChat(chat);
      setMessages([]);
      setScreen("chat");

      await loadConversations();
      await loadMessages(chat.id);
      await loadGroupInfo(chat.id);
    } catch (error) {
      Alert.alert(
        "Skupina",
        error.message
      );
    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // INFORMACE O SKUPINĚ
  // ==================================================

  const loadGroupInfo = async (
    groupId,
    silent = false
  ) => {
    try {
      const data = await api(
        `/groups/${groupId}`
      );

      setGroupInfo(
        data.group || data
      );
    } catch (error) {
      if (!silent) {
        Alert.alert(
          "Skupina",
          error.message
        );
      }
    }
  };

  // ==================================================
  // PŘEJMENOVÁNÍ SKUPINY
  // ==================================================

  const renameGroup = async () => {
    const name =
      renameText.trim();

    if (!name) {
      Alert.alert(
        "Skupina",
        "Název nemůže být prázdný."
      );
      return;
    }

    if (!currentChat) return;

    try {
      const data = await api(
        `/groups/${currentChat.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name,
          }),
        }
      );

      const newName =
        data.group?.name ||
        data.name ||
        name;

      setCurrentChat((old) => ({
        ...old,
        name: newName,
      }));

      setGroupInfo((old) =>
        old
          ? {
              ...old,
              name: newName,
            }
          : old
      );

      setRenameVisible(false);
      setRenameText("");

      loadConversations();
    } catch (error) {
      Alert.alert(
        "Přejmenování",
        error.message
      );
    }
  };

  // ==================================================
  // SMAZÁNÍ VLASTNÍ ZPRÁVY
  // ==================================================

  const deleteMessage = (
    message
  ) => {
    const senderId =
      message.senderId ??
      message.sender_id ??
      message.userId ??
      message.user_id;

    if (
      !me ||
      String(senderId) !==
        String(me.id)
    ) {
      return;
    }

    Alert.alert(
      "Smazat zprávu?",
      "Zpráva bude odstraněna.",
      [
        {
          text: "Zrušit",
          style: "cancel",
        },
        {
          text: "Smazat",
          style: "destructive",
          onPress: async () => {
            try {
              await api(
                `/messages/${message.id}`,
                {
                  method: "DELETE",
                }
              );

              setMessages((old) =>
                old.filter(
                  (item) =>
                    String(item.id) !==
                    String(message.id)
                )
              );
            } catch (error) {
              Alert.alert(
                "Chyba",
                error.message
              );
            }
          },
        },
      ]
    );
  };

  // ==================================================
  // AUTOMATICKÉ OBNOVOVÁNÍ
  // ==================================================

  useEffect(() => {
    if (
      screen !== "chat" ||
      !currentChat?.id
    ) {
      return;
    }

    const interval =
      setInterval(() => {
        loadMessages(
          currentChat.id,
          true
        );

        if (
          currentChat.type ===
          "group"
        ) {
          loadGroupInfo(
            currentChat.id,
            true
          );
        }

        loadConversations();
      }, 3000);

    return () =>
      clearInterval(interval);
  }, [
    screen,
    currentChat?.id,
    currentChat?.type,
  ]);

  // ==================================================
  // WELCOME
  // ==================================================

  const renderWelcome = () => (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.logo}>
          Rypenger
        </Text>

        <Text style={styles.subtitle}>
          Messenger, kde může kecat i Rýp 😈
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            setScreen("login")
          }
        >
          <Text style={styles.buttonText}>
            Přihlásit se
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            setScreen("register")
          }
        >
          <Text style={styles.secondaryText}>
            Vytvořit účet
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ==================================================
  // LOGIN
  // ==================================================

  const renderLogin = () => (
    <SafeAreaView style={styles.safe}>
      <View style={styles.form}>
        <TouchableOpacity
          onPress={() =>
            setScreen("welcome")
          }
        >
          <Text style={styles.back}>
            ← Zpět
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          Přihlášení
        </Text>

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor="#777"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Heslo"
          placeholderTextColor="#777"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={login}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading
              ? "Přihlašuji..."
              : "Přihlásit"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ==================================================
  // REGISTER
  // ==================================================

  const renderRegister = () => (
    <SafeAreaView style={styles.safe}>
      <View style={styles.form}>
        <TouchableOpacity
          onPress={() =>
            setScreen("welcome")
          }
        >
          <Text style={styles.back}>
            ← Zpět
          </Text>
        </TouchableOpacity>

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
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Heslo"
          placeholderTextColor="#777"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={register}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading
              ? "Vytvářím..."
              : "Registrovat"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ==================================================
  // SEZNAM CHATŮ
  // ==================================================

  const renderChats = () => (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            Rypenger
          </Text>

          <Text style={styles.headerUser}>
            @{me?.username || ""}
          </Text>
        </View>

        <TouchableOpacity
          onPress={logout}
        >
          <Text style={styles.headerAction}>
            Odhlásit
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.topButtons}>
        <TouchableOpacity
          style={styles.topButton}
          onPress={() => {
            setSearchText("");
            setUsers([]);
            setScreen("newChat");
          }}
        >
          <Text style={styles.topButtonText}>
            + Nový chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.topButton}
          onPress={() => {
            setSearchText("");
            setUsers([]);
            setSelectedUsers([]);
            setGroupName("");
            setScreen("newGroup");
          }}
        >
          <Text style={styles.topButtonText}>
            + Skupina
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) =>
          String(item.id)
        }
        contentContainerStyle={
          conversations.length === 0
            ? styles.emptyList
            : styles.list
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Zatím tu nejsou žádné chaty.
          </Text>
        }
        renderItem={({ item }) => {
          const isGroup =
            item.type === "group";

          const displayName =
            isGroup
              ? item.name ||
                "Skupina"
              : item.user?.username ||
                item.username ||
                "Uživatel";

          return (
            <TouchableOpacity
              style={styles.chatItem}
              onPress={() =>
                openChat(item)
              }
            >
              <View style={styles.chatAvatar}>
                <Text style={styles.avatarText}>
                  {isGroup
                    ? "👥"
                    : "👤"}
                </Text>
              </View>

              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>
                  {displayName}
                </Text>

                {isGroup ? (
                  <Text style={styles.chatStatus}>
                    Skupina
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.chatStatus,
                      item.user?.online &&
                        styles.onlineText,
                    ]}
                  >
                    {item.user?.online
                      ? "● online"
                      : "● offline"}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );

  // ==================================================
  // NOVÝ CHAT
  // ==================================================

  const renderNewChat = () => (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            setScreen("chats")
          }
        >
          <Text style={styles.headerAction}>
            ← Zpět
          </Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Nový chat
        </Text>

        <View style={{ width: 45 }} />
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Hledat uživatele..."
        placeholderTextColor="#777"
        value={searchText}
        onChangeText={searchUsers}
        autoCapitalize="none"
        autoFocus
      />

      <FlatList
        data={users}
        keyExtractor={(item) =>
          String(item.id)
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Hledání začne po zadání alespoň 2 znaků.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userItem}
            onPress={() =>
              openChatWithUser(item)
            }
          >
            <View style={styles.chatAvatar}>
              <Text style={styles.avatarText}>
                👤
              </Text>
            </View>

            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>
                {item.username}
              </Text>

              <Text
                style={[
                  styles.chatStatus,
                  item.online &&
                    styles.onlineText,
                ]}
              >
                {item.online
                  ? "● online"
                  : "● offline"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );

  // ==================================================
  // NOVÁ SKUPINA
  // ==================================================

  const renderNewGroup = () => (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            setScreen("chats")
          }
        >
          <Text style={styles.headerAction}>
            ← Zpět
          </Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Nová skupina
        </Text>

        <View style={{ width: 45 }} />
      </View>

      <View style={styles.groupForm}>
        <TextInput
          style={styles.input}
          placeholder="Název skupiny"
          placeholderTextColor="#777"
          value={groupName}
          onChangeText={setGroupName}
        />

        <TextInput
          style={styles.searchInput}
          placeholder="Hledat lidi..."
          placeholderTextColor="#777"
          value={searchText}
          onChangeText={searchUsers}
          autoCapitalize="none"
        />

        <Text style={styles.selectedText}>
          Vybráno:{" "}
          {selectedUsers.length}
        </Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) =>
          String(item.id)
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const selected =
            selectedUsers.some(
              (user) =>
                String(user.id) ===
                String(item.id)
            );

          return (
            <TouchableOpacity
              style={[
                styles.userItem,
                selected &&
                  styles.selectedUser,
              ]}
              onPress={() =>
                toggleUserSelection(item)
              }
            >
              <View style={styles.chatAvatar}>
                <Text style={styles.avatarText}>
                  {selected
                    ? "✓"
                    : "👤"}
                </Text>
              </View>

              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>
                  {item.username}
                </Text>

                <Text
                  style={[
                    styles.chatStatus,
                    item.online &&
                      styles.onlineText,
                  ]}
                >
                  {item.online
                    ? "● online"
                    : "● offline"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={createGroup}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? "Vytvářím..."
            : "Vytvořit skupinu"}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  // ==================================================
  // CHAT
  // ==================================================

  const renderChat = () => (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.chatKeyboard}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        keyboardVerticalOffset={
          Platform.OS === "android"
            ? 0
            : 0
        }
      >
        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={() => {
              setScreen("chats");
              setCurrentChat(null);
              setMessages([]);
              setGroupInfo(null);
            }}
          >
            <Text style={styles.headerAction}>
              ←
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chatHeaderCenter}
            onPress={() => {
              if (
                currentChat?.type ===
                "group"
              ) {
                setMembersVisible(true);
              }
            }}
          >
            <Text
              style={styles.chatHeaderTitle}
              numberOfLines={1}
            >
              {currentChat?.type ===
              "group"
                ? currentChat?.name ||
                  groupInfo?.name ||
                  "Skupina"
                : currentChat?.user
                    ?.username ||
                  currentChat?.username ||
                  "Chat"}
            </Text>

            {currentChat?.type ===
            "group" ? (
              <Text style={styles.chatHeaderSub}>
                {groupInfo?.members
                  ?.length || 0}{" "}
                členů
              </Text>
            ) : (
              <Text
                style={[
                  styles.chatHeaderSub,
                  currentChat?.user
                    ?.online &&
                    styles.onlineText,
                ]}
              >
                {currentChat?.user
                  ?.online
                  ? "● online"
                  : "● offline"}
              </Text>
            )}
          </TouchableOpacity>

          {currentChat?.type ===
          "group" ? (
            <TouchableOpacity
              onPress={() => {
                setRenameText(
                  currentChat?.name ||
                    groupInfo?.name ||
                    ""
                );
                setRenameVisible(true);
              }}
            >
              <Text style={styles.headerAction}>
                ✎
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 30 }} />
          )}
        </View>

        <FlatList
          style={styles.messagesList}
          data={messages}
          keyExtractor={(item, index) =>
            String(
              item.id || index
            )
          }
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            messagesLoading ? null : (
              <Text style={styles.emptyText}>
                Začni konverzaci.
              </Text>
            )
          }
          renderItem={({ item }) => {
            const senderId =
              item.senderId ??
              item.sender_id ??
              item.userId ??
              item.user_id;

            const isMine =
              String(senderId) ===
              String(me?.id);

            const isRyp =
              item.isRyp === true ||
              item.is_ryp === true ||
              item.senderUsername ===
                "Rýp" ||
              item.username === "Rýp";

            return (
              <TouchableOpacity
                activeOpacity={
                  isMine ? 0.7 : 1
                }
                onLongPress={() =>
                  deleteMessage(item)
                }
                style={[
                  styles.messageRow,
                  isMine &&
                    styles.myMessageRow,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isMine &&
                      styles.myMessageBubble,
                    isRyp &&
                      styles.rypBubble,
                  ]}
                >
                  {currentChat?.type ===
                    "group" &&
                    !isMine && (
                      <Text
                        style={[
                          styles.senderName,
                          isRyp &&
                            styles.rypName,
                        ]}
                      >
                        {isRyp
                          ? "😈 Rýp"
                          : item.senderUsername ||
                            item.username ||
                            "Uživatel"}
                      </Text>
                    )}

                  <Text
                    style={[
                      styles.messageText,
                      isMine &&
                        styles.myMessageText,
                    ]}
                  >
                    {item.content ||
                      item.message ||
                      ""}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        <View
          style={[
            styles.inputBar,
            {
              paddingBottom:
                Math.max(insets.bottom, 8),
            },
          ]}
        >
          <TextInput
            style={styles.messageInput}
            placeholder="Napiš zprávu..."
            placeholderTextColor="#777"
            value={messageText}
            onChangeText={setMessageText}
            multiline
          />

          <TouchableOpacity
            style={styles.sendButton}
            onPress={sendMessage}
          >
            <Text style={styles.sendText}>
              ➤
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ČLENOVÉ */}
      <Modal
        visible={membersVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setMembersVisible(false)
        }
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Členové skupiny
            </Text>

            <FlatList
              data={
                groupInfo?.members || []
              }
              keyExtractor={(item) =>
                String(item.id)
              }
              style={styles.memberList}
              renderItem={({ item }) => {
                const isRyp =
                  item.isRyp ||
                  item.is_ryp ||
                  item.username === "Rýp";

                return (
                  <View
                    style={
                      styles.memberItem
                    }
                  >
                    <Text
                      style={
                        styles.memberName
                      }
                    >
                      {isRyp
                        ? "😈 Rýp"
                        : item.username}
                    </Text>

                    <Text
                      style={[
                        styles.memberStatus,
                        (item.online ||
                          isRyp) &&
                          styles.onlineText,
                      ]}
                    >
                      {isRyp ||
                      item.online
                        ? "● online"
                        : "● offline"}
                    </Text>
                  </View>
                );
              }}
            />

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() =>
                setMembersVisible(false)
              }
            >
              <Text style={styles.secondaryText}>
                Zavřít
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PŘEJMENOVÁNÍ */}
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setRenameVisible(false)
        }
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Přejmenovat skupinu
            </Text>

            <TextInput
              style={styles.input}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Název skupiny"
              placeholderTextColor="#777"
              autoFocus
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={renameGroup}
            >
              <Text style={styles.buttonText}>
                Uložit
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() =>
                setRenameVisible(false)
              }
            >
              <Text style={styles.secondaryText}>
                Zrušit
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  // ==================================================
  // ROUTER
  // ==================================================

  if (screen === "welcome") {
    return (
      <>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#050505"
        />
        {renderWelcome()}
      </>
    );
  }

  if (screen === "login") {
    return (
      <>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#050505"
        />
        {renderLogin()}
      </>
    );
  }

  if (screen === "register") {
    return (
      <>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#050505"
        />
        {renderRegister()}
      </>
    );
  }

  if (screen === "newChat") {
    return (
      <>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#050505"
        />
        {renderNewChat()}
      </>
    );
  }

  if (screen === "newGroup") {
    return (
      <>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#050505"
        />
        {renderNewGroup()}
      </>
    );
  }

  if (screen === "chat") {
    return (
      <>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#050505"
        />
        {renderChat()}
      </>
    );
  }

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#050505"
      />
      {renderChats()}
    </>
  );
}

// ==================================================
// STYLES
// ==================================================

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050505",
  },

  chatKeyboard: {
    flex: 1,
  },

  messagesList: {
    flex: 1,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  logo: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    marginBottom: 10,
  },

  subtitle: {
    color: "#999999",
    fontSize: 16,
    marginBottom: 40,
    textAlign: "center",
  },

  form: {
    flex: 1,
    padding: 25,
    justifyContent: "center",
  },

  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 25,
  },

  back: {
    color: "#5da9ff",
    fontSize: 16,
    marginBottom: 25,
  },

  input: {
    backgroundColor: "#151515",
    color: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 16,
  },

  searchInput: {
    backgroundColor: "#151515",
    color: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    margin: 15,
    fontSize: 16,
  },

  primaryButton: {
    backgroundColor: "#1877f2",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
    marginHorizontal: 15,
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },

  secondaryButton: {
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
    marginHorizontal: 15,
  },

  secondaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  header: {
    height: 70,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#202020",
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
  },

  headerUser: {
    color: "#777777",
    fontSize: 12,
    marginTop: 2,
  },

  headerAction: {
    color: "#5da9ff",
    fontSize: 16,
    fontWeight: "700",
  },

  topButtons: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  topButton: {
    flex: 1,
    backgroundColor: "#151515",
    borderRadius: 10,
    paddingVertical: 13,
    marginHorizontal: 5,
    alignItems: "center",
  },

  topButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },

  list: {
    padding: 10,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyText: {
    color: "#666666",
    fontSize: 15,
    textAlign: "center",
    padding: 20,
  },

  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111111",
    borderRadius: 13,
    padding: 12,
    marginBottom: 8,
  },

  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#202020",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarText: {
    fontSize: 22,
  },

  chatInfo: {
    flex: 1,
  },

  chatName: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },

  chatStatus: {
    color: "#666666",
    fontSize: 12,
    marginTop: 4,
  },

  onlineText: {
    color: "#35d16f",
  },

  userItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111111",
    borderRadius: 13,
    padding: 12,
    marginBottom: 8,
  },

  selectedUser: {
    borderWidth: 1,
    borderColor: "#1877f2",
  },

  groupForm: {
    paddingTop: 15,
  },

  selectedText: {
    color: "#999999",
    paddingHorizontal: 15,
    marginBottom: 5,
  },

  chatHeader: {
    height: 65,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#202020",
  },

  chatHeaderCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },

  chatHeaderTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },

  chatHeaderSub: {
    color: "#666666",
    fontSize: 11,
    marginTop: 2,
  },

  messages: {
    padding: 12,
    paddingBottom: 15,
    flexGrow: 1,
  },

  messageRow: {
    width: "100%",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  myMessageRow: {
    alignItems: "flex-end",
  },

  messageBubble: {
    maxWidth: "82%",
    backgroundColor: "#171717",
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  myMessageBubble: {
    backgroundColor: "#1877f2",
  },

  rypBubble: {
    backgroundColor: "#292018",
    borderWidth: 1,
    borderColor: "#704d20",
  },

  messageText: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 21,
  },

  myMessageText: {
    color: "#ffffff",
  },

  senderName: {
    color: "#5da9ff",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },

  rypName: {
    color: "#ffad42",
  },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: "#0b0b0b",
    borderTopWidth: 1,
    borderTopColor: "#202020",
  },

  messageInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: "#171717",
    color: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 8,
  },

  sendButton: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: "#1877f2",
    alignItems: "center",
    justifyContent: "center",
  },

  sendText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },

  modalBackground: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },

  modalBox: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: "80%",
  },

  modalTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 18,
  },

  memberList: {
    marginBottom: 10,
  },

  memberItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },

  memberName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  memberStatus: {
    color: "#666666",
    fontSize: 12,
    marginTop: 3,
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
