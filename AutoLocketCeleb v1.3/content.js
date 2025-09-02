// Auto Locket Celeb v1.3 - Content Script

class LocketCelebHelper {
    constructor() {
        // --- State Properties ---
        this.state = {
            isRunning: false,
            currentCeleb: '',
            autoRandom: true,
            timerEnabled: false,
            timerDuration: 15,
            timerEndTime: 0,
            initialCeleb: '',
            currentStep: '',
        };
        
        // --- Internal Properties ---
        this.logObserver = null;
        this.connectionLostCounter = 0;
        this.timers = {
            step: null,
            main: null,
            tick: null,
        };

        // --- Constants ---
        this.CONSTANTS = {
            CONNECTION_LOST_THRESHOLD: 3,
            TARGET_ERROR_MESSAGE: 'The connection was suddenly lost',
            TARGET_SUCCESS_MESSAGE: '1 slot',
            RETRY_DELAY: 10000, // 10 giây
            SHORT_DELAY: 1500,
            MEDIUM_DELAY: 3000,
        };

        this.init();
    }
    
    /**
     * Khởi tạo script, lắng nghe tin nhắn và tiếp tục trạng thái nếu cần.
     */
    async init() {
        console.log('Auto Locket Celeb v1.3 - Initialized');
        this.addNotificationStyles();
        this.startGeneralObserver();
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
        
        await this.loadState();
        if (this.state.isRunning) {
            this.showNotification('Tiếp tục chu kỳ tự động...', 'info');
            this.resumeAutomation();
        }
    }
    
    /**
     * Xử lý tin nhắn từ popup.
     * @param {object} message - Tin nhắn nhận được.
     */
    handleMessage(message) {
        switch (message.type) {
            case 'SCAN_CELEBS':
                this.scanCelebs(true);
                break;
            case 'START_AUTOMATION':
                this.startAutomation(message);
                break;
            case 'STOP_AUTOMATION':
                this.stopAutomation();
                break;
            case 'RELOAD_PAGE':
                this.updateStatus('Đang tải lại...');
                this.showNotification('Đang tải lại trang theo yêu cầu...', 'info');
                setTimeout(() => window.location.reload(), 500);
                break;
        }
    }

    // --- Automation Core ---

    /**
     * Bắt đầu một chu kỳ tự động hóa mới.
     * @param {object} options - Tùy chọn từ popup.
     */
    async startAutomation({ celeb, autoRandom, timerEnabled, timerDuration }) {
        this.state = {
            ...this.state,
            isRunning: true,
            currentCeleb: celeb,
            initialCeleb: celeb,
            autoRandom,
            timerEnabled,
            timerDuration,
            timerEndTime: timerEnabled ? Date.now() + timerDuration * 60 * 1000 : 0,
        };

        this.updateStatus(`Bắt đầu chu kỳ cho ${celeb}`);
        this.showNotification(`Bắt đầu chu kỳ cho ${celeb}`, 'success');
        await this.saveState();
        this.runCycle();
    }
    
    /**
     * Tiếp tục chu kỳ tự động hóa sau khi tải lại trang.
     */
    resumeAutomation() {
        if (!this.state.isRunning) return;

        const isTimerExpired = this.state.timerEnabled && this.state.timerEndTime > 0 && Date.now() > this.state.timerEndTime;
        
        if (isTimerExpired) {
            // Nếu hết giờ, bắt đầu lại với celeb ban đầu
            this.state.currentCeleb = this.state.initialCeleb;
            this.state.timerEndTime = Date.now() + this.state.timerDuration * 60 * 1000;
            this.updateStatus(`Bắt đầu lại chu kỳ cho ${this.state.currentCeleb} (Hẹn giờ)`);
            this.saveState();
        }
        
        this.runCycle();
    }
    
