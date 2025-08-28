// DOM Elements
const setupInterface = document.getElementById('setupInterface');
const runningInterface = document.getElementById('runningInterface');
const celebSelect = document.getElementById('celebSelect');
const autoRandomToggle = document.getElementById('autoRandomToggle');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const refreshButton = document.getElementById('refreshButton');
const resetPageButton = document.getElementById('resetPageButton');
const scanStatus = document.getElementById('scanStatus');
const runningStatus = document.getElementById('runningStatus');
const currentCeleb = document.getElementById('currentCeleb');
const nextMode = document.getElementById('nextMode');
const currentStatus = document.getElementById('currentStatus');
const donateButton = document.getElementById('donateButton');
const timerToggle = document.getElementById('timerToggle');
const timerInput = document.getElementById('timerInput');
const timerDisplay = document.getElementById('timerDisplay');
const timerCountdown = document.getElementById('timerCountdown');
const initialCeleb = document.getElementById('initialCeleb');

// State management
let isScanning = false;
let automationState = {
    isRunning: false,
    selectedCeleb: '',
    autoRandom: true,
    currentStep: '',
    timerEnabled: false,
    timerDuration: 15,
    timerEndTime: 0,
    initialCeleb: ''
};
let scanIntervalId = null;
let countdownIntervalId = null;
let knownCelebNames = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Mở tab mới đến trang celeb nếu cần trước khi thực hiện bất kỳ hành động nào khác
    await navigateToCelebPage();
    
    await loadState();

    if (automationState.isRunning) {
        showRunningInterface();
        if (automationState.timerEnabled) {
            if (countdownIntervalId) clearInterval(countdownIntervalId);
            countdownIntervalId = setInterval(updateCountdown, 1000);
            updateCountdown();
        }
    } else {
        showSetupInterface();
        startContinuousScan();
    }

    startButton.addEventListener('click', startAutomation);
    stopButton.addEventListener('click', stopAutomation);
    refreshButton.addEventListener('click', () => { scanStatus.textContent = 'Đang quét lại...'; scanForCelebs(); });
    resetPageButton.addEventListener('click', () => { try { chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { if (tabs.length > 0) { chrome.tabs.sendMessage(tabs[0].id, { type: 'RELOAD_PAGE' }); window.close(); } }); } catch (error) { console.error('Error sending reload message:', error); } });
    donateButton.addEventListener('click', () => { chrome.tabs.create({ url: 'donate.html' }); });
    timerToggle.addEventListener('change', () => { timerInput.disabled = !timerToggle.checked; });

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
        clearInterval(countdownIntervalId);
    });
});

async function startAutomation() {
    clearInterval(scanIntervalId);
    const selectedCeleb = celebSelect.value;
    const autoRandom = autoRandomToggle.checked;
    const timerEnabled = timerToggle.checked;
    const timerDuration = parseInt(timerInput.value, 10);
    if (!selectedCeleb) { alert('Vui lòng chọn một celeb!'); return; }
    
    automationState = { 
        isRunning: true, 
        selectedCeleb, 
        autoRandom, 
        currentStep: 'Đang bắt đầu...',
        timerEnabled,
        timerDuration,
        timerEndTime: timerEnabled ? Date.now() + timerDuration * 60 * 1000 : 0,
        initialCeleb: selectedCeleb
    };
    await saveState();
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { 
            type: 'START_AUTOMATION', 
            celeb: selectedCeleb, 
            autoRandom,
            timerEnabled,
            timerDuration
        });
        showRunningInterface();
        if (automationState.timerEnabled) {
             if (countdownIntervalId) clearInterval(countdownIntervalId);
             countdownIntervalId = setInterval(updateCountdown, 1000);
             updateCountdown();
        }
    } catch (error) {
        console.error('Error starting automation:', error);
        automationState.isRunning = false;
        await saveState();
    }
}

async function stopAutomation(showConfirm = true) {
    const stop = async () => {
        if(countdownIntervalId) clearInterval(countdownIntervalId);
        clearInterval(scanIntervalId);
        automationState.isRunning = false;
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, { type: 'STOP_AUTOMATION' });
        } catch (error) { console.error('Error stopping automation:', error); }
        showSetupInterface();
        startContinuousScan();
    };
    if (showConfirm && confirm('Bạn có chắc muốn dừng chu kỳ tự động?')) { await stop(); }
    else if (!showConfirm) { await stop(); }
}

