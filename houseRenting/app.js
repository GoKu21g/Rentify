const line1 = document.querySelector('.line1');
const line2 = document.querySelector('.line2');
const line3 = document.querySelector('.line3');
const sidebar = document.querySelector('.nav-list');

const showMenu = () => {
  line1.classList.toggle('active');
  line2.classList.toggle('active');
  line3.classList.toggle('active');
  sidebar.classList.toggle('active');
};

// TweenMax animations (existing)
TweenMax.from('.navbar', 1, {
  delay: 0.3,
  x: -40,
  opacity: 0,
  ease: Expo.easeInOut,
});
TweenMax.from('.header-headline', 2, {
  delay: 0.5,
  y: 80,
  opacity: 0,
  ease: Expo.easeInOut,
});
TweenMax.from('.header-subtitle', 3, {
  delay: 0.5,
  y: 20,
  opacity: 0,
  ease: Expo.easeInOut,
});
TweenMax.from('.cta', 4, {
  delay: 0.5,
  y: 20,
  opacity: 0,
  ease: Expo.easeInOut,
});
TweenMax.from('form', 5, {
  delay: 0.3,
  y: 80,
  opacity: 0,
  ease: Expo.easeInOut,
});
TweenMax.from('.product-info', 6, {
  delay: 0.5,
  x: -100,
  opacity: 0,
  ease: Expo.easeInOut,
});
TweenMax.from('.product-card', 7, {
  delay: 0.5,
  y: 200,
  opacity: 0,
  ease: Expo.easeInOut,
});

// Chat functionality for house-details.html

// Initialize socket.io client
const socket = io('http://localhost:8000', {
  auth: {
    token: localStorage.getItem('accessToken'),
  },
  autoConnect: false,
});

const contactOwnerBtn = document.getElementById('contactOwnerBtn');
const chatModal = document.getElementById('chatModal');
const chatCloseBtn = document.getElementById('chatCloseBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

let currentUser = null;
let listingId = null; // We will get this from the page or set manually
let ownerId = null; // We need to get the owner ID from the backend or page data
let conversationId = null;
let isTyping = false;
let typingTimeout = null;

// Utility to append message to chat
function appendMessage(message, sentByCurrentUser) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('chat-message');
  messageDiv.classList.add(sentByCurrentUser ? 'sent' : 'received');
  messageDiv.textContent = message;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Fetch current user info from localStorage
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    return JSON.parse(userStr);
  }
  return null;
}

// Fetch listing and owner info from the page or API
function getListingInfo() {
  // For demo, hardcode listingId and ownerId or extract from page
  // TODO: Replace with actual dynamic data extraction
  return {
    listingId: 'listingId-placeholder', // Replace with actual listing ID
    ownerId: 'ownerId-placeholder', // Replace with actual owner user ID
  };
}

// Start or get conversation about the listing
async function startConversation() {
  if (!listingId || !ownerId) {
    alert('Listing or owner information is missing.');
    return;
  }
  try {
    const accessToken = localStorage.getItem('accessToken');
    const response = await fetch(\`https://rentify-be-ngjp.onrender.com/api/v1/chat/listing/\${listingId}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \${accessToken}\`,
      },
      body: JSON.stringify({ initialMessage: '' }),
    });
    const data = await response.json();
    if (data.success) {
      conversationId = data.data.conversation;
      // Load messages for this conversation
      await loadMessages();
      // Join socket room for this conversation
      socket.emit('joinConversation', conversationId);
    } else {
      alert('Failed to start conversation: ' + data.message);
    }
  } catch (error) {
    console.error('Error starting conversation:', error);
  }
}

// Load messages for the conversation
async function loadMessages() {
  if (!conversationId) return;
  try {
    const accessToken = localStorage.getItem('accessToken');
    const response = await fetch(\`https://rentify-be-ngjp.onrender.com/api/v1/chat/messages/\${ownerId}\`, {
      headers: {
        Authorization: \`Bearer \${accessToken}\`,
      },
    });
    const data = await response.json();
    if (data.success) {
      chatMessages.innerHTML = '';
      data.data.forEach((msg) => {
        const sentByCurrentUser = msg.senderId._id === currentUser._id;
        appendMessage(msg.text, sentByCurrentUser);
      });
    } else {
      alert('Failed to load messages: ' + data.message);
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

// Send message
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  try {
    const accessToken = localStorage.getItem('accessToken');
    const response = await fetch(\`https://rentify-be-ngjp.onrender.com/api/v1/chat/send/\${ownerId}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \${accessToken}\`,
      },
      body: JSON.stringify({ text, listingId }),
    });
    const data = await response.json();
    if (data.success) {
      appendMessage(data.data.text, true);
      chatInput.value = '';
      // Emit new message event via socket
      socket.emit('newMessage', {
        message: data.data,
        conversation: conversationId,
      });
    } else {
      alert('Failed to send message: ' + data.message);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Event listeners
contactOwnerBtn.addEventListener('click', async () => {
  currentUser = getCurrentUser();
  if (!currentUser) {
    alert('Please log in to contact the owner.');
    return;
  }
  const listingInfo = getListingInfo();
  listingId = listingInfo.listingId;
  ownerId = listingInfo.ownerId;
  chatModal.style.display = 'flex';
  socket.connect();
  await startConversation();
});

chatCloseBtn.addEventListener('click', () => {
  chatModal.style.display = 'none';
  if (conversationId) {
    socket.emit('leaveConversation', conversationId);
  }
  socket.disconnect();
});

chatSendBtn.addEventListener('click', () => {
  sendMessage();
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

// Socket.io event handlers
socket.on('connect', () => {
  console.log('Connected to socket.io server');
});

socket.on('newMessage', (data) => {
  if (data.conversation === conversationId) {
    const msg = data.message;
    const sentByCurrentUser = msg.senderId._id === currentUser._id;
    appendMessage(msg.text, sentByCurrentUser);
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from socket.io server');
});
