import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginStyles as styles } from '../styles';
import { readDatabase, writeDatabase } from '../storage';

// Viser login og oprettelse af en jobsøgerkonto.
export default function LoginScreen({ onLogin }) {
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Logger brugeren ind eller opretter en ny konto.
  const handleSubmit = async () => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      Alert.alert('Udfyld felterne', 'Skriv både brugernavn og kodeord.');
      return;
    }

    setIsSubmitting(true);
    try {
      const database = await readDatabase();
      const account = database.accounts.find(
        item => item.username.toLowerCase() === normalizedUsername.toLowerCase(),
      );

      if (isCreatingAccount) {
        if (account) {
          Alert.alert('Brugernavnet findes', 'Vælg et andet brugernavn.');
          return;
        }
        const newAccount = {
          id: `user-${Date.now()}`,
          username: normalizedUsername,
          password,
          role: 'seeker',
        };
        database.accounts.push(newAccount);
        database.activeUserId = newAccount.id;
        database.profiles[newAccount.id] = { name: '', email: '', phone: '', education: '' };
        await writeDatabase(database);
        onLogin(newAccount);
        return;
      }

      if (!account || account.password !== password) {
        Alert.alert('Login mislykkedes', 'Brugernavn eller kodeord er forkert.');
        return;
      }

      database.activeUserId = account.id;
      await writeDatabase(database);
      onLogin(account);
    } catch {
      Alert.alert('Kunne ikke gemme', 'Prøv igen om et øjeblik.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }} edges={['top']}>
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <Image
          source={require('../assets/jobify-logo.jpg')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Jobify"
        />
        <Text style={styles.title}>{isCreatingAccount ? 'Opret bruger' : 'Log ind'}</Text>
        <Text style={styles.subtitle}>Jobify - Din uddannelsesrettede jobportal</Text>

        <Text style={styles.label}>Brugernavn</Text>
        <TextInput
          style={styles.input}
          placeholder="Skriv dit brugernavn"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Kodeord</Text>
        <TextInput
          style={styles.input}
          placeholder="Skriv dit kodeord"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!isSubmitting}
          onSubmitEditing={handleSubmit}
        />

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Vent...' : isCreatingAccount ? 'Opret bruger' : 'Log ind'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setIsCreatingAccount(value => !value)}
          disabled={isSubmitting}
        >
          <Text style={styles.switchButtonText}>
            {isCreatingAccount ? 'Har du allerede en bruger? Log ind' : 'Opret bruger'}
          </Text>
        </TouchableOpacity>
        {!isCreatingAccount ? (
          <Text style={styles.demoCredentials}>
            Virksomhedslogin: unity / unity123, microsoft / microsoft123, plesner / plesner123, maersk / maersk123, danskebank / bank123, carlsberg / carlsberg123
          </Text>
        ) : null}
      </View>
    </ScrollView>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}