function showRunningInterface() {
    clearInterval(scanIntervalId);
    setupInterface.classList.add('hidden');
    runningInterface.classList.remove('hidden');
    
    initialCeleb.textContent = automationState.initialCeleb;
    currentCeleb.textContent = automationState.selectedCeleb;
    nextMode.textContent = automationState.autoRandom ? 'Tự động ngẫu nhiên' : 'Dừng lại';
    currentStatus.textContent = automationState.currentStep || 'Đang chạy...';

    if (automationState.timerEnabled) {
        timerDisplay.style.display = 'flex';
        updateCountdown();
    } else {
        timerDisplay.style.display = 'none';
    }
}

function updateCountdown() {
    if (!automationState.isRunning || !automationState.timerEnabled || !automationState.timerEndTime) return;
    const remaining = automationState.timerEndTime - Date.now();
    
    if (automationState.currentStep.includes('Đang tải lại...')) {
        timerCountdown.textContent = 'Đang reset...';
        return;
    }
    if (remaining <= 0) {
        timerCountdown.textContent = 'Hết giờ...';
        return;
    }
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timerCountdown.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startContinuousScan() { if (scanIntervalId) clearInterval(scanIntervalId); scanForCelebs(); scanIntervalId = setInterval(scanForCelebs, 5000); }

async function navigateToCelebPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const targetUrl = 'https://locket.binhake.dev/celebrity.html';
        
        // Nếu URL của tab hiện tại không phải là URL đích, hãy mở một tab mới
        if (tab && tab.url !== targetUrl) {
            await chrome.tabs.create({ url: targetUrl });
            window.close(); // Đóng popup vì đã mở tab mới
        }
    } catch (error) {
        console.error('Error navigating to celeb page:', error);
    }
}

async function checkCurrentTab() { try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab || !tab.url || !tab.url.includes('locket.binhake.dev')) { scanStatus.textContent = '⚠️ Vui lòng truy cập locket.binhake.dev'; scanStatus.style.background = 'rgba(244, 67, 54, 0.2)'; startButton.disabled = true; return false; } return true; } catch (error) { console.error('Error checking tab:', error); return false; } }
async function scanForCelebs() { if (isScanning) return; if (!await checkCurrentTab()) return; isScanning = true; try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); chrome.tabs.sendMessage(tab.id, { type: 'SCAN_CELEBS' }); } catch (error) { console.error('Error scanning celebs:', error); } }
function populateCelebList(celebs) { isScanning = false; const newCelebNames = celebs.map(c => c.name).sort(); if (JSON.stringify(newCelebNames) === JSON.stringify(knownCelebNames)) return; knownCelebNames = newCelebNames; const selectedValue = celebSelect.value; celebSelect.innerHTML = ''; if (celebs.length === 0) { celebSelect.innerHTML = '<option value="">Không có celeb nào để thêm</option>'; scanStatus.textContent = 'ℹ️ Đang chờ celeb mới xuất hiện...'; startButton.disabled = true; celebSelect.disabled = true; } else { celebSelect.innerHTML = '<option value="">-- Chọn một celeb --</option>'; celebs.forEach(celeb => { const option = document.createElement('option'); option.value = celeb.name; option.textContent = celeb.name; celebSelect.appendChild(option); }); celebSelect.disabled = false; scanStatus.textContent = `✅ Tìm thấy ${celebs.length} celeb có thể kết bạn`; if (newCelebNames.includes(selectedValue)) celebSelect.value = selectedValue; startButton.disabled = !celebSelect.value; celebSelect.addEventListener('change', () => { startButton.disabled = !celebSelect.value; }); } }
function showSetupInterface() { setupInterface.classList.remove('hidden'); runningInterface.classList.add('hidden'); if(countdownIntervalId) clearInterval(countdownIntervalId); }
function updateStatus(status) { if (automationState.isRunning) { automationState.currentStep = status; currentStatus.textContent = status; runningStatus.textContent = status; if (status.startsWith('Bắt đầu chu kỳ cho')) { const newCeleb = status.replace('Bắt đầu chu kỳ cho ', '').split(' - ')[0].replace(' (Hẹn giờ)', ''); automationState.selectedCeleb = newCeleb; currentCeleb.textContent = newCeleb; } saveState(); } }
async function saveState() { try { await chrome.storage.local.set({ automationState }); } catch (error) { console.error('Error saving state:', error); } }
async function loadState() { try { const result = await chrome.storage.local.get(['automationState']); if (result.automationState) { automationState = { ...automationState, ...result.automationState }; autoRandomToggle.checked = automationState.autoRandom; timerToggle.checked = automationState.timerEnabled; timerInput.value = automationState.timerDuration; timerInput.disabled = !automationState.timerEnabled; } } catch (error) { console.error('Error loading state:', error); } }