    /**
     * Dừng hoàn toàn quá trình tự động hóa.
     */
    stopAutomation() {
        if (!this.state.isRunning) return;

        this.state.isRunning = false;
        this.clearAllTimers();
        if (this.logObserver) this.logObserver.disconnect();
        
        this.saveState().then(() => {
            this.updateStatus('Đã dừng. Đang tải lại...');
            this.showNotification('Đã dừng chu kỳ. Tải lại trang sau 1.5 giây...', 'warning');
            setTimeout(() => window.location.reload(), this.CONSTANTS.SHORT_DELAY);
        });
    }

    /**
     * Vòng lặp chính của chu trình tự động hóa.
     */
    async runCycle() {
        if (!this.state.isRunning) return;
        
        try {
            this.startLogObserver();
            
            await this.step_NavigateToCelebPage();
            await this.step_ResetFriendList();
            
            const canAddFriend = await this.step_AddFriend();
            if (!canAddFriend) {
                this.handleAlreadyFriends();
                return;
            }

            await this.step_StartProcess();
            this.updateStatus('Đang chạy... Giám sát nhật ký lỗi và thành công.');
            this.startMainTimer();

        } catch (error) {
            console.error('Lỗi trong chu kỳ tự động hóa:', error);
            this.showNotification(`Lỗi: ${error.message}`, 'error');
            if (this.state.isRunning) {
                this.updateStatus(`Gặp lỗi, thử lại sau ${this.CONSTANTS.RETRY_DELAY / 1000} giây...`);
                this.timers.step = setTimeout(() => this.runCycle(), this.CONSTANTS.RETRY_DELAY);
            }
        }
    }
    
    // --- Automation Steps ---

    async step_NavigateToCelebPage() {
        this.updateStatus('Điều hướng đến trang Celebrity...');
        if (!window.location.href.includes('celebrity.html')) {
            const celebrityLink = await this.waitForElement('a[href*="celebrity"]');
            if (celebrityLink) {
                celebrityLink.click();
                await new Promise(resolve => setTimeout(resolve, this.CONSTANTS.MEDIUM_DELAY));
            } else {
                throw new Error('Không tìm thấy link trang Celebrity.');
            }
        }
    }
    
    async step_ResetFriendList() {
        this.updateStatus('Tìm và nhấn nút reset...');
        const resetButton = this.findElementByText('button', ['Reset', 'Đặt lại']);
        if (resetButton) {
            resetButton.click();
            await new Promise(resolve => setTimeout(resolve, this.CONSTANTS.SHORT_DELAY));
            this.closeModals();
        } else {
            this.updateStatus('Không tìm thấy nút reset, bỏ qua.');
        }
    }

    async step_AddFriend() {
        this.updateStatus(`Tìm ${this.state.currentCeleb}...`);
        const celebContainer = await this.waitForCelebContainer(this.state.currentCeleb);
        if (!celebContainer) {
             throw new Error(`Không tìm thấy ${this.state.currentCeleb} trong danh sách.`);
        }

        const addButton = this.findElementByTextInElement(celebContainer, 'button', ['Thêm bạn bè']);
        if (addButton) {
            this.updateStatus(`Gửi yêu cầu kết bạn đến ${this.state.currentCeleb}...`);
            addButton.click();
            await new Promise(resolve => setTimeout(resolve, this.CONSTANTS.SHORT_DELAY));
            return true; // Tiếp tục
        }
        
        // Kiểm tra nếu đã là bạn bè
        const friendButton = this.findElementByTextInElement(celebContainer, 'button', ['Bạn bè']);
        if (friendButton) {
            return false; // Dừng lại
        }

        throw new Error(`Không có nút hành động cho ${this.state.currentCeleb}.`);
    }

    async step_StartProcess() {
        this.updateStatus('Tìm và nhấn "Bắt đầu" trong popup...');
        const startButton = await this.waitForElement('button', ['Bắt đầu', 'Start']);
        if (startButton) {
            startButton.click();
            this.showNotification('Đã bắt đầu tiến trình', 'success');
        } else {
            this.showNotification('Không tìm thấy nút "Bắt đầu"', 'warning');
        }
    }
    
