import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileScreen from './screens/ProfileScreen';
import JobsScreen from './screens/JobsScreen';
import MessagesScreen from './screens/MessagesScreen';
import LoginScreen from './screens/LoginScreen';
import CompanyJobsScreen from './screens/CompanyJobsScreen';
import ApplicationScreen from './screens/ApplicationScreen';
import { getUnreadMessageCount, readDatabase, writeDatabase } from './storage';

const Tab = createBottomTabNavigator();

// Viser indlæsning, login eller faner ud fra den aktive bruger.
function AppContent() {
  const insets = useSafeAreaInsets();
  const [activeAccount, setActiveAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const refreshUnreadMessageCount = useCallback(async () => {
    if (!activeAccount) {
      setUnreadMessageCount(0);
      return;
    }
    try {
      const database = await readDatabase();
      setUnreadMessageCount(getUnreadMessageCount(database, activeAccount.id));
    } catch {
      Alert.alert('Kunne ikke hente beskeder', 'Prøv at åbne beskedfanen igen.');
    }
  }, [activeAccount]);

  useEffect(() => {
    readDatabase()
      .then(database => {
        const account = database.accounts.find(item => item.id === database.activeUserId);
        setActiveAccount(account || null);
      })
      .catch(() => setActiveAccount(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refreshUnreadMessageCount();
  }, [refreshUnreadMessageCount]);

  // Gemmer at brugeren er logget ud og viser login igen.
  const handleLogout = async () => {
    try {
      const database = await readDatabase();
      database.activeUserId = null;
      await writeDatabase(database);
      setActiveAccount(null);
      setUnreadMessageCount(0);
    } catch {
      Alert.alert('Kunne ikke logge ud', 'Prøv igen om et øjeblik.');
    }
  };

  return (
    <>
      <StatusBar style="auto" />
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1f77d2" />
        </View>
      ) : activeAccount ? (
      <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#1f77d2',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#e0e0e0',
            height: 58 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 5),
            paddingTop: 5,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        {activeAccount.role === 'company' ? (
          <>
            <Tab.Screen name="CompanyJobs" options={{ tabBarLabel: 'Mine jobopslag', tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>💼</Text> }}>
              {() => <CompanyJobsScreen company={activeAccount} onLogout={handleLogout} />}
            </Tab.Screen>
            <Tab.Screen name="Messages" options={{ tabBarLabel: 'Beskeder', tabBarBadge: unreadMessageCount || undefined, tabBarBadgeStyle: { backgroundColor: '#d32f2f', color: '#fff' }, tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>💬</Text> }}>
              {props => <MessagesScreen {...props} account={activeAccount} onUnreadMessageCountChange={setUnreadMessageCount} />}
            </Tab.Screen>
          </>
        ) : (
          <>
            <Tab.Screen name="Profile" options={{ tabBarLabel: 'Profil', tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>👤</Text> }}>
              {() => <ProfileScreen userId={activeAccount.id} onLogout={handleLogout} />}
            </Tab.Screen>
            <Tab.Screen name="Jobs" options={{ tabBarLabel: 'Jobs', tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>💼</Text> }}>
              {props => <JobsScreen {...props} userId={activeAccount.id} />}
            </Tab.Screen>
            <Tab.Screen name="Messages" options={{ tabBarLabel: 'Beskeder', tabBarBadge: unreadMessageCount || undefined, tabBarBadgeStyle: { backgroundColor: '#d32f2f', color: '#fff' }, tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>💬</Text> }}>
              {props => <MessagesScreen {...props} account={activeAccount} onUnreadMessageCountChange={setUnreadMessageCount} />}
            </Tab.Screen>
            <Tab.Screen name="Apply" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}>
              {props => <ApplicationScreen {...props} userId={activeAccount.id} />}
            </Tab.Screen>
          </>
        )}
      </Tab.Navigator>
      </NavigationContainer>
      ) : <LoginScreen onLogin={setActiveAccount} />}
    </>
  );
}

// Starter appen med safe-area-støtte til telefonens kanter.
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
