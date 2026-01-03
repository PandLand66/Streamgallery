// script.js

// --- Configuration ---
const peerConfig = {
    debug: 1,
    config: { 'iceServers': [{ url: 'stun:stun.l.google.com:19302' }] }
};

// --- Globals ---
let peer;
let conn;
let photos = []; // Stores the blob URLs of received photos
let currentIndex = 0;

// URL Params (Check if we are the phone)
const urlParams = new URLSearchParams(window.location.search);
const remoteIdFromQr = urlParams.get('id');
const isPhoneSender = !!remoteIdFromQr;

// --- DOM Elements ---
const statusBadge = document.getElementById('status-badge');
const statusDot = document.querySelector('.status-dot');
const qrBtn = document.getElementById('qr-btn');
const sendBtn = document.getElementById('send-btn');
const photoInput = document.getElementById('photo-input');
const activeStage = document.getElementById('active-stage');
const mainImage = document.getElementById('main-image');
const placeholderContent = document.getElementById('placeholder-content');
const qrCanvas = document.getElementById('qrcode-canvas');
const stageTitle = document.getElementById('stage-title');
const stageDesc = document.getElementById('stage-desc');
const thumbnailsContainer = document.getElementById('thumbnails-container');

// --- Initialization ---
function init() {
    if (isPhoneSender) {
        // MOBILE SETUP
        qrBtn.style.display = 'none'; // Hide QR button on phone
        sendBtn.classList.remove('hidden'); // Show Send button
        updateStatus('Connecting...', 'orange');
    } else {
        // DESKTOP SETUP
        sendBtn.style.display = 'none';
        updateStatus('Generating ID...', 'orange');
    }

    // Initialize PeerJS
    peer = new Peer(null, peerConfig);

    peer.on('open', (id) => {
        console.log('My ID:', id);
        if (isPhoneSender) {
            connectToPeer(remoteIdFromQr);
        } else {
            updateStatus('Ready to Pair', '#2ecc71'); // Green
            // Generate QR automatically on load for desktop
            generateQRCode(id);
        }
    });

    peer.on('connection', (c) => {
        if (!isPhoneSender) {
            conn = c;
            handleConnectionOpened();
        }
    });
}

// --- Connection Logic ---
function connectToPeer(remoteId) {
    conn = peer.connect(remoteId);
    conn.on('open', handleConnectionOpened);
    conn.on('error', (err) => alert("Connection Error: " + err));
}

function handleConnectionOpened() {
    updateStatus('Connected', '#3498db'); // Blue
    
    if (isPhoneSender) {
        photoInput.disabled = false;
        stageTitle.innerText = "Connected!";
        stageDesc.innerText = "Select photos to stream to the big screen.";
    } else {
        // Desktop: Hide QR code if it was showing
        qrCanvas.style.display = 'none';
        stageTitle.innerText = "Connected";
        stageDesc.innerText = "Waiting for photos...";
        
        // Listen for data
        conn.on('data', handleIncomingData);
    }
}

// --- Data Transfer (Laptop Receiving) ---
function handleIncomingData(data) {
    const blob = new Blob([new Uint8Array(data)]);
    const imgUrl = URL.createObjectURL(blob);
    
    // Add to our collection
    photos.push(imgUrl);
    currentIndex = photos.length - 1; // Jump to newest
    
    updateDisplay();
    addThumbnail(imgUrl, currentIndex);
}

// --- Data Transfer (Phone Sending) ---
photoInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files.length > 0 && conn && conn.open) {
        // Visual feedback
        const originalText = sendBtn.querySelector('span').innerText;
        sendBtn.querySelector('span').innerText = "Sending...";
        
        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            conn.send(arrayBuffer);
        }
        
        sendBtn.querySelector('span').innerText = "Sent!";
        setTimeout(() => sendBtn.querySelector('span').innerText = originalText, 1500);
    }
});

// --- UI Functions ---

function updateDisplay() {
    // Hide placeholder, show image
    placeholderContent.style.display = 'none';
    mainImage.style.display = 'block';
    mainImage.src = photos[currentIndex];
    
    // Update active thumbnail
    document.querySelectorAll('.thumb').forEach((t, idx) => {
        // The first thumbnail is the "Start" placeholder, so we offset by 1
        // Actually, let's keep it simple: clear 'active' from all, set to current
         if(t.dataset.index == currentIndex) t.classList.add('active');
         else t.classList.remove('active');
    });
}

function addThumbnail(url, index) {
    const div = document.createElement('div');
    div.className = 'thumb active'; // Newest is active
    div.dataset.index = index;
    div.onclick = () => {
        currentIndex = index;
        updateDisplay();
    };
    
    const img = document.createElement('img');
    img.src = url;
    
    div.appendChild(img);
    thumbnailsContainer.appendChild(div);
    
    // Remove 'active' from previous siblings
    const siblings = thumbnailsContainer.children;
    for(let i=0; i<siblings.length-1; i++) {
        siblings[i].classList.remove('active');
    }
}

// QR Code Generation
function generateQRCode(id) {
    const url = `${window.location.href.split('?')[0]}?id=${id}`;
    qrCanvas.innerHTML = '';
    new QRCode(qrCanvas, {
        text: url,
        width: 150,
        height: 150,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}

// Button Handlers
qrBtn.addEventListener('click', () => {
    // Toggle QR visibility
    if(qrCanvas.style.display === 'none') {
        qrCanvas.style.display = 'block';
        stageTitle.innerText = "Scan to Pair";
        stageDesc.style.display = 'none';
    } else {
        qrCanvas.style.display = 'none';
        stageDesc.style.display = 'block';
    }
});

// Navigation Arrows
document.getElementById('prev-btn').addEventListener('click', () => {
    if (photos.length > 0 && currentIndex > 0) {
        currentIndex--;
        updateDisplay();
    }
});

document.getElementById('next-btn').addEventListener('click', () => {
    if (photos.length > 0 && currentIndex < photos.length - 1) {
        currentIndex++;
        updateDisplay();
    }
});

function updateStatus(text, color) {
    statusBadge.innerHTML = `${text} <span class="status-dot"></span>`;
    statusDot.style.backgroundColor = color;
    statusDot.style.boxShadow = `0 0 8px ${color}`;
}

// Start
init();
