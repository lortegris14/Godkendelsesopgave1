import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { applicationStyles as styles } from '../styles';
import { readDatabase, writeDatabase } from '../storage';

// Viser ansøgningsformularen og holder styr på tekst og vedhæftninger.
export default function ApplicationScreen({ userId, route, navigation }) {
  const [applicationText, setApplicationText] = useState('');
  const [documents, setDocuments] = useState([]);
  const [isSending, setIsSending] = useState(false);

  // Lader brugeren vælge PDF-filer til ansøgningen.
  const chooseDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        const validDocuments = result.assets.filter(asset =>
          asset.mimeType === 'application/pdf' || asset.name.toLowerCase().endsWith('.pdf'),
        );
        setDocuments(current => [...current, ...validDocuments]);
      }
    } catch {
      Alert.alert('Kunne ikke åbne filer', 'Prøv at vælge PDF-filer igen.');
    }
  };

  // Gemmer ansøgningen og åbner chatten med virksomheden.
  const sendApplication = async () => {
    if (!applicationText.trim()) {
      Alert.alert('Skriv en ansøgning', 'Tilføj en kort tekst, før du sender ansøgningen.');
      return;
    }

    setIsSending(true);
    try {
      const database = await readDatabase();
      const profile = database.profiles[userId] || {};
      const job = database.jobs.find(item => item.id === route.params?.jobId);
      if (!job || !profile.name || !profile.education) {
        Alert.alert('Færdiggør din profil', 'Tilføj navn og uddannelse på profilsiden, før du søger.');
        return;
      }

      const attachmentDirectory = `${FileSystem.documentDirectory}applications/`;
      await FileSystem.makeDirectoryAsync(attachmentDirectory, { intermediates: true });
      const files = [];
      for (const [index, document] of documents.entries()) {
        const safeName = document.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const destination = `${attachmentDirectory}${Date.now()}-${index}-${safeName}`;
        await FileSystem.copyAsync({ from: document.uri, to: destination });
        files.push({ name: document.name, uri: destination, mimeType: 'application/pdf' });
      }

      job.applications = job.applications || {};
      job.applications[userId] = {
        userId,
        name: profile.name,
        education: profile.education,
        appliedAt: new Date().toISOString(),
      };
      const chatId = `${job.id}:${userId}`;
      const chat = database.chats[chatId] || {
        id: chatId,
        jobId: job.id,
        companyId: job.companyId,
        seekerId: userId,
        messages: [],
      };
      chat.messages.push({
        id: `application-${Date.now()}`,
        senderId: userId,
        text: applicationText.trim(),
        files,
        kind: 'application',
        sentAt: new Date().toISOString(),
      });
      database.chats[chatId] = chat;
      await writeDatabase(database);
      navigation.navigate('Messages', { chatId });
    } catch {
      Alert.alert('Kunne ikke sende', 'Ansøgningen blev ikke sendt. Prøv igen.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={[styles.container, { backgroundColor: '#f5f5f5' }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backButton}>‹  Tilbage</Text></TouchableOpacity>
        <Text style={styles.title}>Send ansøgning</Text>
      </View>
      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={styles.label}>Ansøgning</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Fortæl virksomheden, hvorfor du søger jobbet..."
          value={applicationText}
          onChangeText={setApplicationText}
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.label}>Vedhæft PDF-filer</Text>
        <TouchableOpacity style={styles.attachButton} onPress={chooseDocuments}>
          <Text style={styles.attachButtonText}>Vælg CV eller andre PDF-filer</Text>
        </TouchableOpacity>
        {documents.map((document, index) => (
          <View key={`${document.name}-${index}`} style={styles.fileRow}>
            <Text style={styles.fileName}>{document.name}</Text>
            <TouchableOpacity onPress={() => setDocuments(current => current.filter((_, itemIndex) => itemIndex !== index))}>
              <Text style={styles.removeFile}>Fjern</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.sendButton} onPress={sendApplication} disabled={isSending}>
        <Text style={styles.sendButtonText}>{isSending ? 'Sender...' : 'Send ansøgning'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
