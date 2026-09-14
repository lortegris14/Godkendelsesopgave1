import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { messagesStyles as styles } from '../styles';

const MESSAGES = [
  {
    id: 1,
    company: 'Microsoft Denmark',
    date: '14. september 2026',
    message: 'Hej! Vi er begejstret for din ansøgning til IT Support Specialist stillingen. Vi gerne have dig til en jobsamtale næste onsdag klokken 14:00. Kan du præcisere denne dag? Vi glæder os til at mødes.',
  },
];

export default function MessagesScreen() {
  const [userMessage, setUserMessage] = useState('');
  const [userMessages, setUserMessages] = useState([]);

  const handleSend = () => {
    if (userMessage.trim()) {
      setUserMessages([...userMessages, userMessage]);
      setUserMessage('');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Beskeder</Text>
        </View>

        <View style={styles.messagesList}>
          {MESSAGES.map((msg) => (
            <View key={msg.id} style={styles.messageCard}>
              <View style={styles.messageHeader}>
                <Text style={styles.company}>{msg.company}</Text>
                <Text style={styles.date}>{msg.date}</Text>
              </View>
              <Text style={styles.messageText}>{msg.message}</Text>
            </View>
          ))}

          {userMessages.map((msg, index) => (
            <View key={`user-${index}`} style={styles.userMessageCard}>
              <Text style={styles.userMessageText}>{msg}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.messageInputContainer}>
        <TextInput
          style={styles.messageInput}
          placeholder="Skriv din besked..."
          value={userMessage}
          onChangeText={setUserMessage}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
