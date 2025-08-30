class LocketCelebHelper {
    constructor() {
        // Core state
        this.isRunning = false;
        this.currentCeleb = '';
        this.autoRandom = true;
        this.currentStep = '';
        this.initialCeleb = '';
        
        // Timer management
        this.timerEnabled = false;
        this.timerDuration = 0;
        this.timerEndTime = 0;
        this.timerUpdateInterval = null;
        
        // Timeout and observer management
        this.stepTimeout = null;
        this.logObserver = null;
        this.watchdogTimer = null;
        this.generalObserver = null;
        
        // Connection monitoring
        this.connectionLostCounter = 0;
        this.CONNECTION_LOST_THRESHOLD = 3;
        this.TARGET_ERROR_MESSAGE = 'The connection was suddenly lost';
        this.TARGET_SUCCESS_MESSAGE = '1 slot';
        
        // Performance optimization
        this.debounceTimers = new Map();
        this.observerThrottleDelay = 100;
        
        this.init();
    }
    
    async init() {
        console.log('Auto Locket Celeb v1.2 - Optimized Initialized');
        this.setupMessageListener();
        this.startGeneralObserver();
        await this.loadState();
        
        if (this.isRunning) {
            this.showNotification('Tiếp tục chu kỳ tự động...', 'info');
            this.resumeAutomation();
        }
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message);
            sendResponse({ success: true }); // Always send response
        });
    }
    
    handleMessage(message) {
        const handlers = {
            'SCAN_CELEBS': () => this.scanCelebs(true),
            'START_AUTOMATION': () => this.startAutomation(
                message.celeb, 
                message.autoRandom, 
                message.timerEnabled, 
                message.timerDuration
            ),
            'STOP_AUTOMATION': () => this.stopAutomation(),
            'RELOAD_PAGE': () => this.reloadPage()
        };
        
        const handler = handlers[message.type];
        if (handler) {
            try {
                handler();
            } catch (error) {
                console.error(`Error handling message ${message.type}:`, error);
            }
        }
    }
    
    reloadPage() {
        this.updateStatus('Đang tải lại...');
        this.showNotification('Đang tải lại trang theo yêu cầu...', 'info');
        this.cleanup();
        setTimeout(() => window.location.reload(), 500);
    }
    
    async startAutomation(celeb, autoRandom, timerEnabled, timerDuration) {
        this.isRunning = true;
        this.currentCeleb = celeb;
        this.initialCeleb = celeb;
        this.autoRandom = autoRandom;
        this.timerEnabled = timerEnabled;
        this.timerDuration = timerDuration;
        this.timerEndTime = 0; // Will be set when "Start" button is clicked
        
        this.updateStatus(`Bắt đầu chu kỳ cho ${celeb}`);
        this.showNotification(`Bắt đầu chu kỳ cho ${celeb}`, 'success');
        
        await this.saveState();
        this.runCycle();
    }
    
    resumeAutomation() {
        if (!this.isRunning) return;
        
        // Check if timer has expired and reset if needed
        if (this.timerEnabled && this.timerEndTime > 0 && Date.now() >= this.timerEndTime) {
            this.resetToInitialState();
        }
        
        // Start timer update if timer is already running
        if (this.timerEnabled && this.timerEndTime > 0) {
            this.startTimerUpdate();
        }
        
        this.runCycle();
    }
    
    resetToInitialState() {
        this.currentCeleb = this.initialCeleb;
        this.timerEndTime = Date.now() + this.timerDuration * 60 * 1000;
        this.updateStatus(`Bắt đầu chu kỳ cho ${this.currentCeleb} (Hết thời gian, reset)`);
        this.saveState();
    }
    
    startTimerUpdate() {
        this.stopTimerUpdate();
        
        if (!this.timerEnabled || this.timerEndTime === 0) return;

        this.timerUpdateInterval = setInterval(() => {
            if (!this.isRunning || !this.timerEnabled) {
                this.stopTimerUpdate();
                return;
            }

            const remainingTime = this.timerEndTime - Date.now();
            
            this.sendToPopup('TIMER_TICK', { 
                endTime: this.timerEndTime,
                remainingTime: remainingTime
            });

            if (remainingTime <= 0) {
                this.handleTimerEnd();
            }
        }, 1000);
    }

    stopTimerUpdate() {
        if (this.timerUpdateInterval) {
            clearInterval(this.timerUpdateInterval);
            this.timerUpdateInterval = null;
        }
    }

    handleTimerEnd() {
        if (!this.isRunning) return;
        
        this.stopTimerUpdate();
        this.updateStatus('Hết thời gian! Đang tải lại để tiếp tục...');
        this.showNotification('Hết thời gian! Đang tải lại trang để tiếp tục chu kỳ...', 'warning');
        
        this.resetToInitialState();
        setTimeout(() => {
            this.cleanup();
            window.location.reload();
        }, 1500);
    }
    
    async runCycle() {
        if (!this.isRunning) return;
        
        this.startWatchdog();

        try {
            this.startLogObserver();
            await this.executeSteps();
        } catch (error) {
            this.handleCycleError(error);
        }
    }
    
    async executeSteps() {
        await this.step0_Navigate();
        await this.step1_Reset();
        
        const shouldContinue = await this.step3_AddFriend();
        if (!shouldContinue) {
            await this.handleAlreadyFriend();
            return;
        }

        await this.step4_StartProcess();
        this.updateStatus('Đang chạy... Giám sát nhật ký lỗi và thành công.');
    }
    
    async handleAlreadyFriend() {
        this.stopWatchdog();
        
        if (this.timerEnabled) {
            this.updateStatus(`${this.currentCeleb} đã là bạn. Tiếp tục chạy và chờ timer...`);
            
            if (this.autoRandom) {
                await this.switchToRandomCeleb();
            }
        } else {
            this.showNotification(`${this.currentCeleb} đã là bạn bè. Dừng chu kỳ do không có timer.`, 'info');
            this.stopAutomation();
        }
    }
    
    async switchToRandomCeleb() {
        this.updateStatus('Tìm celeb khác để thêm...');
        
        try {
            await this.step1_Reset();
            const availableCelebs = await this.scanCelebs(false);
            
            if (availableCelebs.length > 0) {
                const randomCeleb = this.getRandomCeleb(availableCelebs);
                this.currentCeleb = randomCeleb.name;
                await this.saveState();
                this.updateStatus(`Chuyển sang ${this.currentCeleb}`);
                setTimeout(() => this.runCycle(), 3000);
            } else {
                this.updateStatus('Không có celeb khác. Chờ timer...');
            }
        } catch (error) {
            this.updateStatus('Lỗi khi tìm celeb khác. Chờ timer...');
        }
    }
    
    getRandomCeleb(celebs) {
        return celebs[Math.floor(Math.random() * celebs.length)];
    }
    
    handleCycleError(error) {
        console.error('Automation error:', error);
        this.showNotification(`Lỗi: ${error.message}`, 'error');
        
        if (this.isRunning) {
            this.updateStatus('Gặp lỗi, thử lại sau 10 giây...');
            this.scheduleRetry();
        }
    }
    
    scheduleRetry() {
        setTimeout(() => {
            if (this.isRunning) {
                this.runCycle();
            }
        }, 10000);
    }
    
    startWatchdog() {
        this.stopWatchdog();
        
        this.watchdogTimer = setTimeout(() => {
            if (!this.isRunning) return;
            
            this.showNotification('Không phát hiện hoạt động trong 5 phút. Tự động tải lại...', 'warning');
            this.updateStatus('Tự động tải lại do không có hoạt động...');
            
            setTimeout(() => {
                this.cleanup();
                window.location.reload();
            }, 1500);
        }, 5 * 60 * 1000);
    }
    
    stopWatchdog() {
        if (this.watchdogTimer) {
            clearTimeout(this.watchdogTimer);
            this.watchdogTimer = null;
        }
    }

    stopAutomation() {
        console.log('Stopping automation - called explicitly');
        this.cleanup();
        this.isRunning = false;
        this.timerEnabled = false;
        this.timerEndTime = 0;
        
        this.saveState();
        this.updateStatus('Đã dừng. Đang tải lại...');
        this.showNotification('Đã dừng chu kỳ tự động. Đang tải lại trang...', 'warning');
        
        setTimeout(() => window.location.reload(), 1500);
    }
    
    cleanup() {
        // Clear all timers and intervals
        if (this.stepTimeout) clearTimeout(this.stepTimeout);
        if (this.timerUpdateInterval) clearInterval(this.timerUpdateInterval);
        this.stopWatchdog();
        this.stopTimerUpdate();
        
        // Disconnect observers
        if (this.logObserver) {
            this.logObserver.disconnect();
            this.logObserver = null;
        }
        
        if (this.generalObserver) {
            this.generalObserver.disconnect();
            this.generalObserver = null;
        }
        
        // Clear debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }
    
    // Optimized observer with throttling
    startGeneralObserver() {
        if (this.generalObserver) {
            this.generalObserver.disconnect();
        }
        
        this.generalObserver = new MutationObserver(
            this.throttle((mutations) => {
                this.handleGeneralMutations(mutations);
            }, this.observerThrottleDelay)
        );
        
        this.generalObserver.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }
    
    handleGeneralMutations(mutations) {
        // Handle important notification popup
        const notificationTitle = this.findElement('h1, h2, h3, div', 
            el => el.textContent.includes('THÔNG BÁO QUAN TRỌNG')
        );
        
        if (notificationTitle) {
            this.closeNotificationPopup(notificationTitle);
        }
        
        // Handle "Xem thêm" button
        const xemThemButton = this.findElementByText('button', ['Xem thêm']);
        if (xemThemButton) {
            xemThemButton.click();
        }
    }
    
    closeNotificationPopup(notificationTitle) {
        const popupContainer = notificationTitle.closest('div[role="dialog"], .modal, body > div:not([id])');
        if (popupContainer) {
            const closeButton = this.findElement('button', btn => {
                const text = btn.textContent.trim().toLowerCase();
                const label = btn.getAttribute('aria-label')?.toLowerCase();
                return text === 'x' || 
                       label?.includes('close') || 
                       label?.includes('đóng');
            }, popupContainer);
            
            if (closeButton) {
                closeButton.click();
            }
        }
    }
    
    // Utility function for throttling
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        
        return (...args) => {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func(...args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func(...args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }
    
    // Optimized element finding
    findElement(selector, predicate, container = document) {
        const elements = container.querySelectorAll(selector);
        for (const element of elements) {
            if (predicate(element) && element.offsetParent !== null) {
                return element;
            }
        }
        return null;
    }
    
    scanCelebs(isManualScan = false) {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                const availableCelebs = this.extractAvailableCelebs();
                
                if (isManualScan) {
                    this.sendToPopup('CELEBS_FOUND', { celebs: availableCelebs });
                }
                
                resolve(availableCelebs);
            });
        });
    }
    
    extractAvailableCelebs() {
        const availableCelebs = [];
        const profileCards = document.querySelectorAll('div.profile');
        
        for (const card of profileCards) {
            const nameElement = card.querySelector('div.profile-name');
            const addButton = card.querySelector('button.showMoreBtn');
            
            if (nameElement && addButton && addButton.textContent.includes('Thêm bạn bè')) {
                const name = nameElement.textContent.trim();
                if (name) {
                    availableCelebs.push({ 
                        name: name, 
                        status: 'Thêm bạn bè' 
                    });
                }
            }
        }
        
        return availableCelebs;
    }
    
    startLogObserver() {
        if (this.logObserver) {
            this.logObserver.disconnect();
        }
        
        this.connectionLostCounter = 0;
        const logContainer = document.querySelector('.log-container');
        
        if (!logContainer) {
            this.updateStatus('⚠️ Không tìm thấy khu vực nhật ký để giám sát.');
            return;
        }
        
        this.logObserver = new MutationObserver(
            this.throttle((mutations) => {
                this.handleLogMutations(mutations);
            }, 200)
        );
        
        this.logObserver.observe(logContainer, { 
            childList: true, 
            subtree: true 
        });
        
        this.updateStatus('Đã bật giám sát nhật ký lỗi và thành công.');
    }
    
    handleLogMutations(mutations) {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (!node.textContent) return;
                    
                    if (node.textContent.includes(this.TARGET_ERROR_MESSAGE)) {
                        this.handleConnectionError();
                    } else if (node.textContent.includes(this.TARGET_SUCCESS_MESSAGE)) {
                        this.handleSuccessAndRestart();
                    }
                });
            }
        }
    }
    
    handleConnectionError() {
        this.connectionLostCounter++;
        this.updateStatus(`Mất kết nối lần ${this.connectionLostCounter}/${this.CONNECTION_LOST_THRESHOLD}`);
        
        if (this.connectionLostCounter >= this.CONNECTION_LOST_THRESHOLD) {
            this.handleConnectionLost();
        }
    }
    
    handleConnectionLost() {
        if (!this.isRunning) return;
        
        this.updateStatus(`Mất kết nối quá ${this.CONNECTION_LOST_THRESHOLD} lần. Đang tải lại trang...`);
        this.showNotification('Mất kết nối nhiều lần. Tải lại trang sau 3 giây...', 'error');
        
        if (this.logObserver) {
            this.logObserver.disconnect();
        }
        
        setTimeout(() => {
            this.cleanup();
            window.location.reload();
        }, 3000);
    }
    
    async handleSuccessAndRestart() {
        this.stopWatchdog();
        this.updateStatus('Phát hiện "1 slot"! Bắt đầu chu kỳ mới.');
        
        if (this.isRunning && this.autoRandom) {
            await this.handleRandomCelebSelection();
        } else if (this.isRunning) {
            this.scheduleNextCycle();
        }
    }
    
    async handleRandomCelebSelection() {
        this.updateStatus('Tìm celeb ngẫu nhiên tiếp theo...');
        this.showNotification('Hoàn thành! Đang tìm celeb ngẫu nhiên...', 'info');
        
        try {
            await this.step1_Reset();
            const availableCelebs = await this.scanCelebs(false);
            
            if (availableCelebs.length > 0) {
                const randomCeleb = this.getRandomCeleb(availableCelebs);
                this.currentCeleb = randomCeleb.name;
                await this.saveState();
                
                this.updateStatus(`Bắt đầu chu kỳ cho ${this.currentCeleb}`);
                this.showNotification(`Chu kỳ tiếp theo: ${this.currentCeleb}`, 'success');
                
                setTimeout(() => this.runCycle(), 3000);
            } else {
                this.handleNoMoreCelebs();
            }
        } catch (error) {
            this.handleCelebSelectionError();
        }
    }
    
    handleNoMoreCelebs() {
        this.updateStatus('Hoàn thành tất cả! Không còn celeb để thêm. Tiếp tục chờ timer...');
        this.showNotification('Hoàn thành tất cả! Không còn celeb để thêm. Tiếp tục chạy...', 'success');
        
        if (!this.timerEnabled) {
            this.updateStatus('Không có timer. Dừng automation.');
            this.stopAutomation();
        } else {
            setTimeout(() => {
                if (this.isRunning) {
                    this.updateStatus('Tìm kiếm celeb mới...');
                    this.runCycle();
                }
            }, 10000);
        }
    }
    
    handleCelebSelectionError() {
        this.showNotification('Lỗi khi quét celeb mới, tiếp tục chạy...', 'error');
        this.scheduleRetry();
    }
    
    scheduleNextCycle() {
        this.updateStatus('Hoàn thành chu kỳ. Tiếp tục chạy...');
        this.showNotification('Hoàn thành. Tiếp tục chu kỳ...', 'info');
        
        setTimeout(() => {
            if (this.isRunning) {
                this.runCycle();
            }
        }, 3000);
    }
    
    // Optimized step methods with better error handling
    async step0_Navigate() {
        this.updateStatus('Điều hướng đến trang Celebrity...');
        
        if (window.location.href.includes('celebrity.html')) {
            return; // Already on the correct page
        }
        
        const celebrityLink = this.findCelebrityLink();
        if (!celebrityLink) {
            throw new Error('Không tìm thấy link trang Celebrity');
        }
        
        celebrityLink.click();
        await this.wait(3000);
    }
    
    async step1_Reset() {
        this.updateStatus('Tìm và nhấn nút reset...');
        
        const resetButton = this.findElementByText('button', ['Reset', 'Đặt lại']);
        if (resetButton) {
            resetButton.click();
            await this.wait(1500);
            this.closeModals();
        } else {
            this.updateStatus('Không tìm thấy nút reset, bỏ qua.');
        }
    }
    
    async step3_AddFriend() {
        this.updateStatus(`Tìm ${this.currentCeleb}...`);
        
        const celebElement = this.findCelebrityContainer(this.currentCeleb);
        if (!celebElement) {
            throw new Error(`Không tìm thấy ${this.currentCeleb} trong danh sách.`);
        }
        
        const actionButton = this.findElementByTextInElement(celebElement, 'button', ['Thêm bạn bè']);
        if (!actionButton) {
            const friendButton = this.findElementByTextInElement(celebElement, 'button', ['Bạn bè']);
            return !friendButton; // Return false if already friend
        }
        
        this.updateStatus(`Gửi yêu cầu kết bạn đến ${this.currentCeleb}...`);
        actionButton.click();
        await this.wait(2000);
        
        return true;
    }
    
    async step4_StartProcess() {
        this.updateStatus('Tìm và nhấn "Bắt đầu" trong popup...');
        await this.wait(1000);
        
        const startButton = this.findElementByText('button', ['Bắt đầu', 'Start']);
        if (!startButton) {
            this.showNotification('Không tìm thấy nút "Bắt đầu"', 'warning');
            return;
        }
        
        startButton.click();
        await this.wait(1000);
        this.showNotification('Đã bắt đầu tiến trình', 'success');
        
        // Start timer only after successful "Start" button click
        if (this.timerEnabled && this.timerEndTime === 0) {
            this.timerEndTime = Date.now() + this.timerDuration * 60 * 1000;
            this.startTimerUpdate();
            this.saveState();
            this.updateStatus('Đang chạy... Timer đã bắt đầu đếm ngược.');
        }
    }
    
    // Helper methods
    findCelebrityLink() {
        return this.findElement('a, .nav-item, .menu-item', link => 
            (link.textContent.includes('Celebrity') || link.href?.includes('celebrity'))
        );
    }
    
    findCelebrityContainer(name) {
        return this.findElement('div.profile', card => {
            const nameElement = card.querySelector('div.profile-name');
            return nameElement && nameElement.textContent.trim() === name;
        });
    }
    
    findElementByText(tag, texts) {
        return this.findElement(tag, element => 
            texts.some(text => element.textContent.includes(text))
        );
    }
    
    findElementByTextInElement(parentElement, tag, texts) {
        return this.findElement(tag, element => 
            texts.some(text => element.textContent.includes(text)), 
            parentElement
        );
    }
    
    closeModals() {
        const closeButton = this.findElementByText('button', ['Đóng', 'Close', 'OK', 'Xác nhận']);
        if (closeButton) {
            closeButton.click();
        }
    }
    
    async wait(ms) {
        return new Promise(resolve => {
            this.stepTimeout = setTimeout(resolve, ms);
        });
    }
    
    // State management with error handling
    async saveState() {
        try {
            const state = {
                isRunning: this.isRunning,
                selectedCeleb: this.currentCeleb,
                autoRandom: this.autoRandom,
                currentStep: this.currentStep,
                timerEnabled: this.timerEnabled,
                timerDuration: this.timerDuration,
                timerEndTime: this.timerEndTime,
                initialCeleb: this.initialCeleb
            };
            
            await chrome.storage.local.set({ automationState: state });
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }
    
    async loadState() {
        try {
            const result = await chrome.storage.local.get(['automationState']);
            if (result.automationState) {
                const state = result.automationState;
                this.isRunning = state.isRunning || false;
                this.currentCeleb = state.selectedCeleb || '';
                this.autoRandom = state.autoRandom !== undefined ? state.autoRandom : true;
                this.currentStep = state.currentStep || '';
                this.timerEnabled = state.timerEnabled || false;
                this.timerDuration = state.timerDuration || 15;
                this.timerEndTime = state.timerEndTime || 0;
                this.initialCeleb = state.initialCeleb || '';
            }
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }
    
    // Communication and UI methods
    updateStatus(status) {
        this.currentStep = status;
        this.sendToPopup('STATUS_UPDATE', { status });
        console.log('Status:', status);
    }
    
    sendToPopup(type, data) {
        try {
            chrome.runtime.sendMessage({ type, ...data });
        } catch (error) {
            // Ignore errors when popup is not open
        }
    }
    
    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.locket-helper-notification')
            .forEach(n => n.remove());
        
        const notification = this.createNotificationElement(message, type);
        this.addNotificationStyles();
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    createNotificationElement(message, type) {
        const notification = document.createElement('div');
        notification.className = `locket-helper-notification locket-notification-${type}`;
        notification.innerHTML = `
            <span class="locket-notification-icon">${this.getNotificationIcon(type)}</span> 
            ${message}
        `;
        return notification;
    }
    
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
    
    addNotificationStyles() {
        if (document.getElementById('locket-helper-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'locket-helper-styles';
        styles.textContent = `
            .locket-helper-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                padding: 15px 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 10px;
                font-family: sans-serif;
                font-size: 14px;
                animation: locketSlideIn 0.3s ease-out;
                max-width: 300px;
                word-wrap: break-word;
            }
            
            .locket-notification-icon {
                font-size: 18px;
                flex-shrink: 0;
            }
            
            .locket-notification-success {
                border-left: 4px solid #4CAF50;
            }
            
            .locket-notification-error {
                border-left: 4px solid #f44336;
            }
            
            .locket-notification-warning {
                border-left: 4px solid #ff9800;
            }
            
            .locket-notification-info {
                border-left: 4px solid #2196F3;
            }
            
            @keyframes locketSlideIn {
                from { 
                    transform: translateX(100%); 
                    opacity: 0; 
                }
                to { 
                    transform: translateX(0); 
                    opacity: 1; 
                }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Initialize with error handling
try {
    new LocketCelebHelper();
} catch (error) {
    console.error('Failed to initialize LocketCelebHelper:', error);
}