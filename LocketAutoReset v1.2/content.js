// Content script for Locket Celeb Auto Helper
class LocketCelebHelper {
    constructor() {
        this.isRunning = false;
        this.currentCeleb = '';
        this.cycleTime = 5;
        this.autoRandom = true;
        this.currentStep = '';
        this.stepTimeout = null;
        this.cycleInterval = null;
        
        this.init();
    }
    
    async init() {
        console.log('Locket Celeb Helper initialized v1.3');
        
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message);
            return true;
        });
        
        await this.loadState();
        
        if (this.isRunning) {
            this.showNotification('Tiếp tục chu kỳ tự động...', 'info');
            this.resumeAutomation();
        }
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'SCAN_CELEBS':
                this.scanCelebs(true);
                break;
            case 'START_AUTOMATION':
                this.startAutomation(message.celeb, message.time, message.autoRandom);
                break;
            case 'STOP_AUTOMATION':
                this.stopAutomation();
                break;
        }
    }
    
    // =================================================================
    // NEW ROBUST SCANNING LOGIC - BUTTON FIRST APPROACH
    // =================================================================
    scanCelebs(isManualScan = false) {
        return new Promise(async (resolve) => {
            if (isManualScan) {
                // Don't show notification on continuous scans, only on the first one.
                // this.showNotification('Đang quét danh sách celeb...', 'info');
            }
            await this.wait(100);

            const availableCelebs = [];
            const uniqueNames = new Set();

            // Find all buttons that contain "Thêm bạn bè"
            const addFriendButtons = Array.from(document.querySelectorAll('button'))
                                          .filter(btn => btn.textContent.includes('Thêm bạn bè'));

            for (const button of addFriendButtons) {
                // Traverse up to find a logical "row" container for a single celebrity
                let container = button.closest('li');
                if (!container) {
                    // Fallback for layouts that don't use <li>, e.g. <div> with an image inside
                    container = button.closest('div:has(img)');
                }
                 if (!container) {
                    // A more general fallback
                    container = button.parentElement.parentElement;
                }

                if (container) {
                    // Clone the container to avoid affecting the live page
                    const clone = container.cloneNode(true);
                    
                    // Remove the button from the clone to isolate other text
                    const buttonInClone = clone.querySelector('button');
                    if (buttonInClone) buttonInClone.remove();

                    // Extract text, filter out junk, and assume the longest remaining text is the name
                    const texts = clone.textContent.split('\n')
                                    .map(t => t.trim())
                                    .filter(t => t.length > 1);
                    
                    if (texts.length > 0) {
                        const name = texts.sort((a, b) => b.length - a.length)[0]; // Get the longest string
                        if (name && !uniqueNames.has(name)) {
                            availableCelebs.push({ name, status: 'Thêm bạn bè' });
                            uniqueNames.add(name);
                        }
                    }
                }
            }
            
            if (isManualScan) {
                this.sendToPopup('CELEBS_FOUND', { celebs: availableCelebs });
                // Only show notification if it's the first manual scan from the popup
                const isFirstScan = !document.body.dataset.firstScanDone;
                if (isFirstScan) {
                    if (availableCelebs.length > 0) {
                        this.showNotification(`Tìm thấy ${availableCelebs.length} celeb có thể kết bạn`, 'success');
                    } else {
                        this.showNotification('Chưa tìm thấy celeb nào, đang tiếp tục quét...', 'warning');
                    }
                    document.body.dataset.firstScanDone = 'true';
                }
            }
            
            resolve(availableCelebs);
        });
    }
    // =================================================================
    
    async startAutomation(celeb, time, autoRandom) {
        this.isRunning = true;
        this.currentCeleb = celeb;
        this.cycleTime = time;
        this.autoRandom = autoRandom;
        
        await this.saveState();
        
        this.updateStatus(`Bắt đầu chu kỳ cho ${celeb} - ${time} phút`);
        this.showNotification(`Bắt đầu chu kỳ cho ${celeb} - ${time} phút`, 'success');
        
        this.runCycle();
    }
    
    resumeAutomation() {
        if (this.isRunning && this.currentCeleb) {
            this.runCycle();
        }
    }
    
    async runCycle() {
        if (!this.isRunning) return;
        
        try {
            await this.step0_Navigate();
            await this.step1_Reset();
            
            const shouldContinue = await this.step3_AddFriend();
            if (!shouldContinue) {
                this.showNotification(`${this.currentCeleb} đã là bạn bè hoặc không tìm thấy.`, 'info');
                await this.step7_Restart();
                return;
            }
            
            await this.step4_StartProcess();
            await this.step5_Wait();
            await this.step6_StopAndClose();
            await this.step7_Restart();
            
        } catch (error) {
            console.error('Automation error:', error);
            this.showNotification(`Lỗi: ${error.message}`, 'error');
            if (this.isRunning) {
                this.updateStatus('Gặp lỗi, thử lại sau 10 giây...');
                setTimeout(() => this.runCycle(), 10000);
            }
        }
    }
    
    async step0_Navigate() {
        this.updateStatus('Điều hướng đến trang Celebrity...');
        if (!window.location.href.includes('celebrity.html')) {
            const celebrityLink = this.findCelebrityLink();
            if (celebrityLink) {
                celebrityLink.click();
                await this.wait(3000);
            } else {
                 throw new Error('Không tìm thấy link trang Celebrity');
            }
        }
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
             if (friendButton) return false; // Already friends
             throw new Error(`Không có nút hành động cho ${this.currentCeleb}.`);
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
        if (startButton) {
            startButton.click();
            await this.wait(1000);
            this.showNotification('Đã bắt đầu tiến trình', 'success');
        } else {
            this.showNotification('Không tìm thấy nút "Bắt đầu"', 'warning');
        }
    }
    
    async step5_Wait() {
        const waitTime = this.cycleTime * 60 * 1000;
        this.updateStatus(`Đang chờ ${this.cycleTime} phút...`);
        
        let remainingTime = this.cycleTime * 60;
        this.cycleInterval = setInterval(() => {
            if (!this.isRunning || remainingTime <= 0) {
                clearInterval(this.cycleInterval);
                return;
            }
            remainingTime--;
            const minutes = Math.floor(remainingTime / 60);
            const seconds = remainingTime % 60;
            this.updateStatus(`Còn lại: ${minutes}:${seconds.toString().padStart(2, '0')}`);
        }, 1000);
        
        await this.wait(waitTime);
    }
    
    async step6_StopAndClose() {
        this.updateStatus('Dừng tiến trình...');
        const stopButton = this.findElementByText('button', ['Dừng tiến trình', 'Dừng', 'Stop']);
        if (stopButton) {
            stopButton.click();
            await this.wait(1500);
            const closeButton = this.findElementByText('button', ['Đóng', 'Close']);
            if (closeButton) {
                closeButton.click();
                await this.wait(1000);
            }
        }
    }
    
    async step7_Restart() {
        this.updateStatus('Hoàn thành chu kỳ!');
        
        if (this.isRunning && this.autoRandom) {
            this.updateStatus('Tìm celeb ngẫu nhiên tiếp theo...');
            this.showNotification('Hoàn thành! Đang tìm celeb ngẫu nhiên...', 'info');
            
            try {
                const availableCelebs = await this.scanCelebs(false);
                if (availableCelebs.length > 0) {
                    const randomCeleb = availableCelebs[Math.floor(Math.random() * availableCelebs.length)];
                    this.currentCeleb = randomCeleb.name;
                    await this.saveState();
                    
                    this.updateStatus(`Bắt đầu chu kỳ cho ${this.currentCeleb} - ${this.cycleTime} phút`);
                    this.showNotification(`Chu kỳ tiếp theo: ${this.currentCeleb}`, 'success');
                    
                    setTimeout(() => this.runCycle(), 3000);
                } else {
                    this.updateStatus('Hoàn thành tất cả! Không còn celeb để thêm.');
                    this.showNotification('Hoàn thành tất cả! Không còn celeb để thêm.', 'success');
                    this.stopAutomation();
                }
            } catch (error) {
                this.showNotification('Lỗi khi quét celeb mới, dừng lại.', 'error');
                this.stopAutomation();
            }

        } else {
            this.showNotification('Chu kỳ đã hoàn thành. Vui lòng chọn celeb mới.', 'info');
            this.stopAutomation();
        }
    }
    
    // Helper functions
    findCelebrityLink() {
        const links = document.querySelectorAll('a, .nav-item, .menu-item');
        for (const link of links) {
            if ((link.textContent.includes('Celebrity') || link.href?.includes('celebrity')) && link.offsetParent !== null) {
                return link;
            }
        }
        return null;
    }
    
    findCelebrityContainer(name) {
        const elements = document.querySelectorAll('*');
        for (const element of elements) {
            if (element.textContent.includes(name)) {
                const container = element.closest('div, li');
                 if (container && container.querySelector('button')) {
                    return container;
                }
            }
        }
        return null;
    }
    
    findElementByText(tag, texts) {
        const elements = document.querySelectorAll(tag);
        for (const element of elements) {
            for (const text of texts) {
                if (element.textContent.includes(text) && element.offsetParent !== null) {
                    return element;
                }
            }
        }
        return null;
    }
    
    findElementByTextInElement(parentElement, tag, texts) {
        const elements = parentElement.querySelectorAll(tag);
        for (const element of elements) {
            for (const text of texts) {
                if (element.textContent.includes(text) && element.offsetParent !== null) {
                    return element;
                }
            }
        }
        return null;
    }

    closeModals() {
        const closeButton = this.findElementByText('button', ['Đóng', 'Close', 'OK', 'Xác nhận']);
        if (closeButton) {
            closeButton.click();
        }
    }
    
    stopAutomation() {
        this.isRunning = false;
        
        if (this.stepTimeout) clearTimeout(this.stepTimeout);
        if (this.cycleInterval) clearInterval(this.cycleInterval);
        
        this.saveState();
        this.showNotification('Đã dừng chu kỳ tự động', 'warning');
        this.updateStatus('Đã dừng.');
    }
    
    async wait(ms) {
        return new Promise(resolve => {
            this.stepTimeout = setTimeout(resolve, ms);
        });
    }
    
    updateStatus(status) {
        this.currentStep = status;
        this.sendToPopup('STATUS_UPDATE', { status });
        console.log('Status:', status);
    }
    
    sendToPopup(type, data) {
        try {
            chrome.runtime.sendMessage({ type, ...data });
        } catch (error) {
            // Popup might be closed, this is normal
        }
    }
    
    showNotification(message, type = 'info') {
        const existingNotifications = document.querySelectorAll('.locket-helper-notification');
        existingNotifications.forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `locket-helper-notification locket-notification-${type}`;
        notification.innerHTML = `<span class="locket-notification-icon">${this.getNotificationIcon(type)}</span> ${message}`;
        
        this.addNotificationStyles();
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    getNotificationIcon(type) {
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        return icons[type] || icons.info;
    }
    
    addNotificationStyles() {
        if (document.getElementById('locket-helper-styles')) return;
        const styles = document.createElement('style');
        styles.id = 'locket-helper-styles';
        styles.textContent = `
            .locket-helper-notification {
                position: fixed; top: 20px; right: 20px; z-index: 10000;
                padding: 15px 20px; background: white; border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15); display: flex;
                align-items: center; gap: 10px; font-family: sans-serif;
                font-size: 14px; animation: locketSlideIn 0.3s ease-out;
            }
            .locket-notification-icon { font-size: 18px; }
            .locket-notification-success { border-left: 4px solid #4CAF50; }
            .locket-notification-error { border-left: 4px solid #f44336; }
            .locket-notification-warning { border-left: 4px solid #ff9800; }
            .locket-notification-info { border-left: 4px solid #2196F3; }
            @keyframes locketSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        `;
        document.head.appendChild(styles);
    }
    
    async saveState() {
        try {
            await chrome.storage.local.set({
                automationState: {
                    isRunning: this.isRunning,
                    selectedCeleb: this.currentCeleb,
                    cycleTime: this.cycleTime,
                    autoRandom: this.autoRandom,
                    currentStep: this.currentStep
                }
            });
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
                this.cycleTime = state.cycleTime || 5;
                this.autoRandom = state.autoRandom !== undefined ? state.autoRandom : true;
                this.currentStep = state.currentStep || '';
            }
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }
}

new LocketCelebHelper();