    // --- Handlers ---
    
    handleAlreadyFriends() {
        if (this.state.timerEnabled) {
            this.updateStatus(`${this.state.currentCeleb} đã là bạn. Chờ hẹn giờ...`);
            this.showNotification(`${this.state.currentCeleb} đã là bạn, chờ hẹn giờ...`, 'info');
            this.startMainTimer();
        } else {
            this.showNotification(`${this.state.currentCeleb} đã là bạn bè hoặc không tìm thấy. Dừng chu kỳ.`, 'info');
            this.stopAutomation();
        }
    }

    handleConnectionLost() {
        if (!this.state.isRunning) return;
        this.updateStatus(`Mất kết nối quá ${this.CONSTANTS.CONNECTION_LOST_THRESHOLD} lần. Tải lại trang...`);
        this.showNotification(`Mất kết nối nhiều lần. Tải lại trang sau 3 giây...`, 'error');
        if (this.logObserver) this.logObserver.disconnect();
        setTimeout(() => window.location.reload(), this.CONSTANTS.MEDIUM_DELAY);
    }
    
    async handleSuccessAndRestart() {
        this.updateStatus('Thành công! Bắt đầu chu kỳ mới.');
        this.showNotification('Hoàn thành! Chuẩn bị chu kỳ tiếp theo...', 'success');
        
        if (this.state.autoRandom) {
            try {
                await this.step_ResetFriendList();
                const availableCelebs = await this.scanCelebs(false);
                const otherCelebs = availableCelebs.filter(c => c.name !== this.state.currentCeleb);

                if (otherCelebs.length > 0) {
                    const randomCeleb = otherCelebs[Math.floor(Math.random() * otherCelebs.length)];
                    this.state.currentCeleb = randomCeleb.name;
                    await this.saveState();
                    this.updateStatus(`Bắt đầu chu kỳ cho ${this.state.currentCeleb}`);
                    this.showNotification(`Chu kỳ tiếp theo: ${this.state.currentCeleb}`, 'success');
                    setTimeout(() => this.runCycle(), this.CONSTANTS.MEDIUM_DELAY);
                } else {
                    this.updateStatus('Hoàn thành tất cả! Không còn celeb để thêm.');
                    this.showNotification('Hoàn thành tất cả! Không còn celeb để thêm.', 'success');
                    this.stopAutomation();
                }
            } catch (error) {
                this.showNotification('Lỗi khi tìm celeb mới, dừng lại.', 'error');
                this.stopAutomation();
            }
        } else if (this.state.timerEnabled) {
            this.updateStatus('Hoàn thành. Chờ hẹn giờ để lặp lại...');
            this.showNotification('Hoàn thành. Chờ hẹn giờ...', 'info');
            // Timer đã chạy, không cần làm gì thêm
        } else {
            this.showNotification('Chu kỳ đã hoàn thành. Dừng lại.', 'info');
            this.stopAutomation();
        }
    }
    
    // --- Observers ---
    
