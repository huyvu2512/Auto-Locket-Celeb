class LocketCelebHelper {
    constructor() {
        this.isRunning = false;
        this.currentCeleb = '';
        this.autoRandom = true;
        this.currentStep = '';
        this.stepTimeout = null;
        this.timerEnabled = false;
        this.timerDuration = 0;
        this.timerId = null;
        this.timerEndTime = 0;
        this.initialCeleb = '';
        this.logObserver = null;
        this.connectionLostCounter = 0;
        this.CONNECTION_LOST_THRESHOLD = 3;
        this.TARGET_ERROR_MESSAGE = 'The connection was suddenly lost'; 
        this.TARGET_SUCCESS_MESSAGE = '1 slot'; 

        this.init();
    }
    
    async init() {
        console.log('Auto Locket Celeb v1.2 - Final Initialized');
        this.startGeneralObserver();
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message);
        });
        await this.loadState();
        if (this.isRunning) {
            this.showNotification('Tiếp tục chu kỳ tự động...', 'info');
            this.resumeAutomation();
        }
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'SCAN_CELEBS': this.scanCelebs(true); break;
            case 'START_AUTOMATION':
                this.startAutomation(message.celeb, message.autoRandom, message.timerEnabled, message.timerDuration);
                break;
            case 'STOP_AUTOMATION': this.stopAutomation(); break;
            case 'RELOAD_PAGE':
                this.updateStatus('Đang tải lại...');
                this.showNotification('Đang tải lại trang theo yêu cầu...', 'info');
                setTimeout(() => window.location.reload(), 500);
                break;
        }
    }

    async startAutomation(celeb, autoRandom, timerEnabled, timerDuration) {
        this.isRunning = true;
        this.currentCeleb = celeb;
        this.initialCeleb = celeb;
        this.autoRandom = autoRandom;
        this.timerEnabled = timerEnabled;
        this.timerDuration = timerDuration;
        if (this.timerEnabled) {
            this.timerEndTime = Date.now() + this.timerDuration * 60 * 1000;
        }
        this.updateStatus(`Bắt đầu chu kỳ cho ${celeb}`);
        this.showNotification(`Bắt đầu chu kỳ cho ${celeb}`, 'success');
        await this.saveState();
        this.runCycle();
    }
    
    resumeAutomation() {
        if (this.isRunning) {
            let isTimerRestart = this.timerEnabled && this.timerEndTime > 0 && (Date.now() > this.timerEndTime);
            if (isTimerRestart) {
                this.currentCeleb = this.initialCeleb;
                this.timerEndTime = Date.now() + this.timerDuration * 60 * 1000;
                this.updateStatus(`Bắt đầu chu kỳ cho ${this.currentCeleb} (Hẹn giờ)`);
                this.saveState();
            }
            this.runCycle();
        }
    }

    startTimer() {
        if (this.timerId) clearTimeout(this.timerId);
        if (!this.isRunning || !this.timerEnabled || this.timerEndTime === 0) return;

        const remainingTime = this.timerEndTime - Date.now();
        this.sendToPopup('TIMER_TICK', { endTime: this.timerEndTime });

        if (remainingTime <= 0) {
            this.handleTimerEnd();
            return;
        }
        
        this.timerId = setTimeout(() => { this.handleTimerEnd(); }, remainingTime);
    }

    handleTimerEnd() {
        if (!this.isRunning) return;
        this.updateStatus('Hết giờ! Đang tải lại...');
        this.showNotification('Hết giờ! Đang tải lại trang để bắt đầu lại...', 'warning');
        setTimeout(() => window.location.reload(), 1500);
    }
    
    async runCycle() {
        if (!this.isRunning) return;
        try {
            this.startLogObserver();
            await this.step0_Navigate();
            await this.step1_Reset();
            const shouldContinue = await this.step3_AddFriend();

            if (!shouldContinue) {
                if (this.timerEnabled) {
                    this.updateStatus(`${this.currentCeleb} đã là bạn. Chờ hẹn giờ...`);
                    this.startTimer();
                } else {
                    this.showNotification(`${this.currentCeleb} đã là bạn bè hoặc không tìm thấy. Dừng chu kỳ.`, 'info');
                    this.stopAutomation();
                }
                return;
            }

            await this.step4_StartProcess();
            this.updateStatus('Đang chạy... Giám sát nhật ký lỗi và thành công.');
            this.startTimer();

        } catch (error) {
            console.error('Automation error:', error);
            this.showNotification(`Lỗi: ${error.message}`, 'error');
            if (this.isRunning) {
                this.updateStatus('Gặp lỗi, thử lại sau 10 giây...');
                setTimeout(() => this.runCycle(), 10000);
            }
        }
    }

    stopAutomation() {
        this.isRunning = false;
        if (this.stepTimeout) clearTimeout(this.stepTimeout);
        if (this.logObserver) this.logObserver.disconnect();
        if (this.timerId) clearTimeout(this.timerId);
        this.timerEnabled = false;
        this.timerEndTime = 0;
        this.saveState();
        this.updateStatus('Đã dừng. Đang tải lại...');
        this.showNotification('Đã dừng chu kỳ tự động. Đang tải lại trang...', 'warning');
        setTimeout(() => { window.location.reload(); }, 1500);
    }
    
    async saveState() { try { await chrome.storage.local.set({ automationState: { isRunning: this.isRunning, selectedCeleb: this.currentCeleb, autoRandom: this.autoRandom, currentStep: this.currentStep, timerEnabled: this.timerEnabled, timerDuration: this.timerDuration, timerEndTime: this.timerEndTime, initialCeleb: this.initialCeleb } }); } catch (error) { console.error('Error saving state:', error); } }
    async loadState() { try { const result = await chrome.storage.local.get(['automationState']); if (result.automationState) { const state = result.automationState; this.isRunning = state.isRunning || false; this.currentCeleb = state.selectedCeleb || ''; this.autoRandom = state.autoRandom !== undefined ? state.autoRandom : true; this.currentStep = state.currentStep || ''; this.timerEnabled = state.timerEnabled || false; this.timerDuration = state.timerDuration || 15; this.timerEndTime = state.timerEndTime || 0; this.initialCeleb = state.initialCeleb || ''; } } catch (error) { console.error('Error loading state:', error); } }
    startGeneralObserver() { const generalObserver = new MutationObserver((mutations, observer) => { const notificationTitle = Array.from(document.querySelectorAll('h1, h2, h3, div')).find(el => el.textContent.includes('THÔNG BÁO QUAN TRỌNG')); if (notificationTitle) { const popupContainer = notificationTitle.closest('div[role="dialog"], .modal, body > div:not([id])'); if (popupContainer) { const closeButton = Array.from(popupContainer.querySelectorAll('button')).find(btn => btn.textContent.trim().toLowerCase() === 'x' || btn.getAttribute('aria-label')?.toLowerCase().includes('close') || btn.getAttribute('aria-label')?.toLowerCase().includes('đóng')); if (closeButton) { closeButton.click(); } } } const xemThemButton = this.findElementByText('button', ['Xem thêm']); if (xemThemButton) { xemThemButton.click(); } }); generalObserver.observe(document.body, { childList: true, subtree: true }); }
    scanCelebs(isManualScan = false) { return new Promise(async (resolve) => { await this.wait(100); const availableCelebs = []; const profileCards = document.querySelectorAll('div.profile'); for (const card of profileCards) { const nameElement = card.querySelector('div.profile-name'); const addButton = card.querySelector('button.showMoreBtn'); if (nameElement && addButton && addButton.textContent.includes('Thêm bạn bè')) { const name = nameElement.textContent.trim(); if (name) { availableCelebs.push({ name: name, status: 'Thêm bạn bè' }); } } } if (isManualScan) { this.sendToPopup('CELEBS_FOUND', { celebs: availableCelebs }); } resolve(availableCelebs); }); }
    startLogObserver() { if (this.logObserver) { this.logObserver.disconnect(); } this.connectionLostCounter = 0; const logContainer = document.querySelector('.log-container'); if (!logContainer) { this.updateStatus('⚠️ Không tìm thấy khu vực nhật ký để giám sát.'); return; } this.logObserver = new MutationObserver((mutations) => { for (const mutation of mutations) { if (mutation.type === 'childList' && mutation.addedNodes.length > 0) { mutation.addedNodes.forEach(node => { if (!node.textContent) return; if (node.textContent.includes(this.TARGET_ERROR_MESSAGE)) { this.connectionLostCounter++; this.updateStatus(`Mất kết nối lần ${this.connectionLostCounter}/${this.CONNECTION_LOST_THRESHOLD}`); if (this.connectionLostCounter >= this.CONNECTION_LOST_THRESHOLD) { this.handleConnectionLost(); } } else if (node.textContent.includes(this.TARGET_SUCCESS_MESSAGE)) { this.handleSuccessAndRestart(); } }); } } }); this.logObserver.observe(logContainer, { childList: true, subtree: true }); this.updateStatus('Đã bật giám sát nhật ký lỗi và thành công.'); }
    handleConnectionLost() { if (!this.isRunning) return; this.updateStatus(`Mất kết nối quá ${this.CONNECTION_LOST_THRESHOLD} lần. Đang tải lại trang...`); this.showNotification(`Mất kết nối nhiều lần. Tải lại trang sau 3 giây...`, 'error'); if (this.logObserver) { this.logObserver.disconnect(); } setTimeout(() => { window.location.reload(); }, 3000); }
    async handleSuccessAndRestart() { this.updateStatus('Phát hiện "1 slot"! Bắt đầu chu kỳ mới.'); if (this.isRunning && this.autoRandom) { this.updateStatus('Tìm celeb ngẫu nhiên tiếp theo...'); this.showNotification('Hoàn thành! Đang tìm celeb ngẫu nhiên...', 'info'); try { await this.step1_Reset(); const availableCelebs = await this.scanCelebs(false); if (availableCelebs.length > 0) { const randomCeleb = availableCelebs[Math.floor(Math.random() * availableCelebs.length)]; this.currentCeleb = randomCeleb.name; await this.saveState(); this.updateStatus(`Bắt đầu chu kỳ cho ${this.currentCeleb}`); this.showNotification(`Chu kỳ tiếp theo: ${this.currentCeleb}`, 'success'); setTimeout(() => this.runCycle(), 3000); } else { this.updateStatus('Hoàn thành tất cả! Không còn celeb để thêm.'); this.showNotification('Hoàn thành tất cả! Không còn celeb để thêm.', 'success'); this.stopAutomation(); } } catch (error) { this.showNotification('Lỗi khi quét celeb mới, dừng lại.', 'error'); this.stopAutomation(); } } else if (this.isRunning && !this.autoRandom && this.timerEnabled) { this.updateStatus('Hoàn thành chu kỳ. Đang chờ hẹn giờ để reset...'); this.showNotification('Hoàn thành. Chờ hẹn giờ để lặp lại...', 'info'); } else { this.showNotification('Chu kỳ đã hoàn thành. Dừng lại.', 'info'); this.stopAutomation(); } }
    async step0_Navigate() { this.updateStatus('Điều hướng đến trang Celebrity...'); if (!window.location.href.includes('celebrity.html')) { const celebrityLink = this.findCelebrityLink(); if (celebrityLink) { celebrityLink.click(); await this.wait(3000); } else { throw new Error('Không tìm thấy link trang Celebrity'); } } }
    async step1_Reset() { this.updateStatus('Tìm và nhấn nút reset...'); const resetButton = this.findElementByText('button', ['Reset', 'Đặt lại']); if (resetButton) { resetButton.click(); await this.wait(1500); this.closeModals(); } else { this.updateStatus('Không tìm thấy nút reset, bỏ qua.'); } }
    async step3_AddFriend() { this.updateStatus(`Tìm ${this.currentCeleb}...`); const celebElement = this.findCelebrityContainer(this.currentCeleb); if (!celebElement) { throw new Error(`Không tìm thấy ${this.currentCeleb} trong danh sách.`); } const actionButton = this.findElementByTextInElement(celebElement, 'button', ['Thêm bạn bè']); if (!actionButton) { const friendButton = this.findElementByTextInElement(celebElement, 'button', ['Bạn bè']); if (friendButton) return false; throw new Error(`Không có nút hành động cho ${this.currentCeleb}.`); } this.updateStatus(`Gửi yêu cầu kết bạn đến ${this.currentCeleb}...`); actionButton.click(); await this.wait(2000); return true; }
    async step4_StartProcess() { this.updateStatus('Tìm và nhấn "Bắt đầu" trong popup...'); await this.wait(1000); const startButton = this.findElementByText('button', ['Bắt đầu', 'Start']); if (startButton) { startButton.click(); await this.wait(1000); this.showNotification('Đã bắt đầu tiến trình', 'success'); } else { this.showNotification('Không tìm thấy nút "Bắt đầu"', 'warning'); } }
    findCelebrityLink() { const links = document.querySelectorAll('a, .nav-item, .menu-item'); for (const link of links) { if ((link.textContent.includes('Celebrity') || link.href?.includes('celebrity')) && link.offsetParent !== null) return link; } return null; }
    findCelebrityContainer(name) { const allProfileCards = document.querySelectorAll('div.profile'); for (const card of allProfileCards) { const nameElement = card.querySelector('div.profile-name'); if (nameElement && nameElement.textContent.trim() === name) return card; } return null; }
    findElementByText(tag, texts) { const elements = document.querySelectorAll(tag); for (const element of elements) { for (const text of texts) { if (element.textContent.includes(text) && element.offsetParent !== null) return element; } } return null; }
    findElementByTextInElement(parentElement, tag, texts) { const elements = parentElement.querySelectorAll(tag); for (const element of elements) { for (const text of texts) { if (element.textContent.includes(text) && element.offsetParent !== null) return element; } } return null; }
    closeModals() { const closeButton = this.findElementByText('button', ['Đóng', 'Close', 'OK', 'Xác nhận']); if (closeButton) { closeButton.click(); } }
    async wait(ms) { return new Promise(resolve => { this.stepTimeout = setTimeout(resolve, ms); }); }
    updateStatus(status) { this.currentStep = status; this.sendToPopup('STATUS_UPDATE', { status }); console.log('Status:', status); }
    sendToPopup(type, data) { try { chrome.runtime.sendMessage({ type, ...data }); } catch (error) {} }
    showNotification(message, type = 'info') { const existingNotifications = document.querySelectorAll('.locket-helper-notification'); existingNotifications.forEach(n => n.remove()); const notification = document.createElement('div'); notification.className = `locket-helper-notification locket-notification-${type}`; notification.innerHTML = `<span class="locket-notification-icon">${this.getNotificationIcon(type)}</span> ${message}`; this.addNotificationStyles(); document.body.appendChild(notification); setTimeout(() => { if (notification.parentElement) { notification.remove(); } }, 5000); }
    getNotificationIcon(type) { const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }; return icons[type] || icons.info; }
    addNotificationStyles() { if (document.getElementById('locket-helper-styles')) return; const styles = document.createElement('style'); styles.id = 'locket-helper-styles'; styles.textContent = ` .locket-helper-notification { position: fixed; top: 20px; right: 20px; z-index: 10000; padding: 15px 20px; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 10px; font-family: sans-serif; font-size: 14px; animation: locketSlideIn 0.3s ease-out; } .locket-notification-icon { font-size: 18px; } .locket-notification-success { border-left: 4px solid #4CAF50; } .locket-notification-error { border-left: 4px solid #f44336; } .locket-notification-warning { border-left: 4px solid #ff9800; } .locket-notification-info { border-left: 4px solid #2196F3; } @keyframes locketSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } `; document.head.appendChild(styles); }
}

new LocketCelebHelper();