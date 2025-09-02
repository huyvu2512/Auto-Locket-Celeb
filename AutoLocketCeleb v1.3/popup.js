// Auto Locket Celeb v1.3 - Popup Script

// IIFE (Immediately Invoked Function Expression) để tránh xung đột biến toàn cục
(function () {
    // --- DOM Elements ---
    const UIElements = {
        setupInterface: document.getElementById('setupInterface'),
        runningInterface: document.getElementById('runningInterface'),
        celebSelect: document.getElementById('celebSelect'),
        autoRandomToggle: document.getElementById('autoRandomToggle'),
        startButton: document.getElementById('startButton'),
        stopButton: document.getElementById('stopButton'),
        refreshButton: document.getElementById('refreshButton'),
        resetPageButton: document.getElementById('resetPageButton'),
        scanStatus: document.getElementById('scanStatus'),
        runningStatus: document.getElementById('runningStatus'),
        initialCeleb: document.getElementById('initialCeleb'),
        currentCeleb: document.getElementById('currentCeleb'),
        nextMode: document.getElementById('nextMode'),
        currentStatus: document.getElementById('currentStatus'),
        donateButton: document.getElementById('donateButton'),
        timerToggle: document.getElementById('timerToggle'),
        timerInput: document.getElementById('timerInput'),
        timerDisplay: document.getElementById('timerDisplay'),
        timerCountdown: document.getElementById('timerCountdown'),
    };

    // --- State Management ---
    let state = {
        isRunning: false,
        selectedCeleb: '',
        autoRandom: true,
        currentStep: '',
        timerEnabled: false,
        timerDuration: 15,
        timerEndTime: 0,
        initialCeleb: '',
        isScanning: false,
        knownCelebNames: [],
    };
    
    let intervals = {
        scan: null,
        countdown: null,
    };

    // --- Core Functions ---

    /**
     * Khởi tạo popup khi được mở.
     */
    async function initialize() {
        await loadStateFromStorage();
        setupEventListeners();
        
        if (state.isRunning) {
            switchToRunningUI();
            if (state.timerEnabled && state.timerEndTime > 0) {
                startCountdownTimer();
            }
        } else {
            switchToSetupUI();
            startContinuousScan();
        }
        
        // Luôn điều hướng đến trang celebrity nếu đang ở trang chủ
        navigateToCelebPage();
    }

    /**
     * Bắt đầu quá trình tự động hóa.
     */
    async function startAutomation() {
        if (!UIElements.celebSelect.value) {
            alert('Vui lòng chọn một celeb!');
            return;
        }

        state.isRunning = true;
        state.selectedCeleb = UIElements.celebSelect.value;
        state.initialCeleb = UIElements.celebSelect.value;
        state.autoRandom = UIElements.autoRandomToggle.checked;
        state.timerEnabled = UIElements.timerToggle.checked;
        state.timerDuration = parseInt(UIElements.timerInput.value, 10);
        state.currentStep = 'Đang bắt đầu...';
        state.timerEndTime = 0; // Reset timer end time

        await saveStateToStorage();
        sendMessageToContentScript('START_AUTOMATION', {
            celeb: state.selectedCeleb,
            autoRandom: state.autoRandom,
            timerEnabled: state.timerEnabled,
            timerDuration: state.timerDuration,
        });
        
        switchToRunningUI();
        if (state.timerEnabled) {
            startCountdownTimer();
        }
    }

    /**
     * Dừng quá trình tự động hóa.
     * @param {boolean} showConfirm - Hiển thị hộp thoại xác nhận hay không.
     */
    async function stopAutomation(showConfirm = true) {
        if (showConfirm && !confirm('Bạn có chắc muốn dừng chu kỳ tự động?')) {
            return;
        }

        clearIntervals();
        state.isRunning = false;
        state.timerEndTime = 0;
        await saveStateToStorage();
        
        sendMessageToContentScript('STOP_AUTOMATION');
        
        switchToSetupUI();
        startContinuousScan();
    }

    // --- UI Management ---

    /**
     * Chuyển sang giao diện đang chạy.
     */
    function switchToRunningUI() {
        UIElements.setupInterface.classList.add('hidden');
        UIElements.runningInterface.classList.remove('hidden');
        updateRunningInfo();
    }

    /**
     * Chuyển sang giao diện cài đặt.
     */
    function switchToSetupUI() {
        UIElements.setupInterface.classList.remove('hidden');
        UIElements.runningInterface.classList.add('hidden');
        clearIntervals(['countdown']); // Chỉ dừng countdown, không dừng scan
    }

    /**
     * Cập nhật thông tin trên giao diện đang chạy.
     */
    function updateRunningInfo() {
        UIElements.initialCeleb.textContent = state.initialCeleb || '-';
        UIElements.currentCeleb.textContent = state.selectedCeleb || '-';
        UIElements.nextMode.textContent = state.autoRandom ? 'Tự động ngẫu nhiên' : 'Dừng lại';
        UIElements.currentStatus.textContent = state.currentStep || 'Đang chạy...';
        
        UIElements.timerDisplay.style.display = state.timerEnabled ? 'flex' : 'none';
        if (state.timerEnabled) {
            updateCountdownDisplay();
        }
    }
    
    /**
     * Cập nhật hiển thị đồng hồ đếm ngược.
     */
    function updateCountdownDisplay() {
        if (!state.isRunning || !state.timerEnabled) {
            clearIntervals(['countdown']);
            return;
        }

        if (!state.timerEndTime) {
            UIElements.timerCountdown.textContent = 'Chờ bắt đầu...';
            return;
        }
        
        const remaining = state.timerEndTime - Date.now();
        
        if (state.currentStep?.includes('Đang tải lại...')) {
            UIElements.timerCountdown.textContent = 'Đang reset...';
            return;
        }

        if (remaining <= 0) {
            UIElements.timerCountdown.textContent = 'Hết giờ...';
            return;
        }
        
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        UIElements.timerCountdown.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Đổ danh sách celeb vào dropdown.
     * @param {Array} celebs - Mảng các celeb tìm thấy.
     */
    function populateCelebList(celebs) {
        state.isScanning = false;
        const newCelebNames = celebs.map(c => c.name).sort();

        // Chỉ cập nhật DOM nếu danh sách thay đổi
        if (JSON.stringify(newCelebNames) === JSON.stringify(state.knownCelebNames)) {
            return;
        }
        state.knownCelebNames = newCelebNames;

        const selectedValue = UIElements.celebSelect.value;
        UIElements.celebSelect.innerHTML = '';

        if (celebs.length === 0) {
            UIElements.celebSelect.innerHTML = '<option value="">Không có celeb nào để thêm</option>';
            UIElements.scanStatus.textContent = 'ℹ️ Đang chờ celeb mới xuất hiện...';
            UIElements.startButton.disabled = true;
            UIElements.celebSelect.disabled = true;
        } else {
            const fragment = document.createDocumentFragment();
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "-- Chọn một celeb --";
            fragment.appendChild(defaultOption);

            celebs.forEach(celeb => {
                const option = document.createElement('option');
                option.value = celeb.name;
                option.textContent = celeb.name;
                fragment.appendChild(option);
            });
            UIElements.celebSelect.appendChild(fragment);

            UIElements.celebSelect.disabled = false;
            UIElements.scanStatus.textContent = `✅ Tìm thấy ${celebs.length} celeb có thể kết bạn`;

            if (newCelebNames.includes(selectedValue)) {
                UIElements.celebSelect.value = selectedValue;
            }
            UIElements.startButton.disabled = !UIElements.celebSelect.value;
        }
    }

    // --- Event Handlers & Timers ---

    /**
     * Gắn các trình lắng nghe sự kiện vào các phần tử DOM.
     */
    function setupEventListeners() {
        UIElements.startButton.addEventListener('click', startAutomation);
        UIElements.stopButton.addEventListener('click', () => stopAutomation(true));
        UIElements.refreshButton.addEventListener('click', () => {
            UIElements.scanStatus.textContent = 'Đang quét lại...';
            scanForCelebs();
        });
        UIElements.resetPageButton.addEventListener('click', () => {
             sendMessageToContentScript('RELOAD_PAGE');
             window.close();
        });
        UIElements.donateButton.addEventListener('click', () => chrome.tabs.create({ url: 'donate.html' }));
        UIElements.timerToggle.addEventListener('change', (e) => UIElements.timerInput.disabled = !e.target.checked);
        UIElements.celebSelect.addEventListener('change', () => {
            UIElements.startButton.disabled = !UIElements.celebSelect.value;
        });

        // Lắng nghe tin nhắn từ các phần khác của tiện ích
        chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    }
    
    /**
     * Xử lý tin nhắn nhận được từ content script hoặc background.
     */
    function handleRuntimeMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'STATUS_UPDATE':
                handleStatusUpdate(message.status);
                if (message.status.includes('Hoàn thành tất cả')) {
                    setTimeout(() => stopAutomation(false), 2000);
                }
                break;
            case 'CELEBS_FOUND':
                populateCelebList(message.celebs);
                break;
            case 'TIMER_TICK':
                // Cập nhật thời gian kết thúc timer từ content script
                state.timerEndTime = message.endTime;
                saveStateToStorage();
                break;
        }
    }
    
    /**
     * Bắt đầu quét liên tục để tìm celeb.
     */
    function startContinuousScan() {
        if (intervals.scan) clearInterval(intervals.scan);
        scanForCelebs();
        intervals.scan = setInterval(scanForCelebs, 5000);
    }

    /**
     * Bắt đầu đồng hồ đếm ngược.
     */
    function startCountdownTimer() {
        if (intervals.countdown) clearInterval(intervals.countdown);
        if (!state.isRunning || !state.timerEnabled) return;
        
        updateCountdownDisplay(); // Cập nhật ngay
        intervals.countdown = setInterval(updateCountdownDisplay, 1000);
    }
    
    /**
     * Dừng các interval.
     * @param {Array<string>} timersToClear - Tên các interval cần dừng (e.g., ['scan', 'countdown']).
     */
    function clearIntervals(timersToClear = ['scan', 'countdown']) {
        timersToClear.forEach(timerName => {
            if (intervals[timerName]) {
                clearInterval(intervals[timerName]);
                intervals[timerName] = null;
            }
        });
    }

    // --- Communication & Navigation ---

    /**
     * Gửi tin nhắn đến content script đang hoạt động.
     * @param {string} type - Loại tin nhắn.
     * @param {object} data - Dữ liệu gửi kèm.
     */
    async function sendMessageToContentScript(type, data = {}) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, { type, ...data });
            }
        } catch (error) {
            console.error(`Lỗi khi gửi tin nhắn '${type}':`, error);
        }
    }

    /**
     * Yêu cầu content script quét tìm celeb.
     */
    async function scanForCelebs() {
        if (state.isScanning || state.isRunning) return;
        if (!(await isTabValid())) return;
        
        state.isScanning = true;
        sendMessageToContentScript('SCAN_CELEBS');
    }
    
    /**
     * Điều hướng đến trang celebrity nếu cần.
     */
    async function navigateToCelebPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const targetUrl = 'https://locket.binhake.dev/celebrity.html';
            if (tab?.url && tab.url.startsWith('https://locket.binhake.dev/') && tab.url !== targetUrl) {
                // Không đóng popup, chỉ điều hướng tab
                await chrome.tabs.update(tab.id, { url: targetUrl });
            }
        } catch (error) {
            console.error('Lỗi khi điều hướng đến trang celeb:', error);
        }
    }
    
    /**
     * Kiểm tra xem tab hiện tại có hợp lệ để chạy tiện ích không.
     * @returns {boolean}
     */
    async function isTabValid() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.url || !tab.url.includes('locket.binhake.dev')) {
                UIElements.scanStatus.textContent = '⚠️ Vui lòng truy cập locket.binhake.dev';
                UIElements.scanStatus.style.background = 'rgba(244, 67, 54, 0.2)';
                UIElements.startButton.disabled = true;
                return false;
            }
            return true;
        } catch (error) {
            console.error('Lỗi khi kiểm tra tab:', error);
            return false;
        }
    }

    // --- State Persistence ---

    /**
     * Tải trạng thái từ chrome.storage.
     */
    async function loadStateFromStorage() {
        try {
            const result = await chrome.storage.local.get(['automationState']);
            if (result.automationState) {
                state = { ...state, ...result.automationState };
                UIElements.autoRandomToggle.checked = state.autoRandom;
                UIElements.timerToggle.checked = state.timerEnabled;
                UIElements.timerInput.value = state.timerDuration;
                UIElements.timerInput.disabled = !state.timerEnabled;
            }
        } catch (error) {
            console.error('Lỗi khi tải trạng thái:', error);
        }
    }

    /**
     * Lưu trạng thái vào chrome.storage.
     */
    async function saveStateToStorage() {
        try {
            // Chỉ lưu trữ những dữ liệu cần thiết, không lưu trữ isScanning và knownCelebNames
            const stateToSave = { ...state };
            delete stateToSave.isScanning;
            delete stateToSave.knownCelebNames;
            await chrome.storage.local.set({ automationState: stateToSave });
        } catch (error) {
            console.error('Lỗi khi lưu trạng thái:', error);
        }
    }
    
     /**
     * Xử lý cập nhật trạng thái từ content script.
     * @param {string} statusText - Chuỗi trạng thái.
     */
    function handleStatusUpdate(statusText) {
        if (state.isRunning) {
            state.currentStep = statusText;
            UIElements.currentStatus.textContent = statusText;
            UIElements.runningStatus.textContent = statusText;
            
            // Cập nhật tên celeb hiện tại nếu có thay đổi
            if (statusText.startsWith('Bắt đầu chu kỳ cho')) {
                const newCeleb = statusText.replace('Bắt đầu chu kỳ cho ', '').split(' - ')[0].replace(' (Hẹn giờ)', '');
                state.selectedCeleb = newCeleb;
                UIElements.currentCeleb.textContent = newCeleb;
            }
            
            // Bắt đầu timer khi chu kỳ thực sự bắt đầu chạy trong content script
            if (statusText.includes('Đang chạy... Giám sát nhật ký') && state.timerEnabled && !intervals.countdown) {
                startCountdownTimer();
            }

            saveStateToStorage();
        }
    }

    // --- Initialization ---
    document.addEventListener('DOMContentLoaded', initialize);
})();