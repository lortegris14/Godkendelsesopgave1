import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { applicationStyles as styles } from '../styles';
import { incrementUnreadMessageCount, readDatabase, writeDatabase } from '../storage';
import { notifyNewMessage } from '../notifications';

// Viser ansøgningsformularen og holder styr på tekst og vedhæftninger.
export default function ApplicationScreen({ userId, route, navigation }) {
  const [applicationText, setApplicationText] = useState('');
  const [documents, setDocuments] = useState([]);
  const [profileCv, setProfileCv] = useState(null);
  const [includeProfileCv, setIncludeProfileCv] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setIncludeProfileCv(false);
  }, [userId]);

  useFocusEffect(useCallback(() => {
    let isActive = true;
    readDatabase()
      .then(database => {
        if (isActive) setProfileCv(database.profiles[userId]?.cv || null);
      })
      .catch(() => {
        if (isActive) Alert.alert('Kunne ikke hente CV', 'Prøv at åbne ansøgningssiden igen.');
      });
    return () => { isActive = false; };
  }, [userId]));

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
      if (includeProfileCv && !profile.cv) {
        Alert.alert('CV ikke fundet', 'Tilføj dit CV på profilsiden, før du vedhæfter det.');
        return;
      }

      const attachmentDirectory = `${FileSystem.documentDirectory}applications/`;
      await FileSystem.makeDirectoryAsync(attachmentDirectory, { intermediates: true });
      const files = [];
      const attachments = [
        ...(includeProfileCv && profile.cv ? [profile.cv] : []),
        ...documents,
      ];
      for (const [index, document] of attachments.entries()) {
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
        unreadCounts: {},
      };
      const message = {
        id: `application-${Date.now()}`,
        senderId: userId,
        text: applicationText.trim(),
        files,
        kind: 'application',
        sentAt: new Date().toISOString(),
      };
      chat.messages.push(message);
      incrementUnreadMessageCount(chat, job.companyId);
      database.chats[chatId] = chat;
      await writeDatabase(database);
      try {
        const recipient = database.accounts.find(item => item.id === job.companyId);
        const result = await notifyNewMessage(recipient, profile, chat, message);
        if (result.permissionDenied) {
          Alert.alert('Ansøgning sendt', 'Tillad notifikationer i telefonens indstillinger for at modtage nye beskeder.');
        }
      } catch {
        Alert.alert('Ansøgning sendt', 'Notifikationen kunne ikke sendes, men ansøgningen er gemt.');
      }
      navigation.navigate('Messages', { chatId });
    } catch {
      Alert.alert('Kunne ikke sende', 'Ansøgningen blev ikke sendt. Prøv igen.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#f5f5f5' }]} edges={['top']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Text style={styles.title}>Send ansøgning</Text>
        <TouchableOpacity
          style={styles.backButtonTouch}
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <Text style={styles.backButton}>‹  Tilbage</Text>
        </TouchableOpacity>
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
        <Text style={styles.label}>Personligt CV</Text>
        <TouchableOpacity
          style={styles.profileCvOption}
          onPress={() => setIncludeProfileCv(value => !value)}
          disabled={!profileCv || isSending}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: includeProfileCv, disabled: !profileCv }}
        >
          <View style={[styles.checkbox, includeProfileCv && styles.checkedCheckbox, !profileCv && styles.disabledCheckbox]}>
            {includeProfileCv ? <Text style={styles.checkboxCheck}>✓</Text> : null}
          </View>
          <View style={styles.profileCvText}>
            <Text style={[styles.profileCvLabel, !profileCv && styles.disabledText]}>Vedhæft personligt CV</Text>
            <Text style={styles.profileCvName}>{profileCv?.name || 'Upload et CV på profilsiden først.'}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.label}>Andre PDF-dokumenter</Text>
        <TouchableOpacity style={styles.attachButton} onPress={chooseDocuments}>
          <Text style={styles.attachButtonText}>Tilføj ansøgningsdokumenter</Text>
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
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
