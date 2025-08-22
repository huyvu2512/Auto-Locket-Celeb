// DOM Elements
const setupInterface = document.getElementById('setupInterface');
const runningInterface = document.getElementById('runningInterface');
const celebSelect = document.getElementById('celebSelect');
// REMOVED timeSelect
const autoRandomToggle = document.getElementById('autoRandomToggle');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const refreshButton = document.getElementById('refreshButton');
const scanStatus = document.getElementById('scanStatus');
const runningStatus = document.getElementById('runningStatus');
const currentCeleb = document.getElementById('currentCeleb');
// REMOVED cycleTime
const nextMode = document.getElementById('nextMode');
const currentStatus = document.getElementById('currentStatus');

// State management
let isScanning = false;
let automationState = {
    isRunning: false,
    selectedCeleb: '',
    // REMOVED cycleTime
    autoRandom: true,
    currentStep: ''
};
let scanIntervalId = null;
let knownCelebNames = [];

document.addEventListener('DOMContentLoaded', async () => {
    await navigateToCelebPage();
    await loadState();
    
    if (automationState.isRunning) {
        showRunningInterface();
    } else {
        showSetupInterface();
        startContinuousScan();
    }
    
    startButton.addEventListener('click', startAutomation);
    stopButton.addEventListener('click', stopAutomation);
    refreshButton.addEventListener('click', () => {
        scanStatus.textContent = 'Đang quét lại...';
        scanForCelebs();
    });
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'STATUS_UPDATE') {
            updateStatus(message.status);
            if(message.status.includes('Hoàn thành tất cả')) {
                 setTimeout(() => { stopAutomation(false); }, 2000);
            }
        } else if (message.type === 'CELEBS_FOUND') {
            populateCelebList(message.celebs);
        }
    });

    window.addEventListener('beforeunload', () => {
        clearInterval(scanIntervalId);
    });
});

function startContinuousScan() {
    if (scanIntervalId) clearInterval(scanIntervalId);
    scanForCelebs();
    scanIntervalId = setInterval(scanForCelebs, 5000);
}

async function navigateToCelebPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const targetUrl = 'https://locket.binhake.dev/celebrity.html';

        if (tab && tab.url && tab.url.startsWith('https://locket.binhake.dev/') && tab.url !== targetUrl) {
            await chrome.tabs.update(tab.id, { url: targetUrl });
            window.close();
        }
    } catch (error) {
        console.error('Error navigating to celeb page:', error);
    }
}

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

function populateCelebList(celebs) {
    isScanning = false;
    const newCelebNames = celebs.map(c => c.name).sort();

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
        
        if (newCelebNames.includes(selectedValue)) {
            celebSelect.value = selectedValue;
        }

        startButton.disabled = !celebSelect.value;
        celebSelect.addEventListener('change', () => {
            startButton.disabled = !celebSelect.value;
        });
    }
}

async function startAutomation() {
    clearInterval(scanIntervalId);
    const selectedCeleb = celebSelect.value;
    const autoRandom = autoRandomToggle.checked;
    
    if (!selectedCeleb) { alert('Vui lòng chọn một celeb!'); return; }
    
    // Updated automationState without cycleTime
    automationState = { isRunning: true, selectedCeleb, autoRandom, currentStep: 'Đang bắt đầu...' };
    await saveState();
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        // Updated message without time
        chrome.tabs.sendMessage(tab.id, { type: 'START_AUTOMATION', celeb: selectedCeleb, autoRandom });
        showRunningInterface();
    } catch (error) {
        console.error('Error starting automation:', error);
        automationState.isRunning = false;
        await saveState();
    }
}

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
    // REMOVED cycleTime.textContent
    nextMode.textContent = automationState.autoRandom ? 'Tự động ngẫu nhiên' : 'Dừng lại';
    currentStatus.textContent = automationState.currentStep || 'Đang chạy...';
}

function updateStatus(status) {
    if (automationState.isRunning) {
        automationState.currentStep = status;
        currentStatus.textContent = status;
        runningStatus.textContent = status;

        if (status.startsWith('Bắt đầu chu kỳ cho')) {
            const newCeleb = status.replace('Bắt đầu chu kỳ cho ', '').split(' - ')[0];
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