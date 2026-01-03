// script.js

// --- Configuration ---
// Using Google's free STUN server ensures devices can find each other through routers
const peerConfig = {
    debug: 1, // Set to 2 for more detailed logs if connection fails
    config: {
        'iceServers': [
            { url: 'stun:stun.l.google.com:19302' }
        ]
    }
};

// --- Globals ---
let peer;
let conn;
// Check URL params for an existing 'id' (means we scanned a QR code)
const urlParams = new URLSearchParams(window.location.search);
const remoteIdFromQr = urlParams.get('id');

// Determine role based on whether an ID exists in the URL
// If ID exists, I am the PHONE (Sender). If not, I am the LAPTOP (Receiver).
const isPhoneSender = !!remoteIdFromQr;

// --- DOM Elements ---
const statusBadge = document.getElementById('status-badge');
const desktopView = document.getElementById('desktop-view');
const mobileView = document.getElementById('mobile-view');
const qrContainer = document.getElementById('qr-container');
const galleryView = document.getElementById('gallery-view');
const gallery = document.getElementById('gallery');
const photoInput = document.getElementById('photo-input');
const selectBtn = document.getElementById('select-btn');
const qrLoading = document.getElementById('qr-loading');


// ====== INITIALIZATION FLOW ======

function init() {
    // 1. Set initial UI based on role
    if (isPhoneSender) {
        // Setup Mobile UI
        desktopView.classList.add('hidden');
        mobileView.classList.remove('hidden');
        updateStatus('connecting', 'Connecting to Laptop...');
    } else {
        // Setup Desktop UI
        mobileView.classList.add('hidden');
        desktopView.classList.remove('hidden');
        updateStatus('connecting', 'Generating QR Code...');
    }

    // 2. Initialize PeerJS connection to the cloud
    peer = new Peer(null, peerConfig);

    // --- PeerJS Event Listeners ---

    // 'open' means connection to PeerJS cloud is established. We have an ID.
    peer.on('open', (id) => {
        console.log('My Peer ID:', id);

        if (isPhoneSender) {
            // I am PHONE: Connect to the ID found in URL
            connectToPeer(remoteIdFromQr);
        } else {
            // I am LAPTOP: Generate QR code for my new ID
            generateQRCode(id);
            updateStatus('ready', 'Ready to Pair');
            qrLoading.classList.add('hidden');
        }
    });

    // 'connection' means another peer is connecting to ME
    peer.on('connection', (c) => {
        // Only laptop should receive connections
        if (!isPhoneSender) {
            conn = c;
            handleConnectionOpened();
        }
    });

    peer.on('error', (err) => {
        console.error(err);
        updateStatus('connecting', 'Connection Error. Refresh.');
        alert("Error: " + err.type);
    });
}


// ====== CONNECTION HANDLERS ======

// Called by Phone to initiate connection
function connectToPeer(remoteId) {
    conn = peer.connect(remoteId, { reliable: true });
    
    conn.on('open', () => {
        handleConnectionOpened();
    });

    conn.on('error', (err) => console.error("Data connection error:", err));
}

// Called on both devices once paired
function handleConnectionOpened() {
    console.log("Connected to peer!");
    updateStatus('connected', 'Connected');

    if (isPhoneSender) {
        // Phone: Enable the send button
        photoInput.disabled = false;
        selectBtn.classList.remove('disabled');
        statusBadge.innerText = "Connected to Laptop";
    } else {
        // Laptop: Switch UI from QR to Gallery
        qrContainer.classList.add('hidden');
        galleryView.classList.remove('hidden');
        
        // Listen for incoming data
        conn.on('data', handleIncomingData);
    }
}


// ====== DATA TRANSFER & UI LOGIC ======

// LAPTOP: Generate QR Code
function generateQRCode(id) {
    // Create the URL the phone needs to open
    // Take current URL (excluding existing params) and append ?id=...
    const connectionUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?id=${id}`;
    console.log("QR Link:", connectionUrl);

    // Clear previous if exists
    document.getElementById('qrcode-canvas').innerHTML = '';

    // Generate QR
    new QRCode(document.getElementById("qrcode-canvas"), {
        text: connectionUrl,
        width: 200,
        height: 200,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}

// LAPTOP: Handle receiving a photo blob
function handleIncomingData(data) {
    // 1. Convert raw data to Blob
    const blob = new Blob([new Uint8Array(data)]);
    // 2. Create a local URL for that Blob
    const imgUrl = URL.createObjectURL(blob);
    
    // 3. Create and insert image element
    const img = document.createElement('img');
    img.src = imgUrl;
    img.classList.add('glass-img');
    
    // Add to start of gallery grid
    gallery.prepend(img);
    
    // Hide placeholder text
    document.getElementById('gallery-placeholder').style.display = 'none';
}

// PHONE: Handle file selection and sending
photoInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    
    if (files.length > 0 && conn && conn.open) {
        // Update Button UI
        const originalBtnHtml = selectBtn.innerHTML;
        selectBtn.innerHTML = `<span>Sending ${files.length}...</span>`;
        selectBtn.classList.add('disabled');

        // Loop through files and send
        for (const file of files) {
            try {
                // Convert file to ArrayBuffer (raw data)
                const arrayBuffer = await file.arrayBuffer();
                // Send over WebRTC data channel
                conn.send(arrayBuffer);
                console.log(`Sent: ${file.name}`);
            } catch (err) {
                console.error("Error sending file:", err);
                alert(`Failed to send ${file.name}`);
            }
        }
        
        // Restore Button UI
        selectBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Sent!</span>
        `;
        setTimeout(() => {
            selectBtn.innerHTML = originalBtnHtml;
            selectBtn.classList.remove('disabled');
        }, 2000);
        
        // Clear input to allow selecting same files again
        photoInput.value = '';
    }
});

// Helper to update the top badge
function updateStatus(className, text) {
    statusBadge.className = `status-badge ${className}`;
    statusBadge.innerText = text;
}

// Start the app
init();
