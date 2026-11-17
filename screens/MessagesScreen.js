import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { jobsStyles as filterStyles, messagesStyles as styles } from '../styles';
import {
  clearUnreadMessageCount,
  EDUCATIONS,
  getUnreadMessageCount,
  incrementUnreadMessageCount,
  readDatabase,
  writeDatabase,
} from '../storage';
import { notifyNewMessage } from '../notifications';

const APPLICANT_STATUSES = [
  { value: 'studying', label: 'Under uddannelse' },
  { value: 'completed', label: 'Uddannelsen er færdiggjort' },
];
const SEMESTERS = Array.from({ length: 6 }, (_, index) => ({
  value: String(index + 1),
  label: `${index + 1}. semester`,
}));

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

function getLastMessageTime(chat) {
  const lastMessage = chat.messages?.[chat.messages.length - 1];
  const timestamp = Date.parse(lastMessage?.sentAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

// Viser brugerens chats og lader begge parter sende beskeder.
export default function MessagesScreen({ account, route, navigation, onUnreadMessageCountChange }) {
  const [database, setDatabase] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [semesterMenuOpen, setSemesterMenuOpen] = useState(false);
  const [applicantFilters, setApplicantFilters] = useState({
    educations: [],
    statuses: [],
    semesters: [],
  });
  const [draft, setDraft] = useState('');
  const [viewingFile, setViewingFile] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (database) {
      onUnreadMessageCountChange?.(getUnreadMessageCount(database, account.id));
    }
  }, [database, account.id, onUnreadMessageCountChange]);

  const markConversationAsRead = async chatId => {
    if (!database?.chats?.[chatId]?.unreadCounts?.[account.id]) return;
    try {
      const updated = await readDatabase();
      const chat = updated.chats[chatId];
      if (!chat?.unreadCounts?.[account.id]) return;
      clearUnreadMessageCount(chat, account.id);
      await writeDatabase(updated);
      setDatabase(updated);
    } catch {
      Alert.alert('Kunne ikke opdatere beskeder', 'Ulæste beskeder blev ikke markeret som læst. Prøv igen.');
    }
  };

  useEffect(() => {
    if (selectedChatId && database) {
      markConversationAsRead(selectedChatId);
    }
  }, [selectedChatId, database, account.id]);

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
  const chats = Object.values(database.chats || {}).filter(chat => {
    if (!isCompany) return chat.seekerId === account.id;
    if (chat.companyId !== account.id) return false;
    const job = database.jobs.find(item => item.id === chat.jobId);
    return Boolean(job?.applications?.[chat.seekerId]);
  }).sort((first, second) => getLastMessageTime(second) - getLastMessageTime(first));
  const getJob = chat => database.jobs.find(job => job.id === chat.jobId);
  const getSeeker = chat => database.profiles[chat.seekerId] || {};
  const getCompanyName = chat => database.accounts.find(item => item.id === chat.companyId)?.companyName || getJob(chat)?.company || 'Virksomhed';
  const latestActivityByJob = new Map();
  chats.forEach(chat => {
    latestActivityByJob.set(
      chat.jobId,
      Math.max(latestActivityByJob.get(chat.jobId) || 0, getLastMessageTime(chat)),
    );
  });
  const companyJobs = isCompany
    ? database.jobs
      .filter(job => job.companyId === account.id)
      .sort((first, second) => (latestActivityByJob.get(second.id) || 0) - (latestActivityByJob.get(first.id) || 0))
    : [];
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
      const message = { id: `message-${Date.now()}`, senderId: account.id, text, sentAt: new Date().toISOString() };
      chat.messages.push(message);
      const recipientId = isCompany ? chat.seekerId : chat.companyId;
      incrementUnreadMessageCount(chat, recipientId);
      await writeDatabase(updated);
      setDatabase(updated);
      setDraft('');
      try {
        const recipient = updated.accounts.find(item => item.id === recipientId);
        const sender = isCompany ? account : updated.profiles[account.id];
        const result = await notifyNewMessage(recipient, sender, chat, message);
        if (result.permissionDenied) {
          Alert.alert('Besked sendt', 'Tillad notifikationer i telefonens indstillinger for at modtage nye beskeder.');
        }
      } catch {
        Alert.alert('Besked sendt', 'Notifikationen kunne ikke sendes, men beskeden er gemt.');
      }
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
  const canFilterSemesters = applicantFilters.statuses.includes('studying')
    && !applicantFilters.statuses.includes('completed');
  const companyVisibleChats = selectedJobChats.filter(chat => {
    const seeker = getSeeker(chat);
    const semester = String(seeker.semester || '');
    const isCurrentlyStudying = SEMESTERS.some(item => item.value === semester);
    const isCompleted = seeker.semester === 'completed';
    const statuses = applicantFilters.statuses;
    return (!applicantFilters.educations.length || applicantFilters.educations.includes(seeker.education))
      && (!statuses.length
        || (statuses.includes('studying') && isCurrentlyStudying)
        || (statuses.includes('completed') && isCompleted))
      && (!canFilterSemesters || !applicantFilters.semesters.length || applicantFilters.semesters.includes(semester));
  });
  const toggleApplicantFilter = (group, value) => {
    setApplicantFilters(current => {
      const selected = current[group];
      const updated = selected.includes(value)
        ? selected.filter(item => item !== value)
        : [...selected, value];
      const statuses = group === 'statuses' ? updated : current.statuses;
      return {
        ...current,
        [group]: updated,
        semesters: statuses.includes('completed') ? [] : current.semesters,
      };
    });
    if (group === 'statuses') setSemesterMenuOpen(false);
  };
  const clearApplicantFilters = () => {
    setApplicantFilters({ educations: [], statuses: [], semesters: [] });
    setSemesterMenuOpen(false);
  };
  const toggleSemester = value => {
    setApplicantFilters(current => ({
      ...current,
      semesters: current.semesters.includes(value)
        ? current.semesters.filter(semester => semester !== value)
        : [...current.semesters, value],
    }));
  };
  const renderApplicantFilterOptions = (title, group, options, getValue = option => option, getLabel = option => option) => (
    <View style={filterStyles.filterSection}>
      {title ? <Text style={filterStyles.filterSectionTitle}>{title}</Text> : null}
      {options.map(option => {
        const value = getValue(option);
        const checked = applicantFilters[group].includes(value);
        return (
          <TouchableOpacity
            key={value}
            style={filterStyles.filterOption}
            onPress={() => toggleApplicantFilter(group, value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            <View style={[filterStyles.filterCheckbox, checked && filterStyles.filterCheckboxChecked]}>
              {checked ? <Text style={filterStyles.filterCheckboxCheck}>✓</Text> : null}
            </View>
            <Text style={filterStyles.filterOptionText}>{getLabel(option)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
  const renderSemesterOptions = () => (
    <View style={filterStyles.filterSection}>
      {SEMESTERS.map(({ value, label }) => {
        const checked = applicantFilters.semesters.includes(value);
        return (
          <TouchableOpacity
            key={value}
            style={filterStyles.filterOption}
            onPress={() => toggleSemester(value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            <View style={[filterStyles.filterCheckbox, checked && filterStyles.filterCheckboxChecked]}>
              {checked ? <Text style={filterStyles.filterCheckboxCheck}>✓</Text> : null}
            </View>
            <Text style={filterStyles.filterOptionText}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

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
      <Modal
        visible={filterModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <View style={filterStyles.filterModalOverlay}>
          <View style={filterStyles.filterModal}>
            <Text style={filterStyles.filterModalTitle}>Filtrer samtaler</Text>
            <ScrollView style={filterStyles.filterModalScroll} keyboardShouldPersistTaps="handled">
              {renderApplicantFilterOptions('Uddannelse', 'educations', EDUCATIONS)}
              {renderApplicantFilterOptions(
                'Studie-status',
                'statuses',
                APPLICANT_STATUSES,
                status => status.value,
                status => status.label,
              )}
              <View style={styles.semesterFilterSection}>
                <TouchableOpacity
                  style={[styles.semesterAccordion, !canFilterSemesters && styles.semesterAccordionDisabled]}
                  onPress={() => setSemesterMenuOpen(open => !open)}
                  disabled={!canFilterSemesters}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: semesterMenuOpen, disabled: !canFilterSemesters }}
                >
                  <Text style={[styles.semesterAccordionText, !canFilterSemesters && styles.semesterAccordionDisabledText]}>
                    Vælg semestre
                  </Text>
                  <Text style={[styles.semesterAccordionText, !canFilterSemesters && styles.semesterAccordionDisabledText]}>
                    {semesterMenuOpen ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
                {semesterMenuOpen && canFilterSemesters
                  ? renderSemesterOptions()
                  : null}
              </View>
            </ScrollView>
            <View style={filterStyles.filterModalActions}>
              <TouchableOpacity style={filterStyles.clearFiltersButton} onPress={clearApplicantFilters}>
                <Text style={filterStyles.clearFiltersButtonText}>Fravælg alle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={filterStyles.applyFiltersButton} onPress={() => setFilterModalOpen(false)}>
                <Text style={filterStyles.applyFiltersButtonText}>Vis samtaler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles.header}>
        <Text style={styles.title}>Beskeder</Text>
        {(selectedChatId || selectedJobId) ? (
          <TouchableOpacity onPress={() => {
            if (selectedChatId) setSelectedChatId(null);
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
              <Text style={styles.conversationJob}>
                {isCompany ? selectedSeeker.education || 'Uddannelse ikke angivet' : selectedChatJob?.position || ''}
              </Text>
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
      ) : isCompany && selectedJobId ? (
        <ScrollView>
          <Text style={styles.sectionTitle}>{selectedJob?.position} · samtaler</Text>
          <View style={filterStyles.filterButtonRow}>
            <TouchableOpacity
              style={filterStyles.filterButton}
              onPress={() => setFilterModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Filtrer samtaler"
            >
              <Text style={filterStyles.filterButtonText}>Filtrer</Text>
              {Object.values(applicantFilters).some(group => group.length > 0) ? (
                <Text style={filterStyles.activeFilterCount}>
                  {Object.values(applicantFilters).reduce((total, group) => total + group.length, 0)}
                </Text>
              ) : null}
            </TouchableOpacity>
          </View>
          {companyVisibleChats.map(chat => {
            const seeker = getSeeker(chat);
            return (
              <TouchableOpacity
                key={chat.id}
                style={styles.chatRow}
                onPress={() => openConversation(chat)}
                accessibilityLabel={`${seeker.name || chat.seekerId}${chat.unreadCounts?.[account.id] ? `, ${chat.unreadCounts[account.id]} ulæste beskeder` : ''}`}
              >
                <StudentAvatar profile={seeker} />
                <View style={styles.chatRowText}>
                  <Text style={styles.chatName}>{seeker.name || chat.seekerId}</Text>
                  <Text style={styles.chatPreview}>{seeker.education || 'Uddannelse ikke angivet'}</Text>
                </View>
                {chat.unreadCounts?.[account.id] > 0 ? <Text style={styles.unreadBadge}>{chat.unreadCounts[account.id]}</Text> : null}
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          })}
          {!companyVisibleChats.length ? (
            <Text style={styles.emptyMessage}>
              {selectedJobChats.length
                ? 'Ingen samtaler matcher de valgte filtre.'
                : 'Der er endnu ingen samtaler til dette jobopslag.'}
            </Text>
          ) : null}
        </ScrollView>
      ) : isCompany ? (
        <ScrollView style={styles.list}>
          <Text style={styles.sectionTitle}>Vælg jobopslag</Text>
          {companyJobs.map(job => {
            const count = chats.filter(chat => chat.jobId === job.id).length;
            const unreadCount = chats
              .filter(chat => chat.jobId === job.id)
              .reduce((total, chat) => total + (Number(chat.unreadCounts?.[account.id]) || 0), 0);
            return (
              <TouchableOpacity key={job.id} style={styles.chatRow} onPress={() => setSelectedJobId(job.id)}>
                <View style={styles.chatRowText}>
                  <Text style={styles.chatName}>{job.position}</Text>
                  <Text style={styles.chatPreview}>{count} {count === 1 ? 'samtale' : 'samtaler'}</Text>
                </View>
                {unreadCount > 0 ? <Text style={styles.unreadBadge}>{unreadCount}</Text> : null}
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
              <TouchableOpacity
                key={chat.id}
                style={styles.chatRow}
                onPress={() => openConversation(chat)}
                accessibilityLabel={`${getCompanyName(chat)}${chat.unreadCounts?.[account.id] ? `, ${chat.unreadCounts[account.id]} ulæste beskeder` : ''}`}
              >
                <View style={styles.chatRowText}>
                  <Text style={styles.chatName}>{getCompanyName(chat)}</Text>
                  <Text style={styles.chatPreview}>{job?.position}{lastMessage ? ` · ${lastMessage.text}` : ''}</Text>
                </View>
                {chat.unreadCounts?.[account.id] > 0 ? <Text style={styles.unreadBadge}>{chat.unreadCounts[account.id]}</Text> : null}
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