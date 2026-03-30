/**
 * DataManager - 数据管理模块
 * 负责用户数据的删除、清理和验证
 */

const DataManager = (() => {
    'use strict';

    // 存储键前缀
    const STORAGE_PREFIX = 'royalLegacy_';
    
    // 数据删除日志
    const deletionLogs = [];

    /**
     * 生成删除操作日志
     */
    function logDeletion(action, dataScope, userId = 'guest') {
        const log = {
            id: `DEL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            action,
            dataScope,
            userId,
            browser: navigator.userAgent,
            platform: navigator.platform
        };
        
        deletionLogs.push(log);
        console.log('Data deletion log:', log);
        
        // 存储日志到localStorage（可选）
        try {
            const logs = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}deletionLogs`) || '[]');
            logs.push(log);
            // 只保留最近100条日志
            const recentLogs = logs.slice(-100);
            localStorage.setItem(`${STORAGE_PREFIX}deletionLogs`, JSON.stringify(recentLogs));
        } catch (error) {
            console.error('Failed to store deletion log:', error);
        }
    }

    /**
     * 清理localStorage数据
     */
    function clearLocalStorage() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(STORAGE_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.error(`Failed to remove localStorage item ${key}:`, error);
            }
        });
        
        return keysToRemove.length;
    }

    /**
     * 清理sessionStorage数据
     */
    function clearSessionStorage() {
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key.startsWith(STORAGE_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            try {
                sessionStorage.removeItem(key);
            } catch (error) {
                console.error(`Failed to remove sessionStorage item ${key}:`, error);
            }
        });
        
        return keysToRemove.length;
    }

    /**
     * 清理IndexedDB数据
     */
    function clearIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                resolve(0);
                return;
            }
            
            const request = indexedDB.deleteDatabase('royalLegacy');
            
            request.onsuccess = () => {
                resolve(1);
            };
            
            request.onerror = (event) => {
                console.error('Failed to delete IndexedDB:', event.target.error);
                resolve(0);
            };
        });
    }

    /**
     * 清理缓存数据
     */
    function clearCache() {
        if ('caches' in window) {
            return caches.keys().then(cacheNames => {
                const deletionPromises = cacheNames
                    .filter(name => name.includes('royalLegacy'))
                    .map(name => caches.delete(name));
                
                return Promise.all(deletionPromises).then(results => {
                    return results.filter(Boolean).length;
                });
            });
        }
        return Promise.resolve(0);
    }

    /**
     * 模拟清理第三方服务数据
     */
    function clearThirdPartyData() {
        // 这里可以添加实际的第三方服务数据清理逻辑
        // 例如：Google Analytics、Firebase等
        console.log('Clearing third-party service data...');
        return Promise.resolve();
    }

    /**
     * 验证数据删除结果
     */
    function verifyDeletion() {
        const verification = {
            localStorage: {
                hasGameData: localStorage.getItem(`${STORAGE_PREFIX}v2`) !== null,
                hasRelatedItems: false,
                relatedItems: []
            },
            sessionStorage: {
                hasGameData: false,
                hasRelatedItems: false,
                relatedItems: []
            },
            totalItemsRemoved: 0
        };
        
        // 检查localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(STORAGE_PREFIX)) {
                verification.localStorage.hasRelatedItems = true;
                verification.localStorage.relatedItems.push(key);
            }
        }
        
        // 检查sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key.startsWith(STORAGE_PREFIX)) {
                verification.sessionStorage.hasRelatedItems = true;
                verification.sessionStorage.relatedItems.push(key);
            }
        }
        
        verification.totalItemsRemoved = 
            verification.localStorage.relatedItems.length + 
            verification.sessionStorage.relatedItems.length;
        
        return verification;
    }

    /**
     * 生成数据删除确认信息
     */
    function generateDeletionConfirmationMessage() {
        return {
            title: 'Delete All Data',
            message: 'Are you sure you want to delete all your game data?',
            warning: 'This action cannot be undone!',
            dataWarning: 'The following data will be permanently deleted:',
            dataCategories: [
                'Account information',
                'Game progress and level data',
                'Purchases and rewards history',
                'Card album collection',
                'Daily sign-in history',
                'Game settings and preferences',
                'All stored game data'
            ],
            finalWarning: 'Once deleted, this data cannot be recovered. Please proceed with caution.'
        };
    }

    // 公共API
    return {
        /**
         * 彻底删除所有用户数据
         */
        async deleteAllUserData(userId = 'guest') {
            try {
                logDeletion('DELETE_ALL_USER_DATA', 'complete', userId);
                
                // 清理localStorage
                const localStorageItems = clearLocalStorage();
                
                // 清理sessionStorage
                const sessionStorageItems = clearSessionStorage();
                
                // 清理IndexedDB
                const indexedDBItems = await clearIndexedDB();
                
                // 清理缓存
                const cacheItems = await clearCache();
                
                // 清理第三方服务数据
                await clearThirdPartyData();
                
                // 重置StateManager状态
                if (window.StateManager) {
                    StateManager.reset();
                    console.log('StateManager reset to default state');
                }
                
                // 验证删除结果
                const verification = verifyDeletion();
                
                const report = {
                    timestamp: new Date().toISOString(),
                    itemsRemoved: {
                        localStorage: localStorageItems,
                        sessionStorage: sessionStorageItems,
                        indexedDB: indexedDBItems,
                        cache: cacheItems
                    },
                    verification,
                    status: verification.localStorage.hasGameData || verification.localStorage.hasRelatedItems ? 'WARNING' : 'SUCCESS'
                };
                
                console.log('Data deletion report:', report);
                return report;
                
            } catch (error) {
                console.error('Failed to delete user data:', error);
                logDeletion('DELETE_ALL_USER_DATA', 'failed', userId);
                throw error;
            }
        },

        /**
         * 重置游戏进度数据（保留账号设置）
         */
        resetGameProgress(userId = 'guest') {
            try {
                logDeletion('RESET_GAME_PROGRESS', 'game_data', userId);
                
                const state = StateManager.get();
                const resetData = {
                    ...state,
                    gold: 0,
                    stamina: 10,
                    cardPacks: 0,
                    totalStars: 0,
                    levelUnlocked: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
                    levelStars: Array(25).fill(0),
                    album: Array(40).fill(false),
                    signDays: 0,
                    signToday: false,
                    questProgress: {},
                    achievementProgress: {}
                };
                
                StateManager.batchUpdate(resetData);
                StateManager.flush();
                
                return {
                    status: 'SUCCESS',
                    message: 'Game progress has been reset'
                };
                
            } catch (error) {
                console.error('Failed to reset game progress:', error);
                logDeletion('RESET_GAME_PROGRESS', 'failed', userId);
                throw error;
            }
        },

        /**
         * 获取数据删除确认信息
         */
        getDeletionConfirmationMessage() {
            return generateDeletionConfirmationMessage();
        },

        /**
         * 获取删除操作日志
         */
        getDeletionLogs() {
            return [...deletionLogs];
        },

        /**
         * 验证数据删除结果
         */
        verifyDeletion() {
            return verifyDeletion();
        }
    };
})();

// 导出到全局
window.DataManager = DataManager;