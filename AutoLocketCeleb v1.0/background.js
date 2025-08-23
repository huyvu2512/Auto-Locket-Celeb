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
            this.handleMessage(message, sender, sendResponse);
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
                currentStep: ''
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
            if (result.automationState && result.automationState.isRunning) {
                // Inject content script if automation is running
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                });
            }
        } catch (error) {
            console.error('Error checking automation state:', error);
        }
    }
    
    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'GET_STATE':
                this.getState(sendResponse);
                return true; // Keep message channel open
                
            case 'SET_STATE':
                this.setState(message.state, sendResponse);
                return true;
                
            case 'LOG':
                console.log('Content Script Log:', message.message);
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    }
    
    async getState(sendResponse) {
        try {
            const result = await chrome.storage.local.get(['automationState']);
            sendResponse({ success: true, state: result.automationState });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async setState(state, sendResponse) {
        try {
            await chrome.storage.local.set({ automationState: state });
            sendResponse({ success: true });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }
    
    // Keep service worker alive
    keepAlive() {
        setInterval(() => {
            chrome.storage.local.get(['keepAlive'], () => {
                // This action keeps the service worker alive
            });
        }, 20000); // Every 20 seconds
    }
}

// Initialize background service
new BackgroundService();