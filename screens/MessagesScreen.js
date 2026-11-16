import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { messagesStyles as styles } from '../styles';
import { EDUCATIONS, readDatabase, writeDatabase } from '../storage';

function StudentAvatar({ profile }) {
  const initial = profile?.name?.trim()?.[0]?.toUpperCase() || '?';
  return profile?.photo?.uri ? (
    <Image
      source={{ uri: profile.photo.uri }}
      style={styles.studentAvatar}
      accessibilityLabel={`${profile.name || 'Jobsøger'}s profilbillede`}
    />
  ) : (
    <View style={[styles.studentAvatar, styles.studentAvatarPlaceholder]}>
      <Text style={styles.studentAvatarInitial}>{initial}</Text>
    </View>
  );
}

// Viser brugerens chats og lader begge parter sende beskeder.
export default function MessagesScreen({ account, route, navigation }) {
  const [database, setDatabase] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedEducation, setSelectedEducation] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [draft, setDraft] = useState('');
  const [viewingFile, setViewingFile] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(false);
  const insets = useSafeAreaInsets();

  // Genindlæser beskeder, når fanen åbnes, så nye ansøgninger vises med det samme.
  useFocusEffect(useCallback(() => {
    let isActive = true;
    readDatabase()
      .then(updated => {
        if (isActive) setDatabase(updated);
      })
      .catch(() => {
        if (isActive) Alert.alert('Kunne ikke hente beskeder', 'Prøv at åbne beskedfanen igen.');
      });
    return () => { isActive = false; };
  }, [account.id]));

  useEffect(() => {
    if (route?.params?.chatId) {
      setSelectedChatId(route.params.chatId);
      navigation?.setParams({ chatId: undefined });
    }
  }, [route?.params?.chatId]);

  if (!database) return <View style={styles.container} />;

  const isCompany = account.role === 'company';
  const chats = Object.values(database.chats || {}).filter(chat => (
    isCompany ? chat.companyId === account.id : chat.seekerId === account.id
  ));
  const getJob = chat => database.jobs.find(job => job.id === chat.jobId);
  const getSeeker = chat => database.profiles[chat.seekerId] || {};
  const getCompanyName = chat => database.accounts.find(item => item.id === chat.companyId)?.companyName || getJob(chat)?.company || 'Virksomhed';
  const companyJobs = isCompany ? database.jobs.filter(job => job.companyId === account.id) : [];
  const selectedJob = companyJobs.find(job => job.id === selectedJobId);

  // Gemmer en besked i den åbne chat.
  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !selectedChatId) return;
    try {
      const updated = await readDatabase();
      const chat = updated.chats[selectedChatId];
      if (!chat) return;
      chat.messages = chat.messages || [];
      chat.messages.push({ id: `message-${Date.now()}`, senderId: account.id, text, sentAt: new Date().toISOString() });
      await writeDatabase(updated);
      setDatabase(updated);
      setDraft('');
    } catch {
      Alert.alert('Kunne ikke sende', 'Beskeden blev ikke sendt. Prøv igen.');
    }
  };

  // Åbner en vedhæftet PDF på telefonen.
  const openAttachment = async file => {
    try {
      if (process.env.EXPO_OS === 'android') {
        const FileSystem = await import('expo-file-system/legacy');
        const IntentLauncher = await import('expo-intent-launcher');
        const contentUri = await FileSystem.getContentUriAsync(file.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          type: 'application/pdf',
          flags: 1,
        });
        return;
      }
      setViewingFile(file);
    } catch {
      Alert.alert('Kunne ikke åbne PDF', 'Dokumentet kunne ikke åbnes. Prøv igen.');
    }
  };

  // Åbner chatten, der er valgt på listen.
  const openConversation = chat => {
    setSelectedChatId(chat.id);
  };

  const selectedChat = chats.find(chat => chat.id === selectedChatId);
  const selectedSeeker = selectedChat ? getSeeker(selectedChat) : null;
  const selectedChatJob = selectedChat ? getJob(selectedChat) : null;
  const selectedJobChats = selectedJobId
    ? chats.filter(chat => chat.jobId === selectedJobId)
    : [];
  const companyEducationChats = selectedEducation
    ? selectedJobChats.filter(chat => getSeeker(chat).education === selectedEducation)
    : [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={[styles.container, { backgroundColor: '#f5f5f5' }]} edges={['top']}>
      <Modal
        visible={Boolean(viewingFile || viewingProfile)}
        animationType="slide"
        onRequestClose={() => {
          setViewingFile(null);
          setViewingProfile(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ minHeight: 56 + insets.top, paddingHorizontal: 16, paddingTop: insets.top + 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' }}>
            <TouchableOpacity onPress={() => {
              setViewingFile(null);
              setViewingProfile(false);
            }} style={{ paddingVertical: 10, paddingRight: 16 }}>
              <Text style={{ color: '#1f77d2', fontSize: 16, fontWeight: '600' }}>Luk</Text>
            </TouchableOpacity>
            <Text numberOfLines={1} style={{ flex: 1, color: '#222', fontSize: 15, fontWeight: '600' }}>
              {viewingFile?.name || 'Studenterprofil'}
            </Text>
          </View>
          {viewingFile ? (
            <WebView
              source={{ uri: viewingFile.uri }}
              allowingReadAccessToURL={viewingFile.uri}
              originWhitelist={['*']}
              style={{ flex: 1, backgroundColor: '#fff' }}
              onError={() => Alert.alert('Kunne ikke vise PDF', 'Filen kunne ikke indlæses på denne enhed.')}
            />
          ) : viewingProfile && selectedChat && selectedSeeker ? (
            <ScrollView contentContainerStyle={styles.profileDetailsContent}>
              {selectedSeeker.photo?.uri ? (
                <Image source={{ uri: selectedSeeker.photo.uri }} style={styles.profileDetailsPhoto} />
              ) : (
                <View style={[styles.profileDetailsPhoto, styles.profileDetailsPhotoPlaceholder]}>
                  <Text style={styles.profileDetailsInitial}>{selectedSeeker.name?.trim()?.[0]?.toUpperCase() || '?'}</Text>
                </View>
              )}
              <Text style={styles.profileDetailsName}>{selectedSeeker.name || selectedChat.seekerId}</Text>
              <View style={styles.profileDetailsFields}>
                {[
                  ['Mail', selectedSeeker.email],
                  ['Telefon', selectedSeeker.phone],
                  ['Uddannelse', selectedSeeker.education],
                  ['Semester', selectedSeeker.semester === 'completed'
                    ? 'Uddannelsen er færdiggjort'
                    : selectedSeeker.semester
                      ? `${selectedSeeker.semester}. semester`
                      : null],
                ].map(([label, value]) => (
                  <View key={label} style={styles.profileDetailsRow}>
                    <Text style={styles.profileDetailsLabel}>{label}</Text>
                    <Text style={styles.profileDetailsValue}>{value || 'Ikke angivet'}</Text>
                  </View>
                ))}
                <View style={styles.profileDetailsRow}>
                  <Text style={styles.profileDetailsLabel}>CV</Text>
                  {selectedSeeker.cv?.uri ? (
                    <TouchableOpacity
                      style={styles.profileDetailsCvButton}
                      onPress={() => {
                        setViewingProfile(false);
                        openAttachment(selectedSeeker.cv);
                      }}
                    >
                      <Text style={styles.profileDetailsCvButtonText}>Vis {selectedSeeker.cv.name}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.profileDetailsValue}>Intet CV tilknyttet</Text>
                  )}
                </View>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>
      <View style={styles.header}>
        <Text style={styles.title}>Beskeder</Text>
        {(selectedChatId || selectedEducation || selectedJobId) ? (
          <TouchableOpacity onPress={() => {
            if (selectedChatId) setSelectedChatId(null);
            else if (selectedEducation) setSelectedEducation(null);
            else setSelectedJobId(null);
          }}>
            <Text style={styles.backButton}>Tilbage</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {selectedChat ? (
        <>
          <View style={styles.conversationTitle}>
            {isCompany ? <StudentAvatar profile={getSeeker(selectedChat)} /> : null}
            <View style={styles.conversationHeading}>
              {isCompany ? (
                <TouchableOpacity onPress={() => setViewingProfile(true)} accessibilityRole="button">
                  <Text style={styles.conversationName}>{selectedSeeker.name || selectedChat.seekerId}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.conversationName}>{getCompanyName(selectedChat)}</Text>
              )}
              <Text style={styles.conversationJob}>{getJob(selectedChat)?.position || ''}</Text>
            </View>
          </View>
          <ScrollView style={styles.conversation} contentContainerStyle={styles.conversationContent} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            {(selectedChat.messages || []).map(message => {
              const isOwnMessage = message.senderId === account.id;
              return (
                <View key={message.id} style={[styles.messageBubble, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
                  <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>{message.text}</Text>
                  {message.kind === 'job-recommendation' && message.jobId && !isCompany && !selectedChatJob?.applications?.[account.id] ? (
                    <TouchableOpacity
                      style={styles.recommendationButton}
                      onPress={() => navigation.navigate('Apply', { jobId: message.jobId })}
                    >
                      <Text style={styles.recommendationButtonText}>Søg job</Text>
                    </TouchableOpacity>
                  ) : null}
                  {message.files?.map(file => (
                    <TouchableOpacity key={file.uri} style={styles.attachmentButton} onPress={() => openAttachment(file)}>
                      <Text style={styles.attachmentName}>PDF · {file.name}</Text>
                      <Text style={styles.attachmentAction}>Åbn dokument</Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
                    {new Date(message.sentAt).toLocaleDateString('da-DK')}
                  </Text>
                </View>
              );
            })}
            {!selectedChat.messages?.length ? <Text style={styles.emptyMessage}>Start samtalen med en besked.</Text> : null}
          </ScrollView>
          <View style={styles.messageInputContainer}>
            <TextInput style={styles.messageInput} placeholder="Skriv en besked..." value={draft} onChangeText={setDraft} multiline />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}><Text style={styles.sendButtonText}>Send</Text></TouchableOpacity>
          </View>
        </>
      ) : isCompany && selectedJobId && selectedEducation ? (
        <ScrollView style={styles.list}>
          <Text style={styles.sectionTitle}>{selectedJob?.position} · {selectedEducation}</Text>
          {companyEducationChats.map(chat => {
            const seeker = getSeeker(chat);
            return (
              <TouchableOpacity key={chat.id} style={styles.chatRow} onPress={() => openConversation(chat)}>
                <StudentAvatar profile={seeker} />
                <View style={styles.chatRowText}>
                  <Text style={styles.chatName}>{seeker.name || chat.seekerId}</Text>
                  <Text style={styles.chatPreview}>{getJob(chat)?.position}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}
          {!companyEducationChats.length ? <Text style={styles.emptyMessage}>Ingen samtaler for denne uddannelse endnu.</Text> : null}
        </ScrollView>
      ) : isCompany && selectedJobId ? (
        <ScrollView style={styles.list}>
          <Text style={styles.sectionTitle}>{selectedJob?.position} · samtaler pr. uddannelse</Text>
          {EDUCATIONS.map(education => {
            const count = selectedJobChats.filter(chat => getSeeker(chat).education === education).length;
            return (
              <TouchableOpacity key={education} style={styles.chatRow} onPress={() => setSelectedEducation(education)}>
                <View style={styles.chatRowText}>
                  <Text style={styles.chatName}>{education}</Text>
                  <Text style={styles.chatPreview}>{count} {count === 1 ? 'samtale' : 'samtaler'}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : isCompany ? (
        <ScrollView style={styles.list}>
          <Text style={styles.sectionTitle}>Vælg jobopslag</Text>
          {companyJobs.map(job => {
            const count = chats.filter(chat => chat.jobId === job.id).length;
            return (
              <TouchableOpacity key={job.id} style={styles.chatRow} onPress={() => setSelectedJobId(job.id)}>
                <View style={styles.chatRowText}>
                  <Text style={styles.chatName}>{job.position}</Text>
                  <Text style={styles.chatPreview}>{count} {count === 1 ? 'samtale' : 'samtaler'}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}
          {!companyJobs.length ? <Text style={styles.emptyMessage}>Du har ingen jobopslag endnu.</Text> : null}
        </ScrollView>
      ) : (
        <ScrollView style={styles.list}>
          {chats.map(chat => {
            const job = getJob(chat);
            const lastMessage = chat.messages?.[chat.messages.length - 1];
            return (
              <TouchableOpacity key={chat.id} style={styles.chatRow} onPress={() => openConversation(chat)}>
                <View style={styles.chatRowText}>
                  <Text style={styles.chatName}>{getCompanyName(chat)}</Text>
                  <Text style={styles.chatPreview}>{job?.position}{lastMessage ? ` · ${lastMessage.text}` : ''}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}
          {!chats.length ? <Text style={styles.emptyMessage}>Dine samtaler og jobanbefalinger vises her.</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}