// DOM Elements
const setupInterface = document.getElementById('setupInterface');
const runningInterface = document.getElementById('runningInterface');
const celebSelect = document.getElementById('celebSelect');
const timeSelect = document.getElementById('timeSelect');
const autoRandomToggle = document.getElementById('autoRandomToggle');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const refreshButton = document.getElementById('refreshButton');
const scanStatus = document.getElementById('scanStatus');
const runningStatus = document.getElementById('runningStatus');
const currentCeleb = document.getElementById('currentCeleb');
const cycleTime = document.getElementById('cycleTime');
const nextMode = document.getElementById('nextMode');
const currentStatus = document.getElementById('currentStatus');

// State management
let isScanning = false;
let automationState = {
    isRunning: false,
    selectedCeleb: '',
    cycleTime: 5,
    autoRandom: true,
    currentStep: ''
};
let scanIntervalId = null;
let knownCelebNames = []; // To track the list and avoid unnecessary UI updates

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await navigateToCelebPage();
    await loadState();
    
    if (automationState.isRunning) {
        showRunningInterface();
    } else {
        showSetupInterface();
        startContinuousScan();
    }
    
    // Event listeners
    startButton.addEventListener('click', startAutomation);
    stopButton.addEventListener('click', stopAutomation);
    refreshButton.addEventListener('click', () => {
        scanStatus.textContent = 'Đang quét lại...';
        scanForCelebs();
    });
    
    // Listen for updates from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'STATUS_UPDATE') {
            updateStatus(message.status);
            if(message.status.includes('Hoàn thành tất cả')) {
                 setTimeout(() => { stopAutomation(false); }, 2000);
            }
        } else if (message.type === 'CELEBS_FOUND') {
            populateCelebList(message.celebs);
        }
        // DO NOT return true here. This listener only receives data, it doesn't send a response.
    });

    // Clear interval when popup is closed
    window.addEventListener('beforeunload', () => {
        clearInterval(scanIntervalId);
    });
});

function startContinuousScan() {
    if (scanIntervalId) clearInterval(scanIntervalId);
    scanForCelebs(); // Initial scan
    scanIntervalId = setInterval(scanForCelebs, 5000); // Scan every 5 seconds
}

// Navigate to the correct page on popup open
async function navigateToCelebPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const targetUrl = 'https://locket.binhake.dev/celebrity.html';

        if (tab && tab.url && tab.url.startsWith('https://locket.binhake.dev/') && tab.url !== targetUrl) {
            await chrome.tabs.update(tab.id, { url: targetUrl });
            // Close popup to let user see the navigation
            window.close();
        }
    } catch (error) {
        console.error('Error navigating to celeb page:', error);
    }
}

// Check if we're on the right website
async function checkCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes('locket.binhake.dev')) {
            scanStatus.textContent = '⚠️ Vui lòng truy cập locket.binhake.dev';
            scanStatus.style.background = 'rgba(244, 67, 54, 0.2)';
            startButton.disabled = true;
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking tab:', error);
        return false;
    }
}

// Scan for available celebrities
async function scanForCelebs() {
    if (isScanning) return;
    if (!await checkCurrentTab()) return;

    isScanning = true;
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'SCAN_CELEBS' });
    } catch (error) {
        console.error('Error scanning celebs:', error);
    }
}

// Populate celebrity list
function populateCelebList(celebs) {
    isScanning = false;
    const newCelebNames = celebs.map(c => c.name).sort();

    // Only update the list if it has actually changed
    if (JSON.stringify(newCelebNames) === JSON.stringify(knownCelebNames)) {
        return;
    }
    knownCelebNames = newCelebNames;

    const selectedValue = celebSelect.value;
    celebSelect.innerHTML = '';
    
    if (celebs.length === 0) {
        celebSelect.innerHTML = '<option value="">Không có celeb nào để thêm</option>';
        scanStatus.textContent = 'ℹ️ Đang chờ celeb mới xuất hiện...';
        scanStatus.className = 'status-message loading';
        startButton.disabled = true;
        celebSelect.disabled = true;
    } else {
        celebSelect.innerHTML = '<option value="">-- Chọn một celeb --</option>';
        celebs.forEach(celeb => {
            const option = document.createElement('option');
            option.value = celeb.name;
            option.textContent = celeb.name;
            celebSelect.appendChild(option);
        });
        
        celebSelect.disabled = false;
        scanStatus.textContent = `✅ Tìm thấy ${celebs.length} celeb có thể kết bạn`;
        scanStatus.className = 'status-message';
        
        // Restore previous selection if possible
        if (newCelebNames.includes(selectedValue)) {
            celebSelect.value = selectedValue;
        }

        startButton.disabled = !celebSelect.value;
        celebSelect.addEventListener('change', () => {
            startButton.disabled = !celebSelect.value;
        });
    }
}

// Start automation
async function startAutomation() {
    clearInterval(scanIntervalId); // Stop scanning when automation starts
    const selectedCeleb = celebSelect.value;
    const selectedTime = parseInt(timeSelect.value);
    const autoRandom = autoRandomToggle.checked;
    
    if (!selectedCeleb) { alert('Vui lòng chọn một celeb!'); return; }
    
    automationState = { isRunning: true, selectedCeleb, cycleTime: selectedTime, autoRandom, currentStep: 'Đang bắt đầu...' };
    await saveState();
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'START_AUTOMATION', celeb: selectedCeleb, time: selectedTime, autoRandom });
        showRunningInterface();
    } catch (error) {
        console.error('Error starting automation:', error);
        automationState.isRunning = false;
        await saveState();
    }
}

// Stop automation
async function stopAutomation(showConfirm = true) {
    const stop = async () => {
        clearInterval(scanIntervalId);
        automationState.isRunning = false;
        await saveState();

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, { type: 'STOP_AUTOMATION' });
        } catch (error) { console.error('Error stopping automation:', error); }

        showSetupInterface();
        startContinuousScan();
    };

    if (showConfirm && confirm('Bạn có chắc muốn dừng chu kỳ tự động?')) {
        stop();
    } else if (!showConfirm) {
        stop();
    }
}


function showSetupInterface() {
    setupInterface.classList.remove('hidden');
    runningInterface.classList.add('hidden');
}

function showRunningInterface() {
    clearInterval(scanIntervalId);
    setupInterface.classList.add('hidden');
    runningInterface.classList.remove('hidden');
    
    currentCeleb.textContent = automationState.selectedCeleb;
    cycleTime.textContent = `${automationState.cycleTime} phút`;
    nextMode.textContent = automationState.autoRandom ? 'Tự động ngẫu nhiên' : 'Dừng lại';
    currentStatus.textContent = automationState.currentStep || 'Đang chạy...';
}

function updateStatus(status) {
    if (automationState.isRunning) {
        automationState.currentStep = status;
        currentStatus.textContent = status;
        runningStatus.textContent = status;

        if (status.startsWith('Bắt đầu chu kỳ cho')) {
            const newCeleb = status.replace('Bắt đầu chuỳ cho ', '').split(' - ')[0];
            automationState.selectedCeleb = newCeleb;
            currentCeleb.textContent = newCeleb;
        }

        saveState();
    }
}

async function saveState() {
    try {
        await chrome.storage.local.set({ automationState });
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

async function loadState() {
    try {
        const result = await chrome.storage.local.get(['automationState']);
        if (result.automationState) {
            automationState = { ...automationState, ...result.automationState };
            autoRandomToggle.checked = automationState.autoRandom;
        }
    } catch (error) {
        console.error('Error loading state:', error);
    }
}