import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileScreen from './screens/ProfileScreen';
import JobsScreen from './screens/JobsScreen';
import MessagesScreen from './screens/MessagesScreen';
import LoginScreen from './screens/LoginScreen';
import CompanyJobsScreen from './screens/CompanyJobsScreen';
import ApplicationScreen from './screens/ApplicationScreen';
import { readDatabase, writeDatabase } from './storage';

const Tab = createBottomTabNavigator();

// Viser indlæsning, login eller faner ud fra den aktive bruger.
function AppContent() {
  const insets = useSafeAreaInsets();
  const [activeAccount, setActiveAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    readDatabase()
      .then(database => {
        const account = database.accounts.find(item => item.id === database.activeUserId);
        setActiveAccount(account || null);
      })
      .catch(() => setActiveAccount(null))
      .finally(() => setIsLoading(false));
  }, []);

  // Gemmer at brugeren er logget ud og viser login igen.
  const handleLogout = async () => {
    try {
      const database = await readDatabase();
      database.activeUserId = null;
      await writeDatabase(database);
      setActiveAccount(null);
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
            <Tab.Screen name="Messages" options={{ tabBarLabel: 'Beskeder', tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>💬</Text> }}>
              {props => <MessagesScreen {...props} account={activeAccount} />}
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
            <Tab.Screen name="Messages" options={{ tabBarLabel: 'Beskeder', tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>💬</Text> }}>
              {props => <MessagesScreen {...props} account={activeAccount} />}
            </Tab.Screen>
            <Tab.Screen name="Apply" options={{ tabBarButton: () => null }}>
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
