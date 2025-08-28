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
        
        // Listen for tab updates to resume automation
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.url.includes('locket.binhake.dev')) {
                this.checkAutomationState(tabId);
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
    
    async checkAutomationState(tabId) {
        try {
            const result = await chrome.storage.local.get(['automationState']);
            // Only inject the script if automation was running. 
            // The script itself will handle resuming based on the full state.
            if (result.automationState && result.automationState.isRunning) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                });
            }
        } catch (error) {
            console.error('Error checking automation state:', error);
        }
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