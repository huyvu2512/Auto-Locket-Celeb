// Background script for Locket Celeb Auto Helper
class BackgroundService {
    constructor() {
        this.init();
    }
    
    init() {
        // Listen for installation
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.onInstall();
            } else if (details.reason === 'update') {
                this.onUpdate();
            }
        });
        
        // Listen for tab updates to STOP automation on reload
        chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
            // Chúng ta chỉ quan tâm khi trang chính đã tải xong
            if (changeInfo.status === 'complete' && tab.url && tab.url.includes('locket.binhake.dev')) {
                try {
                    const result = await chrome.storage.local.get(['automationState']);
                    // Nếu quá trình tự động đang chạy, hãy dừng nó lại.
                    if (result.automationState && result.automationState.isRunning) {
                        const newState = { ...result.automationState, isRunning: false, currentStep: '' };
                        await chrome.storage.local.set({ automationState: newState });
                        console.log('Auto Locket Celeb: Automation stopped due to page reload.');
                    }
                } catch (error) {
                    console.error('Auto Locket Celeb: Error stopping automation on reload:', error);
                }
            }
        });
        
        // Listen for messages from content script and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // This script primarily handles installation and tab updates.
            // Message passing is handled directly between popup and content script.
        });
        
        // Keep service worker alive
        this.keepAlive();
    }
    
    onInstall() {
        console.log('Locket Celeb Auto Helper installed');
        
        // Set default state
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
        
        // Open welcome page
        chrome.tabs.create({
            url: 'https://locket.binhake.dev/'
        });
    }
    
    onUpdate() {
        console.log('Locket Celeb Auto Helper updated');
    }
    
    // Keep service worker alive
    keepAlive() {
        setInterval(() => {
            chrome.runtime.getPlatformInfo();
        }, 20000); // Every 20 seconds
    }
}

// Initialize background service
new BackgroundService();