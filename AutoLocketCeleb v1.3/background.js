// Auto Locket Celeb v1.3 - Background Service

class BackgroundService {
    constructor() {
        this.init();
    }
    
    /**
     * Khởi tạo các trình lắng nghe sự kiện chính của service worker.
     */
    init() {
        // Lắng nghe sự kiện cài đặt hoặc cập nhật tiện ích
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.onInstall();
            } else if (details.reason === 'update') {
                this.onUpdate();
            }
        });
        
        // Lắng nghe sự kiện cập nhật tab để tiếp tục tự động hóa nếu cần
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.url.includes('locket.binhake.dev')) {
                this.checkAndResumeAutomation(tabId);
            }
        });
        
        // Giữ cho service worker luôn hoạt động
        this.keepAlive();
    }
    
    /**
     * Xử lý khi tiện ích được cài đặt lần đầu.
     */
    onInstall() {
        console.log('Auto Locket Celeb đã được cài đặt.');
        
        // Thiết lập trạng thái mặc định ban đầu
        chrome.storage.local.set({
            automationState: {
                isRunning: false,
                selectedCeleb: '',
                autoRandom: true,
                currentStep: '',
                timerEnabled: false,
                timerDuration: 15,
                timerEndTime: 0,
                initialCeleb: ''
            }
        });
        
        // Mở trang chào mừng
        chrome.tabs.create({
            url: 'https://locket.binhake.dev/'
        });
    }
    
    /**
     * Xử lý khi tiện ích được cập nhật.
     */
    onUpdate() {
        console.log('Auto Locket Celeb đã được cập nhật.');
    }
    
    /**
     * Kiểm tra trạng thái tự động hóa và tiêm content script nếu cần.
     * @param {number} tabId - ID của tab vừa được cập nhật.
     */
    async checkAndResumeAutomation(tabId) {
        try {
            const result = await chrome.storage.local.get(['automationState']);
            // Chỉ tiêm lại content script nếu quá trình tự động hóa đang chạy.
            // Content script sẽ tự xử lý việc tiếp tục dựa trên trạng thái đã lưu.
            if (result.automationState && result.automationState.isRunning) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                });
            }
        } catch (error) {
            console.error('Lỗi khi kiểm tra trạng thái tự động hóa:', error);
        }
    }
    
    /**
     * Giữ cho service worker hoạt động bằng cách gọi một API của Chrome định kỳ.
     * Điều này cần thiết cho Manifest V3 để duy trì các tác vụ nền.
     */
    keepAlive() {
        setInterval(() => {
            chrome.runtime.getPlatformInfo();
        }, 20000); // 20 giây một lần
    }
}

// Khởi tạo dịch vụ nền
new BackgroundService();