    startLogObserver() {
        if (this.logObserver) this.logObserver.disconnect();
        this.connectionLostCounter = 0;
        
        const logContainer = document.querySelector('.log-container');
        if (!logContainer) {
            this.updateStatus('⚠️ Không tìm thấy khu vực nhật ký.');
            return;
        }

        this.logObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (!node.textContent) return;
                        const text = node.textContent;
                        if (text.includes(this.CONSTANTS.TARGET_ERROR_MESSAGE)) {
                            this.connectionLostCounter++;
                            this.updateStatus(`Mất kết nối lần ${this.connectionLostCounter}/${this.CONSTANTS.CONNECTION_LOST_THRESHOLD}`);
                            if (this.connectionLostCounter >= this.CONSTANTS.CONNECTION_LOST_THRESHOLD) {
                                this.handleConnectionLost();
                            }
                        } else if (text.includes(this.CONSTANTS.TARGET_SUCCESS_MESSAGE)) {
                            this.handleSuccessAndRestart();
                        }
                    });
                }
            }
        });

        this.logObserver.observe(logContainer, { childList: true, subtree: true });
        this.updateStatus('Đã bật giám sát nhật ký.');
    }
    
    startGeneralObserver() {
        const generalObserver = new MutationObserver(() => {
            // Tự động đóng popup thông báo
            const notificationTitle = this.findElementByText('h1, h2, h3, div', ['THÔNG BÁO QUAN TRỌNG']);
            if (notificationTitle) {
                const popup = notificationTitle.closest('div[role="dialog"], .modal, body > div:not([id])');
                if (popup) {
                    const closeButton = this.findElementByTextInElement(popup, 'button', ['x', 'close', 'đóng', 'Đóng']);
                    if (closeButton) closeButton.click();
                }
            }
            // Tự động nhấn "Xem thêm"
            const xemThemButton = this.findElementByText('button', ['Xem thêm']);
            if (xemThemButton) xemThemButton.click();
        });
        generalObserver.observe(document.body, { childList: true, subtree: true });
    }
    
    // --- Timers ---

    startMainTimer() {
        this.clearAllTimers(['step']); // Xóa timer step, giữ lại các timer khác nếu cần
        if (!this.state.isRunning || !this.state.timerEnabled) return;

        this.sendMessageToPopup('TIMER_TICK', { endTime: this.state.timerEndTime });
        this.timers.tick = setInterval(() => {
            if (this.state.isRunning && this.state.timerEnabled) {
                this.sendMessageToPopup('TIMER_TICK', { endTime: this.state.timerEndTime });
            } else {
                clearInterval(this.timers.tick);
            }
        }, 1000);

        const remainingTime = this.state.timerEndTime - Date.now();
        if (remainingTime <= 0) {
            this.handleTimerEnd();
        } else {
            this.timers.main = setTimeout(() => this.handleTimerEnd(), remainingTime);
        }
    }

    handleTimerEnd() {
        if (!this.state.isRunning) return;
        this.clearAllTimers();
        this.updateStatus('Hết giờ! Đang tải lại...');
        this.showNotification('Hết giờ! Tải lại trang để bắt đầu lại...', 'warning');
        setTimeout(() => window.location.reload(), this.CONSTANTS.SHORT_DELAY);
    }

    clearAllTimers(exclude = []) {
        Object.keys(this.timers).forEach(timerKey => {
            if (!exclude.includes(timerKey)) {
                clearTimeout(this.timers[timerKey]);
                clearInterval(this.timers[timerKey]);
                this.timers[timerKey] = null;
            }
        });
    }
    
    // --- DOM & Utility ---
    
    /**
     * Chờ một phần tử xuất hiện trên trang.
     * @param {string} selector - CSS selector.
     * @param {Array<string>} texts - (Tùy chọn) Mảng các chuỗi văn bản cần tìm.
     * @param {number} timeout - Thời gian chờ tối đa.
     * @returns {Promise<Element|null>}
     */
    waitForElement(selector, texts = null, timeout = 10000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                const element = this.findElementByText(selector, texts);
                if (element) {
                    clearInterval(interval);
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(interval);
                    resolve(null);
                }
            }, 500);
        });
    }
    
    async waitForCelebContainer(name, timeout = 10000) {
        return new Promise((resolve) => {
             const startTime = Date.now();
             const interval = setInterval(() => {
                 const container = this.findCelebrityContainer(name);
                 if (container) {
                     clearInterval(interval);
                     resolve(container);
                 } else if (Date.now() - startTime > timeout) {
                     clearInterval(interval);
                     resolve(null);
                 }
             }, 500);
         });
    }

    findCelebrityContainer(name) {
        const profileCards = document.querySelectorAll('div.profile');
        for (const card of profileCards) {
            const nameElement = card.querySelector('div.profile-name');
            if (nameElement && nameElement.textContent.trim() === name) {
                return card;
            }
        }
        return null;
    }
    
    findElementByText(selector, texts) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            // Kiểm tra xem phần tử có hiển thị không
            if (element.offsetParent === null) continue;
            
            const elementText = element.textContent.trim();
            if (texts) {
                if (texts.some(text => elementText.includes(text))) {
                    return element;
                }
            } else {
                return element; // Trả về phần tử đầu tiên nếu không có text
            }
        }
        return null;
    }
    
    findElementByTextInElement(parentElement, selector, texts) {
        const elements = parentElement.querySelectorAll(selector);
        for (const element of elements) {
            if (element.offsetParent !== null && texts.some(text => element.textContent.includes(text))) {
                return element;
            }
        }
        return null;
    }

    closeModals() {
        const closeButton = this.findElementByText('button', ['Đóng', 'Close', 'OK', 'Xác nhận']);
        if (closeButton) closeButton.click();
    }
    
    async scanCelebs(isManualScan = false) {
        const availableCelebs = [];
        const profileCards = document.querySelectorAll('div.profile');
        
        profileCards.forEach(card => {
            const nameElement = card.querySelector('div.profile-name');
            const addButton = card.querySelector('button.showMoreBtn');
            if (nameElement && addButton?.textContent.includes('Thêm bạn bè')) {
                availableCelebs.push({ name: nameElement.textContent.trim() });
            }
        });

        if (isManualScan) {
            this.sendMessageToPopup('CELEBS_FOUND', { celebs: availableCelebs });
        }
        
        return availableCelebs;
    }
    
    // --- State & Communication ---

    async saveState() {
        try {
            await chrome.storage.local.set({ automationState: this.state });
        } catch (error) {
            console.error('Lỗi khi lưu trạng thái:', error);
        }
    }
    
    async loadState() {
        try {
            const result = await chrome.storage.local.get(['automationState']);
            if (result.automationState) {
                this.state = { ...this.state, ...result.automationState };
            }
        } catch (error) {
            console.error('Lỗi khi tải trạng thái:', error);
        }
    }
    
    updateStatus(status) {
        this.state.currentStep = status;
        this.sendMessageToPopup('STATUS_UPDATE', { status });
        console.log('Status:', status);
    }
    
    sendMessageToPopup(type, data = {}) {
        try {
            chrome.runtime.sendMessage({ type, ...data });
        } catch (error) {
            // Bỏ qua lỗi nếu popup không mở
        }
    }
    
    // --- Notifications ---

    showNotification(message, type = 'info') {
        // Xóa thông báo cũ
        document.querySelectorAll('.locket-helper-notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `locket-helper-notification locket-notification-${type}`;
        notification.innerHTML = `<span class="locket-notification-icon">${{success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'}[type]}</span> ${message}`;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    addNotificationStyles() {
        if (document.getElementById('locket-helper-styles')) return;
        const style = document.createElement('style');
        style.id = 'locket-helper-styles';
        style.textContent = `
            .locket-helper-notification {
                position: fixed; top: 20px; right: 20px; z-index: 10001;
                padding: 15px 20px; background: white; border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15); display: flex;
                align-items: center; gap: 10px; font-family: sans-serif;
                font-size: 14px; animation: locketSlideIn 0.3s ease-out;
                border-left: 4px solid #2196F3;
            }
            .locket-notification-icon { font-size: 18px; }
            .locket-notification-success { border-left-color: #4CAF50; }
            .locket-notification-error { border-left-color: #f44336; }
            .locket-notification-warning { border-left-color: #ff9800; }
            @keyframes locketSlideIn {
                from { transform: translateX(110%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Khởi tạo đối tượng helper
new LocketCelebHelper();