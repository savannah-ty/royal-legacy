/**
 * Royal Legacy - Fixed Application
 * 修复版主应用入口
 * 
 * 修复记录：
 * 1. 修复年龄验证流程 - 移除不存在的loginPage跳转
 * 2. 修复支付功能 - 添加支付方式选择页面逻辑
 * 3. 修复星级显示 - 添加 earned 类样式处理
 * 4. 修复体力恢复 - 添加实时倒计时显示
 * 5. 修复游戏匹配逻辑 - 消除递归调用风险
 * 6. 添加设置功能 - 数据清除、无障碍模式
 * 7. 优化UI交互 - 添加过渡动画和反馈
 * 8. 减少弹窗干扰 - 移除不必要的Toast提示
 * 9. 修复消除逻辑 - 正确处理连锁反应
 * 10. 优化三星评分 - 基于剩余步数和得分
 * 11. 添加登录系统 - 匿名登录和年龄验证
 * 12. 修复支付流程 - 皇家礼包触发支付选择
 * 13. 优化游戏逻辑 - 连锁反应不消耗额外步数
 */

const RoyalLegacyApp = {
    version: '2.5.0-optimized',
    initialized: false,
    currentPage: 'verifyPage',
    staminaTimer: null,
    cascadeCount: 0,
    hasUsedStep: false,
    // 缓存DOM元素
    domCache: {},

    async init() {
        if (this.initialized) {
            console.warn('App already initialized');
            return;
        }

        console.log(`🎮 Royal Legacy v${this.version} - Initializing...`);

        try {
            // 预缓存DOM元素
            this._cacheDomElements();
            
            StateManager.init();
            this._initCompatibilityLayer();
            GameEngine.init();
            
            // 初始化支付API
            PaymentAPI.init({
                baseUrl: '/api/payment',
                timeout: 30000,
                retryAttempts: 3,
                retryDelay: 1000
            });
            
            // 检查支付方式可用性
            const availability = await PaymentAPI.checkAvailability();
            console.log('Payment methods availability:', availability);
            
            this._bindEvents();
            this._restoreGameState();
            this._initUI();
            this._startStaminaTimer();

            this.initialized = true;
            console.log('✅ Royal Legacy initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            this._handleInitError(error);
        }
    },

    _cacheDomElements() {
        // 预缓存常用DOM元素
        this.domCache = {
            homeGold: document.getElementById('homeGold'),
            homeStamina: document.getElementById('homeStamina'),
            homeCardPacks: document.getElementById('homeCardPacks'),
            homeStars: document.getElementById('homeStars'),
            levelSelectStamina: document.getElementById('levelSelectStamina'),
            totalStars: document.getElementById('totalStars'),
            score: document.getElementById('score'),
            targetScore: document.getElementById('targetScore'),
            steps: document.getElementById('steps'),
            gameGold: document.getElementById('gameGold'),
            currentLevelDisplay: document.getElementById('currentLevelDisplay'),
            gameBoard: document.getElementById('gameBoard'),
            levelsGrid: document.getElementById('levelsGrid'),
            toast: document.getElementById('toast'),
            toastContent: document.getElementById('toastContent')
        };
    },

    _initCompatibilityLayer() {
        window.switchPage = (pageId) => this.switchPage(pageId);
        window.showLevelSelectPage = () => this.showLevelSelectPage();
        window.showToast = (msg, type) => this.showToast(msg, type);
        window.updateHomeStats = () => this.updateHomeStats();
        window.updateGameStats = () => this.updateGameStats();
        window.useBomb = () => this.useBomb();
        window.refreshBoard = () => this.refreshBoard();
        window.addSteps = () => this.addSteps();
        window.showSignModal = () => this.showModal('signModal');
        window.showPayModal = () => this.showPayModal();
        window.showAlbumModal = () => this.showModal('albumModal');
        window.showSettingsModal = () => this.showSettingsModal();
        window.closeSignModal = () => this.hideModal('signModal');
        window.closePayModal = () => this.hideModal('payModal');
        window.closeAlbumModal = () => this.hideModal('albumModal');
        window.closeSettingsModal = () => this.hideModal('settingsModal');
        window.closeLevelCompleteModal = () => this.hideModal('levelCompleteModal');
        window.selectLevel = (level) => this.selectLevel(level);
        window.startGame = () => this.startGame();
        window.exitLevel = () => this.exitLevel();
        window.signIn = () => this.signIn();
        window.openCardPack = () => this.openCardPack();
        window.selectPackage = (pkg) => this.selectPackage(pkg);
        window.backToShop = () => this.backToShop();
        window.selectPaymentMethod = (method) => this.selectPaymentMethod(method);
        window.processPayment = () => this.processPayment();
        window.closePaymentModal = () => this.closePaymentModal();
        window.toggleSetting = (setting) => this.toggleSetting(setting);
        window.clearAllData = () => this.clearAllData();
        window.loginAnonymous = () => this.loginAnonymous();
        window.logout = () => this.logout();
    },

    _bindEvents() {
        // 状态变化监听器
        StateManager.subscribe('gold', () => this.updateHomeStats());
        StateManager.subscribe('stamina', () => {
            this.updateHomeStats();
            this.updateStaminaDisplay();
        });
        StateManager.subscribe('score', () => this.updateGameStats());
        StateManager.subscribe('steps', () => this.updateGameStats());
        StateManager.subscribe('cardPacks', () => this.updateHomeStats());
        StateManager.subscribe('totalStars', () => this.updateHomeStats());
        StateManager.subscribe('isRoyalPassActive', () => this.updateHomeStats());
        StateManager.subscribe('royalPassExpiry', () => this.updateHomeStats());
        StateManager.subscribe('royalPassLastClaim', () => this.updateHomeStats());
        StateManager.subscribe('signDays', () => this.initSignIn());
        StateManager.subscribe('signToday', () => this.initSignIn());

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
        });

        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                StateManager.flush();
            } else {
                // 页面重新可见时更新状态
                this.updateHomeStats();
                this.updateStaminaDisplay();
            }
        });

        // 页面卸载前保存状态
        window.addEventListener('beforeunload', () => {
            StateManager.flush();
        });

        // 页面加载完成后更新状态
        window.addEventListener('load', () => {
            this.updateHomeStats();
            this.updateStaminaDisplay();
        });

        // 页面刷新后恢复状态
        window.addEventListener('pageshow', (event) => {
            if (!event.persisted) {
                // 页面不是从缓存加载，需要更新状态
                this.updateHomeStats();
                this.updateStaminaDisplay();
            }
        });

        // 状态加载完成事件
        window.addEventListener('state:loaded', () => {
            this.updateHomeStats();
            this.updateStaminaDisplay();
        });

        // 状态保存完成事件
        window.addEventListener('state:saved', () => {
            console.log('State saved successfully');
        });
    },

    _restoreGameState() {
        this._recoverStamina();
        this._checkDailyReset();
        
        // 检查是否已登录
        const state = StateManager.get();
        if (state.isLoggedIn && state.userAge) {
            // 根据userAge重新设置ageMode、isChildMode和isTeenMode
            let ageMode, isChildMode, isTeenMode;
            switch(state.userAge) {
                case 'under13':
                    ageMode = 'kids';
                    isChildMode = true;
                    isTeenMode = false;
                    break;
                case '13to17':
                    ageMode = 'teen';
                    isChildMode = false;
                    isTeenMode = true;
                    break;
                default:
                    ageMode = 'adult';
                    isChildMode = false;
                    isTeenMode = false;
            }
            
            StateManager.set('ageMode', ageMode);
            StateManager.set('isChildMode', isChildMode);
            StateManager.set('isTeenMode', isTeenMode);
            
            // 根据isChildMode决定是否隐藏付费功能
            if (isChildMode) {
                this._hidePaymentFeatures();
            }
            
            // 已登录，直接显示首页
            setTimeout(() => {
                this.switchPage('homePage');
            }, 100);
        }
    },

    _recoverStamina() {
        const state = StateManager.get();
        const now = Date.now();
        const lastUpdate = state.lastStaminaUpdate || now;
        const recoveryTime = 5 * 60 * 1000;
        
        if (state.stamina < state.maxStamina) {
            const elapsed = now - lastUpdate;
            const recovered = Math.floor(elapsed / recoveryTime);
            
            if (recovered > 0) {
                const newStamina = Math.min(state.stamina + recovered, state.maxStamina);
                StateManager.set('stamina', newStamina);
                StateManager.set('lastStaminaUpdate', now);
            }
        } else {
            StateManager.set('lastStaminaUpdate', now);
        }
    },

    _startStaminaTimer() {
        if (this.staminaTimer) {
            clearInterval(this.staminaTimer);
        }
        
        this.staminaTimer = setInterval(() => {
            this._recoverStamina();
            this.updateStaminaDisplay();
        }, 1000);
    },

    updateStaminaDisplay() {
        const state = StateManager.get();
        const staminaEl = this.domCache.homeStamina;
        const levelSelectStaminaEl = this.domCache.levelSelectStamina;
        
        const baseText = `${state.stamina}/${state.maxStamina}`;
        
        let displayText = baseText;
        if (state.stamina < state.maxStamina) {
            const now = Date.now();
            const lastUpdate = state.lastStaminaUpdate || now;
            const recoveryTime = 5 * 60 * 1000;
            const elapsed = now - lastUpdate;
            const remaining = Math.max(0, recoveryTime - (elapsed % recoveryTime));
            
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            displayText = `${baseText} (+1 in ${minutes}:${seconds.toString().padStart(2, '0')})`;
        }
        
        if (staminaEl) staminaEl.textContent = displayText;
        if (levelSelectStaminaEl) levelSelectStaminaEl.textContent = baseText;
    },

    _checkDailyReset() {
        const lastVisit = localStorage.getItem('lastVisitDate');
        const today = new Date().toDateString();
        
        if (lastVisit !== today) {
            StateManager.set('signToday', false);
            localStorage.setItem('lastVisitDate', today);
        }
    },

    _initUI() {
        this.updateHomeStats();
        this.updateStaminaDisplay();
    },

    updateHomeStats() {
        const state = StateManager.get();
        
        if (this.domCache.homeGold) this.domCache.homeGold.textContent = state.gold;
        if (this.domCache.homeCardPacks) this.domCache.homeCardPacks.textContent = state.cardPacks;
        if (this.domCache.homeStars) this.domCache.homeStars.textContent = state.totalStars;
        
        this.updateStaminaDisplay();
        
        // 更新皇家订阅状态
        this.updateRoyalPassStatus();
    },
    
    updateRoyalPassStatus() {
        const state = StateManager.get();
        const royalPassCard = document.querySelector('.glass-card');
        
        if (royalPassCard && royalPassCard.textContent.includes('Royal Pass')) {
            if (state.isRoyalPassActive && state.royalPassExpiry > Date.now()) {
                // 计算剩余天数
                const daysLeft = Math.ceil((state.royalPassExpiry - Date.now()) / (24 * 60 * 60 * 1000));
                
                // 检查是否已经领取了今日的皇家订阅奖励
                const today = new Date().toDateString();
                const hasClaimedToday = state.royalPassLastClaim === today;
                
                royalPassCard.innerHTML = `
                    <h3 style="color: var(--gold-primary); margin-bottom: 8px; font-size: 1.25rem;">Royal Pass Active</h3>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.5;">You have ${daysLeft} days left</p>
                    <div style="background: rgba(212,175,55,0.2); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px;">Exclusive Benefits:</div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="font-size: 0.75rem; display: flex; align-items: center; gap: 6px;">
                                <span>⭐</span>
                                <span>Daily 100 Gold bonus</span>
                            </div>
                            <div style="font-size: 0.75rem; display: flex; align-items: center; gap: 6px;">
                                <span>⚡</span>
                                <span>Stamina regeneration boost</span>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-gold" onclick="RoyalLegacyApp.claimRoyalPassDailyReward()" style="width: 100%; padding: 12px 0; font-size: 0.875rem; margin-bottom: 12px;" ${hasClaimedToday ? 'disabled' : ''}>
                        ${hasClaimedToday ? 'Already Claimed Today' : 'Claim Daily Reward'}
                    </button>
                    <button class="btn btn-secondary" onclick="RoyalLegacyApp.selectPackage('4.99', true)" style="width: 100%; padding: 12px 0; font-size: 0.875rem;">Extend Subscription</button>
                `;
            }
        }
    },
    
    claimRoyalPassDailyReward() {
        const state = StateManager.get();
        
        // 检查皇家订阅是否激活
        if (!state.isRoyalPassActive || state.royalPassExpiry <= Date.now()) {
            this.showToast('Royal Pass is not active', 'error');
            return;
        }
        
        // 检查是否已经领取了今日的奖励
        const today = new Date().toDateString();
        if (state.royalPassLastClaim === today) {
            this.showToast('You have already claimed your daily reward', 'info');
            return;
        }
        
        // 发放每日奖励
        StateManager.set('gold', state.gold + 100);
        StateManager.set('royalPassLastClaim', today);
        
        this.showToast('Daily reward claimed! +100 Gold', 'success');
        this.updateHomeStats();
    },

    updateGameStats() {
        const state = StateManager.get();
        
        if (this.domCache.score) this.domCache.score.textContent = state.score;
        if (this.domCache.steps) this.domCache.steps.textContent = state.steps;
        if (this.domCache.gameGold) this.domCache.gameGold.textContent = state.gold;
        
        // 更新游戏页面的体力显示
        const gameStaminaEl = document.getElementById('gameStamina');
        if (gameStaminaEl) {
            gameStaminaEl.textContent = `${state.stamina}/${state.maxStamina}`;
        }
        
        // 调用得分进度更新
        this.updateScoreProgress();
    },
    
    updateScoreProgress() {
        const state = StateManager.get();
        const score = state.score;
        const targetScore = state.targetScore || 1000;
        
        // 重新计算各星级阈值，确保与进度条分割线对应
        // 1星：33.33% 进度
        // 2星：66.66% 进度
        // 3星：100% 进度
        const threeStarScore = targetScore * 1.5;
        const oneStarScore = threeStarScore * (1/3);
        const twoStarScore = threeStarScore * (2/3);
        
        // 更新星级分数显示
        const oneStarEl = document.getElementById('oneStarScore');
        const twoStarEl = document.getElementById('twoStarScore');
        const threeStarEl = document.getElementById('threeStarScore');
        
        if (oneStarEl) oneStarEl.textContent = Math.round(oneStarScore);
        if (twoStarEl) twoStarEl.textContent = Math.round(twoStarScore);
        if (threeStarEl) threeStarEl.textContent = Math.round(threeStarScore);
        
        // 计算进度百分比（最大100%）
        let progressPercent = (score / threeStarScore) * 100;
        progressPercent = Math.min(progressPercent, 100);
        
        // 更新进度条，添加平滑动画效果
        const progressBar = document.getElementById('scoreProgressBar');
        if (progressBar) {
            // 添加过渡动画
            progressBar.style.transition = 'width 0.5s ease-out';
            progressBar.style.width = `${progressPercent}%`;
        }
        
        // 更新星级显示，添加动画效果
        const star1 = document.getElementById('star1');
        const star2 = document.getElementById('star2');
        const star3 = document.getElementById('star3');
        
        if (star1) {
            if (score >= oneStarScore) {
                star1.style.opacity = '1';
                star1.style.transform = 'scale(1.2)';
                star1.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    star1.style.transform = 'scale(1)';
                }, 300);
            } else {
                star1.style.opacity = '0.6';
            }
        }
        
        if (star2) {
            if (score >= twoStarScore) {
                star2.style.opacity = '1';
                star2.style.transform = 'scale(1.2)';
                star2.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    star2.style.transform = 'scale(1)';
                }, 300);
            } else {
                star2.style.opacity = '0.6';
            }
        }
        
        if (star3) {
            if (score >= threeStarScore) {
                star3.style.opacity = '1';
                star3.style.transform = 'scale(1.2)';
                star3.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    star3.style.transform = 'scale(1)';
                }, 300);
            } else {
                star3.style.opacity = '0.6';
            }
        }
    },

    switchPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
            
            if (pageId === 'levelSelectPage') {
                this.initLevelSelect();
            } else if (pageId === 'homePage') {
                this.updateHomeStats();
            } else if (pageId === 'paymentMethodPage') {
                // 直接调用restorePaymentMethodSelection函数，确保上下文正确
                const selectedMethod = StateManager.get('selectedPaymentMethod');
                if (selectedMethod) {
                    // 直接操作DOM，确保选中状态正确设置
                    document.querySelectorAll('#cardPaymentOption, #paypalPaymentOption, #googlePaymentOption, #applePaymentOption').forEach(option => {
                        option.style.borderColor = 'transparent';
                        option.style.background = 'linear-gradient(145deg, rgba(26,26,46,.8), rgba(26,26,46,.6))';
                        option.style.boxShadow = 'none';
                    });
                    
                    document.querySelectorAll('#cardPaymentCheck, #paypalPaymentCheck, #googlePaymentCheck, #applePaymentCheck').forEach(check => {
                        check.style.opacity = '0';
                        check.style.color = '';
                    });
                    
                    // 设置选中状态
                    const optionElement = document.getElementById(`${selectedMethod}PaymentOption`);
                    const checkElement = document.getElementById(`${selectedMethod}PaymentCheck`);
                    
                    if (optionElement && checkElement) {
                        optionElement.style.borderColor = 'var(--gold-primary)';
                        optionElement.style.background = 'linear-gradient(145deg, rgba(212,175,55,.15), rgba(26,26,46,.8))';
                        optionElement.style.boxShadow = '0 0 20px rgba(212,175,55,.3)';
                        checkElement.style.opacity = '1';
                        checkElement.style.color = 'var(--gold-primary)';
                    }
                }
            }
            
            window.scrollTo(0, 0);
        }
    },

    showLevelSelectPage() {
        this.switchPage('levelSelectPage');
    },

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hide');
            
            if (modalId === 'signModal') this.initSignIn();
            if (modalId === 'albumModal') this.initAlbum();
        }
    },

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hide');
        }
    },

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hide');
        });
    },

    showToast(message, type = 'info') {
        const toast = this.domCache.toast;
        const toastContent = this.domCache.toastContent;
        
        if (toast && toastContent) {
            toastContent.textContent = message;
            
            const colors = {
                'success': '#22c55e',
                'error': '#ef4444',
                'warning': '#f59e0b',
                'info': '#d4af37'
            };
            toastContent.style.borderColor = colors[type] || colors.info;
            
            toast.classList.remove('hide');
            
            setTimeout(() => {
                toast.classList.add('hide');
            }, 2000);
        }
    },

    // ========== 登录系统 ==========
    
    loginAnonymous() {
        StateManager.set('isLoggedIn', true);
        StateManager.set('loginType', 'anonymous');
        StateManager.set('userName', 'Guest');
        
        // 检查年龄模式
        const isChildMode = StateManager.get('isChildMode');
        if (isChildMode) {
            this._hidePaymentFeatures();
        }
        
        this.switchPage('homePage');
    },

    logout() {
        this.showConfirmModal('Logout Confirmation', 'Are you sure you want to logout? Your game progress will be preserved.', () => {
            // 清除登录状态
            StateManager.set('isLoggedIn', false);
            StateManager.set('loginType', null);
            StateManager.set('userName', 'Guest');
            StateManager.set('userAge', null);
            StateManager.set('ageMode', null);
            StateManager.set('isChildMode', false);
            StateManager.set('isTeenMode', false);
            
            // 关闭设置弹窗
            this.hideModal('settingsModal');
            
            // 返回验证页面
            this.switchPage('verifyPage');
            
            // 重置年龄选择
            const ageOptions = document.querySelectorAll('input[name="age"]');
            ageOptions.forEach(option => option.checked = false);
            
            // 重置条款勾选
            const termsCheck = document.getElementById('termsCheck');
            const privacyCheck = document.getElementById('privacyCheck');
            if (termsCheck) termsCheck.checked = false;
            if (privacyCheck) privacyCheck.checked = false;
            
            // 显示年龄验证模态框
            setTimeout(() => {
                const modal = document.getElementById('ageModal');
                if (modal) {
                    modal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
            }, 200);
            
            console.log('👋 User logged out successfully');
        });
    },
    
    showConfirmModal(title, message, onConfirm, isDeletion = false, deletionInfo = null) {
        const existingModal = document.getElementById('confirmModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.className = 'modal';
        
        let modalContent = '';
        
        if (isDeletion && deletionInfo) {
            // 构建删除确认对话框内容
            modalContent = `
                <div class="modal-content" style="max-width: 450px;">
                    <h3 style="text-align: center; margin-bottom: 20px; color: #ef4444;">${title}</h3>
                    <div style="margin-bottom: 20px;">
                        <p style="text-align: center; color: var(--text-primary); margin-bottom: 12px; font-size: 0.9375rem;">${message}</p>
                        <p style="text-align: center; color: #ef4444; font-weight: 600; margin-bottom: 16px; font-size: 1.1rem;">${deletionInfo.warning}</p>
                        
                        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
                            <p style="color: #ef4444; font-weight: 600; margin-bottom: 12px;">${deletionInfo.dataWarning}</p>
                            <ul style="list-style-type: none; padding: 0; margin: 0;">
                                ${deletionInfo.dataCategories.map(category => `
                                    <li style="color: var(--text-secondary); margin-bottom: 6px; display: flex; align-items: center;">
                                        <span style="color: #ef4444; margin-right: 8px;">•</span>
                                        ${category}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        
                        <p style="text-align: center; color: #ef4444; font-weight: 600; font-size: 0.9375rem;">${deletionInfo.finalWarning}</p>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn btn-secondary" id="cancelBtn" style="flex: 1;">Cancel</button>
                        <button class="btn btn-secondary" id="confirmBtn" style="flex: 1; background: #ef4444; border-color: #ef4444; color: white;">Delete</button>
                    </div>
                </div>
            `;
        } else {
            // 构建普通确认对话框内容
            modalContent = `
                <div class="modal-content" style="max-width: 400px;">
                    <h3 style="text-align: center; margin-bottom: 16px; background: linear-gradient(135deg, #d4af37, #f4e4ba); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${title}</h3>
                    <p style="text-align: center; color: var(--text-secondary); margin-bottom: 24px; font-size: 0.875rem;">${message}</p>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn btn-secondary" id="cancelBtn" style="flex: 1;">Cancel</button>
                        <button class="btn btn-gold" id="confirmBtn" style="flex: 1;">Confirm</button>
                    </div>
                </div>
            `;
        }
        
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hide'), 10);
        
        // 添加事件监听器
        const cancelBtn = document.getElementById('cancelBtn');
        const confirmBtn = document.getElementById('confirmBtn');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideModal('confirmModal');
            });
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.hideModal('confirmModal');
                if (typeof onConfirm === 'function') {
                    onConfirm();
                }
            });
        }
    },

    // ========== 关卡系统 ==========
    
    initLevelSelect() {
        const container = this.domCache.levelsGrid;
        if (!container) return;

        const state = StateManager.get();
        container.innerHTML = '';

        for (let i = 1; i <= 25; i++) {
            const levelDiv = document.createElement('div');
            const isUnlocked = state.levelUnlocked[i-1];
            const isCurrent = state.currentLevel === i;
            const stars = state.levelStars[i-1] || 0;
            
            levelDiv.className = `level-item ${isUnlocked ? '' : 'locked'} ${isCurrent ? 'current' : ''}`;
            
            if (isUnlocked) {
                levelDiv.onclick = () => this.selectLevel(i);
            }
            
            const starsHtml = Array(3).fill(0).map((_, idx) => {
                const earned = idx < stars ? 'earned' : '';
                return `<span class="level-star ${earned}">★</span>`;
            }).join('');
            
            levelDiv.innerHTML = `
                <div class="level-number">${i}</div>
                <div class="level-stars">${starsHtml}</div>
            `;
            
            container.appendChild(levelDiv);
        }
        
        if (this.domCache.totalStars) {
            this.domCache.totalStars.textContent = state.totalStars;
        }
    },

    selectLevel(level) {
        const state = StateManager.get();
        
        if (!state.levelUnlocked[level-1]) {
            return;
        }

        if (state.stamina < 1) {
            this.showToast('Not enough stamina!', 'error');
            return;
        }

        // 消耗1点体力
        StateManager.set('stamina', state.stamina - 1);
        StateManager.set('lastStaminaUpdate', Date.now());
        StateManager.set('currentLevel', level);
        
        const targetScores = [1000, 1200, 1500, 1800, 2000, 2500, 2800, 3200, 3500, 4000,
                             4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000,
                             9500, 10000, 11000, 12000, 15000];
        
        const baseSteps = 20;
        
        StateManager.set('targetScore', targetScores[level-1] || 1000);
        StateManager.set('score', 0);
        StateManager.set('steps', baseSteps);
        StateManager.set('startSteps', baseSteps);
        
        this.switchPage('gamePage');
        
        if (this.domCache.currentLevelDisplay) {
            this.domCache.currentLevelDisplay.textContent = level;
        }
        
        this.initGameBoard();
        this.updateGameStats();
    },

    // ========== 游戏系统 ==========
    
    initGameBoard() {
        const board = this.domCache.gameBoard;
        if (!board) return;

        GameEngine.createBoard();
        const boardData = GameEngine.getBoard();
        
        board.innerHTML = '';
        boardData.forEach((tile, index) => {
            const tileEl = document.createElement('div');
            tileEl.className = `tile ${tile.color}`;
            tileEl.innerHTML = tile.icon;
            tileEl.dataset.index = index;
            tileEl.onclick = () => this.handleTileClick(index);
            board.appendChild(tileEl);
        });
        
        this.cascadeCount = 0;
        this.hasUsedStep = false;
    },

    handleTileClick(index) {
        if (StateManager.get('isProcessing')) return;

        const tiles = document.querySelectorAll('.tile');
        const selectedTile = document.querySelector('.tile.selected');

        if (selectedTile) {
            const selectedIndex = parseInt(selectedTile.dataset.index);
            
            if (selectedIndex === index) {
                selectedTile.classList.remove('selected');
                return;
            }

            this.trySwap(selectedIndex, index);
        } else {
            tiles[index].classList.add('selected');
        }
    },

    async trySwap(idx1, idx2) {
        if (!GameEngine.isAdjacent(idx1, idx2)) {
            document.querySelectorAll('.tile').forEach(t => t.classList.remove('selected'));
            document.querySelectorAll('.tile')[idx2].classList.add('selected');
            return;
        }

        StateManager.set('isProcessing', true);
        this.hasUsedStep = false; // 重置步数消耗标记

        GameEngine.swapTiles(idx1, idx2);
        this.updateBoardDisplay();

        const matches = GameEngine.findMatches();
        
        if (matches.length >= 3) {
            this.cascadeCount = 0;
            await this.processMatches(matches);
        } else {
            await this.delay(200);
            GameEngine.swapTiles(idx1, idx2);
            this.updateBoardDisplay();
        }

        document.querySelectorAll('.tile').forEach(t => t.classList.remove('selected'));
        StateManager.set('isProcessing', false);
    },

    async processMatches(matches) {
        // 只在第一次消除时消耗步数，连锁反应不消耗
        if (!this.hasUsedStep) {
            const newSteps = StateManager.get('steps') - 1;
            StateManager.set('steps', newSteps);
            this.hasUsedStep = true;
        }
        
        const result = GameEngine.processMatches(matches, this.cascadeCount > 0);
        
        const newScore = StateManager.get('score') + result.score;
        StateManager.set('score', newScore);
        
        this.updateGameStats();

        // 显示消除动画
        matches.forEach(idx => {
            const tile = document.querySelectorAll('.tile')[idx];
            if (tile) {
                tile.classList.add('matched');
            }
        });

        await this.delay(300);

        // 处理下落
        GameEngine.processFalling();
        this.updateBoardDisplay();

        // 检查连锁反应
        const newMatches = GameEngine.findMatches();
        if (newMatches.length >= 3 && StateManager.get('steps') > 0) {
            this.cascadeCount++;
            await this.delay(200);
            await this.processMatches(newMatches);
        } else {
            this.cascadeCount = 0;
            this.hasUsedStep = false; // 重置标记
            this.checkGameState();
        }
    },

    updateBoardDisplay() {
        const board = this.domCache.gameBoard;
        if (!board) return;

        const boardData = GameEngine.getBoard();
        
        boardData.forEach((tile, index) => {
            const tileEl = board.children[index];
            if (tileEl) {
                tileEl.className = `tile ${tile.color}`;
                tileEl.innerHTML = tile.icon;
            }
        });
    },

    checkGameState() {
        const state = StateManager.get();
        
        // 计算三星阈值
        const targetScore = state.targetScore || 1000;
        const threeStarThreshold = targetScore * 1.5;
        
        // 检查是否达到三星
        if (state.score >= threeStarThreshold) {
            this.levelComplete();
            return;
        }
        
        // 步数耗尽，检查是否达到1星门槛
        if (state.steps <= 0) {
            const oneStarThreshold = targetScore * (1/3); // 与进度条计算方式保持一致
            if (state.score >= oneStarThreshold) {
                this.levelComplete();
            } else {
                this.levelFail();
            }
        }
    },

    levelComplete() {
        const state = StateManager.get();
        const level = state.currentLevel;
        const score = state.score;
        const steps = state.steps;
        
        // 定义各星级分数门槛，与进度条计算方式保持一致
        const targetScore = state.targetScore || 1000;
        const threeStarThreshold = targetScore * 1.5;
        const oneStarThreshold = threeStarThreshold * (1/3);
        const twoStarThreshold = threeStarThreshold * (2/3);
        
        // 星级评定：同时满足步数和分数条件
        let stars = 0;
        if (steps >= 0) { // 确保在限定步数内
            if (score >= threeStarThreshold) {
                stars = 3;
            } else if (score >= twoStarThreshold) {
                stars = 2;
            } else if (score >= oneStarThreshold) {
                stars = 1;
            }
        }
        
        // 确保至少有1星（因为checkGameState已经检查过分数达到1星门槛）
        stars = Math.max(stars, 1);
        
        // 更新关卡数据
        const levelStars = [...state.levelStars];
        levelStars[level-1] = Math.max(levelStars[level-1] || 0, stars);
        StateManager.set('levelStars', levelStars);
        
        // 解锁下一关
        if (level < 25) {
            const levelUnlocked = [...state.levelUnlocked];
            levelUnlocked[level] = true;
            StateManager.set('levelUnlocked', levelUnlocked);
        }
        
        StateManager.set('totalStars', levelStars.reduce((a, b) => a + b, 0));
        
        this.giveLevelRewards(stars);
        this.showLevelCompleteModal(stars);
    },

    levelFail() {
        // 关卡失败时不返还消耗的体力
        setTimeout(() => this.exitLevel(), 1000);
    },

    giveLevelRewards(stars) {
        const rewards = {
            1: { stamina: 1, gold: 10 },
            2: { stamina: 1, gold: 50 },
            3: { stamina: 2, gold: 100, cardPack: 1 }
        };

        const reward = rewards[stars];
        if (!reward) return;

        const state = StateManager.get();
        const updates = {};

        if (reward.stamina) {
            // 确保体力不超过最大值
            updates.stamina = Math.min(state.stamina + reward.stamina, state.maxStamina);
        }
        if (reward.gold) updates.gold = state.gold + reward.gold;
        if (reward.cardPack) updates.cardPacks = state.cardPacks + reward.cardPack;

        StateManager.batchUpdate(updates);
    },

    showLevelCompleteModal(stars) {
        const modal = document.getElementById('levelCompleteModal');
        if (!modal) return;

        // 计算奖励
        const rewards = {
            1: { stamina: 1, gold: 10 },
            2: { stamina: 1, gold: 50 },
            3: { stamina: 2, gold: 100, cardPack: 1 }
        };
        const reward = rewards[stars] || {};

        // 更新模态框内容
        modal.innerHTML = `
            <div class="modal-content" style="text-align: center;">
                <div style="font-size: 4rem; margin-bottom: 16px; animation: float 2s ease-in-out infinite;">🎉</div>
                <h2 style="margin-bottom: 16px;" class="title-gold">Level Complete!</h2>
                <p style="color: var(--text-secondary); margin-bottom: 24px; font-size: 0.875rem;">Congratulations! You earned ${stars} star${stars > 1 ? 's' : ''}!</p>
                
                <!-- 奖励显示 -->
                <div style="background: rgba(212,175,55,0.1); border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: left;">
                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 8px;">Rewards:</div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        ${reward.stamina ? `<div style="font-size: 0.75rem; display: flex; align-items: center; gap: 6px;"><span>⚡</span><span>${reward.stamina} Stamina</span></div>` : ''}
                        ${reward.gold ? `<div style="font-size: 0.75rem; display: flex; align-items: center; gap: 6px;"><span>💰</span><span>${reward.gold} Gold</span></div>` : ''}
                        ${reward.cardPack ? `<div style="font-size: 0.75rem; display: flex; align-items: center; gap: 6px;"><span>🎁</span><span>${reward.cardPack} Card Pack</span></div>` : ''}
                    </div>
                </div>
                
                <!-- 星星显示 -->
                <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 24px;">
                    <span id="star1" style="font-size: 2.5rem; opacity: ${stars >= 1 ? '1' : '0.3'}; filter: ${stars >= 1 ? 'none' : 'grayscale(100%)'}; transition: all 0.3s ease; animation: ${stars >= 1 ? 'float 1s ease-in-out infinite' : 'none'};">⭐</span>
                    <span id="star2" style="font-size: 2.5rem; opacity: ${stars >= 2 ? '1' : '0.3'}; filter: ${stars >= 2 ? 'none' : 'grayscale(100%)'}; transition: all 0.3s ease; animation: ${stars >= 2 ? 'float 1s ease-in-out infinite 0.2s' : 'none'};">⭐</span>
                    <span id="star3" style="font-size: 2.5rem; opacity: ${stars >= 3 ? '1' : '0.3'}; filter: ${stars >= 3 ? 'none' : 'grayscale(100%)'}; transition: all 0.3s ease; animation: ${stars >= 3 ? 'float 1s ease-in-out infinite 0.4s' : 'none'};">⭐</span>
                </div>
                
                <button class="btn btn-gold" onclick="closeLevelCompleteModal(); switchPage('levelSelectPage');" style="width: 100%;">Continue</button>
            </div>
        `;

        modal.classList.remove('hide');
    },

    exitLevel() {
        this.switchPage('levelSelectPage');
        this.initLevelSelect();
    },

    startGame() {
        this.switchPage('levelSelectPage');
        this.initLevelSelect();
    },

    // ========== 道具功能 ==========
    
    useBomb() {
        const state = StateManager.get();
        if (state.gold < 50) {
            return;
        }

        StateManager.set('gold', state.gold - 50);
        
        const tiles = document.querySelectorAll('.tile');
        
        // 确保不重复选择相同的棋子
        const selectedIndices = new Set();
        while (selectedIndices.size < 5 && selectedIndices.size < tiles.length) {
            const idx = Math.floor(Math.random() * tiles.length);
            selectedIndices.add(idx);
        }
        
        // 播放爆炸动画
        selectedIndices.forEach(idx => {
            const tile = tiles[idx];
            if (tile) {
                // 添加更明显的爆炸效果
                tile.style.animation = 'matchPop 0.3s ease-out';
                tile.style.transform = 'scale(1.5)';
                tile.style.opacity = '0';
            }
        });
        
        // 延迟后重新生成游戏板
        setTimeout(() => {
            // 重新生成游戏板
            GameEngine.createBoard();
            this.updateBoardDisplay();
            
            // 加分
            StateManager.set('score', state.score + 100);
            this.updateGameStats();
            
            // 显示炸弹使用成功的提示
            this.showToast('Bomb used! 5 tiles destroyed!', 'success');
        }, 300);
    },

    refreshBoard() {
        const state = StateManager.get();
        if (state.gold < 30) {
            return;
        }

        StateManager.set('gold', state.gold - 30);
        this.initGameBoard();
        this.updateGameStats();
    },

    addSteps() {
        const state = StateManager.get();
        if (state.gold < 100) {
            return;
        }

        StateManager.set('gold', state.gold - 100);
        StateManager.set('steps', state.steps + 5);
        this.updateGameStats();
    },

    // ========== 签到功能 ==========
    
    initSignIn() {
        const state = StateManager.get();
        const signBtn = document.getElementById('signBtn');
        
        if (signBtn) {
            if (state.signToday) {
                signBtn.textContent = 'Already Signed In ✓';
                signBtn.disabled = true;
                signBtn.style.opacity = '0.6';
            } else {
                signBtn.textContent = 'Sign In Now';
                signBtn.disabled = false;
                signBtn.style.opacity = '1';
            }
        }
        
        // 更新签到日期状态
        this.updateSignDays();
        
        // 更新签到统计信息
        this.updateSignStats();
    },

    signIn() {
        const state = StateManager.get();
        if (state.signToday) return;

        const rewards = [50, 100, 150, 200, 300, 500, 1000];
        const dayIndex = state.signDays % 7;
        const reward = rewards[dayIndex];

        StateManager.set('gold', state.gold + reward);
        StateManager.set('signDays', state.signDays + 1);
        StateManager.set('signToday', true);

        this.updateHomeStats();
        this.initSignIn();
        
        // 显示签到成功动画
        this.showSignSuccessAnimation(dayIndex + 1);
    },
    
    updateSignDays() {
        const state = StateManager.get();
        const signDays = state.signDays;
        
        // 重置所有日期状态
        document.querySelectorAll('.sign-day').forEach((day, index) => {
            const dayNum = index + 1;
            const checkElement = day.querySelector('.sign-check');
            
            if (dayNum <= signDays % 7 || signDays >= 7) {
                // 已签到的日期
                day.style.background = 'linear-gradient(145deg, rgba(34,197,94,0.2), rgba(34,197,94,0.1)';
                day.style.borderColor = 'rgba(34,197,94,0.5)';
                if (checkElement) {
                    checkElement.style.opacity = '1';
                    checkElement.style.color = 'var(--success)';
                }
            } else {
                // 未签到的日期
                if (dayNum !== 7) {
                    day.style.background = 'rgba(255,255,255,0.05)';
                    day.style.borderColor = 'rgba(255,255,255,0.1)';
                }
                if (checkElement) {
                    checkElement.style.opacity = '0';
                }
            }
        });
    },
    
    updateSignStats() {
        const state = StateManager.get();
        const signStreakEl = document.getElementById('signStreak');
        const totalCollectedEl = document.getElementById('totalCollected');
        
        if (signStreakEl) {
            signStreakEl.textContent = `${state.signDays} days`;
        }
        
        if (totalCollectedEl) {
            // 计算总收集的金币
            const rewards = [50, 100, 150, 200, 300, 500, 1000];
            const fullWeeks = Math.floor(state.signDays / 7);
            const remainingDays = state.signDays % 7;
            
            let total = fullWeeks * rewards.reduce((a, b) => a + b, 0);
            for (let i = 0; i < remainingDays; i++) {
                total += rewards[i];
            }
            
            totalCollectedEl.textContent = `${total}💰`;
        }
    },
    
    showSignSuccessAnimation(day) {
        const dayElement = document.querySelector(`.sign-day[data-day="${day}"]`);
        if (dayElement) {
            // 添加动画效果
            dayElement.style.animation = 'pulse 0.5s ease-in-out';
            
            // 显示奖励弹窗
            this.showToast(`Sign in successful! +${[50, 100, 150, 200, 300, 500, 1000][day-1]} Gold`, 'success');
            
            // 重置动画
            setTimeout(() => {
                dayElement.style.animation = '';
            }, 500);
        }
    },

    // ========== 相册功能 ==========
    
    initAlbum(newlyOpenedIndex = -1) {
        const container = document.getElementById('albumCards');
        if (!container) return;

        const state = StateManager.get();
        const icons = ['👑','💎','🏰','🎲','🃏','🔮','✨','🌟','💫','⚜️',
                      '🏆','🎁','🏵️','🌸','🌺','🌻','🥇','🥈','🥉','🎖️',
                      '🕌','🏯','🎭','⚱️','🪔','🏺','🪙','📜','🗺️','⛲',
                      '💍','⚖️','🛡️','🗝️','🎯','🎨','🎷','🪕','📿','⚔️'];

        container.innerHTML = '';
        state.album.forEach((collected, idx) => {
            const card = document.createElement('div');
            // 只有当卡片是新打开的时候才添加collected类和动画类
            const isNewlyOpened = idx === newlyOpenedIndex;
            const isCollected = collected;
            const cardClasses = ['album-card'];
            
            if (isCollected) {
                cardClasses.push('collected');
                // 只有新打开的卡片才添加动画类
                if (isNewlyOpened) {
                    cardClasses.push('newly-opened');
                }
            }
            
            card.className = cardClasses.join(' ');
            card.style.cssText = `
                aspect-ratio: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                background: ${isCollected ? 'linear-gradient(145deg, rgba(212,175,55,0.3), rgba(212,175,55,0.1))' : 'rgba(255,255,255,0.05)'};
                border-radius: 8px;
                border: 1px solid ${isCollected ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.1)'};
                font-size: 1.25rem;
                cursor: ${isCollected ? 'default' : 'pointer'};
                transition: all 0.3s ease;
                ${isNewlyOpened ? 'animation: cardReveal 0.6s ease-out forwards;' : ''}
            `;
            card.innerHTML = isCollected ? icons[idx] : '?';
            container.appendChild(card);
        });

        const collectedCount = state.album.filter(Boolean).length;
        const collectedEl = document.getElementById('albumCollected');
        const totalEl = document.getElementById('albumTotal');
        
        if (collectedEl) collectedEl.textContent = collectedCount;
        if (totalEl) totalEl.textContent = icons.length;

        const openBtn = document.getElementById('openCardPackBtn');
        if (openBtn) {
            openBtn.disabled = state.cardPacks <= 0;
            openBtn.style.opacity = state.cardPacks <= 0 ? '0.5' : '1';
        }
    },

    openCardPack() {
        const state = StateManager.get();
        if (state.cardPacks <= 0) {
            return;
        }

        const lockedIndices = state.album
            .map((collected, idx) => collected ? -1 : idx)
            .filter(idx => idx !== -1);

        let newlyOpenedIndex = -1;

        if (lockedIndices.length === 0) {
            StateManager.set('gold', state.gold + 500);
            StateManager.set('cardPacks', state.cardPacks - 1);
        } else {
            newlyOpenedIndex = lockedIndices[Math.floor(Math.random() * lockedIndices.length)];
            const album = [...state.album];
            album[newlyOpenedIndex] = true;
            StateManager.set('album', album);
            StateManager.set('cardPacks', state.cardPacks - 1);
        }

        this.updateHomeStats();
        this.initAlbum(newlyOpenedIndex);
    },

    // ========== 支付流程 ==========
    
    // 处理包选择
    selectPackage(price, isRoyalPass = false) {
        const packages = {
            '0.99': { name: 'Starter Pack', description: '100 Gold', price: '$0.99' },
            '4.99': { name: isRoyalPass ? 'Royal Pass Subscription' : 'Royal Pack', description: isRoyalPass ? 'Monthly subscription with daily rewards' : '550 Gold + 1 Card Pack', price: '$4.99' },
            '9.99': { name: 'Imperial Pack', description: '1200 Gold + 3 Card Packs', price: '$9.99' }
        };
        
        const selectedPackage = packages[price];
        if (selectedPackage) {
            // 存储选择的包
            StateManager.set('selectedPackage', selectedPackage);
            StateManager.set('isRoyalPassPurchase', isRoyalPass);
            
            // 更新订单确认页面的信息
            document.getElementById('confirmPackageName').textContent = selectedPackage.name;
            document.getElementById('confirmPackagePrice').textContent = selectedPackage.price;
            document.getElementById('confirmTotalPrice').textContent = selectedPackage.price;
            
            // 跳转到订单确认页面
            this.switchPage('orderConfirmPage');
        }
    },
    
    // 处理支付方式选择
    selectPaymentMethod(method) {
        // 重置所有选择状态
        document.querySelectorAll('#cardPaymentOption, #paypalPaymentOption, #googlePaymentOption, #applePaymentOption').forEach(option => {
            option.style.borderColor = 'transparent';
            option.style.background = 'linear-gradient(145deg, rgba(26,26,46,.8), rgba(26,26,46,.6))';
            option.style.boxShadow = 'none';
        });
        
        document.querySelectorAll('#cardPaymentCheck, #paypalPaymentCheck, #googlePaymentCheck, #applePaymentCheck').forEach(check => {
            check.style.opacity = '0';
            check.style.color = '';
        });
        
        // 设置选中状态
        const optionElement = document.getElementById(`${method}PaymentOption`);
        const checkElement = document.getElementById(`${method}PaymentCheck`);
        
        if (optionElement && checkElement) {
            optionElement.style.borderColor = 'var(--gold-primary)';
            optionElement.style.background = 'linear-gradient(145deg, rgba(212,175,55,.15), rgba(26,26,46,.8))';
            optionElement.style.boxShadow = '0 0 20px rgba(212,175,55,.3)';
            checkElement.style.opacity = '1';
            checkElement.style.color = 'var(--gold-primary)';
            
            // 存储选择的支付方式
            StateManager.set('selectedPaymentMethod', method);
        }
    },
    
    // 恢复支付方式选中状态
    restorePaymentMethodSelection() {
        const selectedMethod = StateManager.get('selectedPaymentMethod');
        if (selectedMethod) {
            // 直接操作DOM，确保选中状态正确设置
            document.querySelectorAll('#cardPaymentOption, #paypalPaymentOption, #googlePaymentOption, #applePaymentOption').forEach(option => {
                option.style.borderColor = 'transparent';
                option.style.background = 'linear-gradient(145deg, rgba(26,26,46,.8), rgba(26,26,46,.6))';
                option.style.boxShadow = 'none';
            });
            
            document.querySelectorAll('#cardPaymentCheck, #paypalPaymentCheck, #googlePaymentCheck, #applePaymentCheck').forEach(check => {
                check.style.opacity = '0';
                check.style.color = '';
            });
            
            // 设置选中状态
            const optionElement = document.getElementById(`${selectedMethod}PaymentOption`);
            const checkElement = document.getElementById(`${selectedMethod}PaymentCheck`);
            
            if (optionElement && checkElement) {
                optionElement.style.borderColor = 'var(--gold-primary)';
                optionElement.style.background = 'linear-gradient(145deg, rgba(212,175,55,.15), rgba(26,26,46,.8))';
                optionElement.style.boxShadow = '0 0 20px rgba(212,175,55,.3)';
                checkElement.style.opacity = '1';
                checkElement.style.color = 'var(--gold-primary)';
            }
        }
    },
    
    // 处理支付流程
    processPayment() {
        const selectedMethod = StateManager.get('selectedPaymentMethod');
        if (!selectedMethod) {
            this.showToast('Please select a payment method', 'error');
            return;
        }
        
        const selectedPackage = StateManager.get('selectedPackage') || { price: '$4.99' };
        const price = selectedPackage.price;
        
        // 根据选择的支付方式进行处理
        switch (selectedMethod) {
            case 'card':
                this.showCardPaymentModal();
                break;
            case 'paypal':
                // 更新PayPal页面金额
                document.getElementById('paypalAmount').textContent = price;
                document.getElementById('paypalTotal').textContent = price;
                this.switchPage('paypalPaymentPage');
                break;
            case 'google':
                // 更新Google Pay页面金额
                document.getElementById('googleAmount').textContent = price;
                document.getElementById('googleTotal').textContent = price;
                this.switchPage('googlePaymentPage');
                break;
            case 'apple':
                // 更新Apple Pay页面金额
                document.getElementById('appleAmount').textContent = price;
                document.getElementById('appleTotal').textContent = price;
                this.switchPage('applePaymentPage');
                break;
            default:
                this.showToast('Invalid payment method', 'error');
        }
    },
    
    // 显示卡片支付模态框
    showCardPaymentModal() {
        const modal = document.getElementById('cardPaymentModal');
        if (modal) {
            modal.classList.remove('hide');
        }
    },
    
    // 处理卡片支付
    handleCardPayment(event) {
        event.preventDefault();
        
        const cardNumber = document.getElementById('cardNumber').value.trim();
        const cardExpiry = document.getElementById('cardExpiry').value.trim();
        const cardCVV = document.getElementById('cardCVV').value.trim();
        
        // 简单验证
        let isValid = true;
        
        if (!cardNumber) {
            document.getElementById('cardNumberError').textContent = 'Please enter card number';
            document.getElementById('cardNumberError').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('cardNumberError').style.display = 'none';
        }
        
        if (!cardExpiry) {
            document.getElementById('cardExpiryError').textContent = 'Please enter expiry date';
            document.getElementById('cardExpiryError').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('cardExpiryError').style.display = 'none';
        }
        
        if (!cardCVV) {
            document.getElementById('cardCVVError').textContent = 'Please enter CVV';
            document.getElementById('cardCVVError').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('cardCVVError').style.display = 'none';
        }
        
        if (isValid) {
            // 模拟支付处理
            this.hideModal('cardPaymentModal');
            this.showToast('Processing payment...', 'info');
            
            setTimeout(() => {
                this.showPaymentResult(true, 'Credit Card');
            }, 1500);
        }
    },
    
    // 模拟PayPal支付
    simulatePayPalPayment() {
        this.showToast('Redirecting to PayPal...', 'info');
        setTimeout(() => {
            this.showPaymentResult(true, 'PayPal');
        }, 1500);
    },
    
    // 模拟PayPal guest支付
    simulatePayPalGuestPayment() {
        this.showToast('Redirecting to PayPal...', 'info');
        setTimeout(() => {
            this.showPaymentResult(true, 'PayPal (Guest)');
        }, 1500);
    },
    
    // 模拟Google Pay
    simulateGooglePay() {
        this.showToast('Processing with Google Pay...', 'info');
        setTimeout(() => {
            this.showPaymentResult(true, 'Google Pay');
        }, 1500);
    },
    
    // 模拟Apple Pay
    simulateApplePay() {
        this.showToast('Processing with Apple Pay...', 'info');
        setTimeout(() => {
            this.showPaymentResult(true, 'Apple Pay');
        }, 1500);
    },
    
    // 显示支付结果
    showPaymentResult(success, paymentMethod) {
        const selectedPackage = StateManager.get('selectedPackage') || { name: 'Royal Pack', price: '$4.99' };
        const isRoyalPassPurchase = StateManager.get('isRoyalPassPurchase') || false;
        
        // 获取用户信息
        const state = StateManager.get();
        const customerName = state.userFirstName && state.userLastName ? `${state.userFirstName} ${state.userLastName}` : state.userName || 'Guest';
        
        // 更新结果页面信息
        document.getElementById('resultPackageName').textContent = selectedPackage.name;
        document.getElementById('resultAmount').textContent = selectedPackage.price;
        document.getElementById('resultPaymentMethod').textContent = paymentMethod;
        document.getElementById('orderId').textContent = `RL${Math.floor(Math.random() * 1000000)}`;
        document.getElementById('resultDate').textContent = new Date().toLocaleDateString();
        document.getElementById('resultCustomerName').textContent = customerName;
        
        // 显示成功或失败状态
        if (success) {
            document.getElementById('paymentSuccessIcon').style.display = 'block';
            document.getElementById('paymentErrorIcon').style.display = 'none';
            document.getElementById('paymentResultTitle').textContent = 'Payment Successful!';
            document.getElementById('paymentResultMessage').textContent = 'Your order has been processed successfully.';
            
            // 处理奖励发放
            const state = StateManager.get();
            let updates = {};
            
            if (isRoyalPassPurchase) {
                // 皇家订阅逻辑
                updates.isRoyalPassActive = true;
                updates.royalPassExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30天有效期
                updates.gold = state.gold + 1000; // 订阅奖励
                updates.cardPacks = state.cardPacks + 2;
                this.showToast('Royal Pass activated! Enjoy exclusive benefits!', 'success');
            } else {
                // 普通包逻辑
                const price = selectedPackage.price.replace('$', '');
                const rewards = {
                    '0.99': { gold: 100 },
                    '4.99': { gold: 550, cardPacks: 1 },
                    '9.99': { gold: 1200, cardPacks: 3 }
                };
                
                const reward = rewards[price];
                if (reward) {
                    updates = { gold: state.gold + (reward.gold || 0) };
                    if (reward.cardPacks) updates.cardPacks = state.cardPacks + reward.cardPacks;
                    this.showToast('Payment successful!', 'success');
                }
            }
            
            if (Object.keys(updates).length > 0) {
                StateManager.batchUpdate(updates);
                this.updateHomeStats();
            }
        } else {
            document.getElementById('paymentSuccessIcon').style.display = 'none';
            document.getElementById('paymentErrorIcon').style.display = 'block';
            document.getElementById('paymentResultTitle').textContent = 'Payment Failed';
            document.getElementById('paymentResultMessage').textContent = 'Your payment was not processed. Please try again.';
        }
        
        // 跳转到结果页面
        this.switchPage('paymentResultPage');
    },
    
    // 返回按钮函数
    backToPayment() {
        this.switchPage('paymentPage');
    },
    
    backToOrderConfirm() {
        this.switchPage('orderConfirmPage');
    },
    
    backToPaymentMethod() {
        this.switchPage('paymentMethodPage');
    },
    
    backToShop() {
        this.switchPage('paymentPage');
    },

    // ========== 年龄验证和登录 ==========
    
    handleLogin(event) {
        event.preventDefault();
        
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        // 验证表单
        const isValid = this.validateLoginForm(username, password);
        if (!isValid) return;
        
        // 模拟登录
        StateManager.set('isLoggedIn', true);
        StateManager.set('loginType', 'email');
        StateManager.set('userName', username);
        StateManager.set('lastLogin', new Date().toISOString());
        
        if (rememberMe) {
            StateManager.set('rememberMe', true);
        }
        
        this.showToast('Login successful!', 'success');
        this.switchPage('homePage');
    },
    
    handleRegister(event) {
        event.preventDefault();
        
        const username = document.getElementById('registerUsername').value.trim();
        const firstName = document.getElementById('registerFirstName').value.trim();
        const lastName = document.getElementById('registerLastName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const country = document.getElementById('registerCountry').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        
        // 验证表单
        const isValid = this.validateRegisterForm(username, firstName, lastName, email, country, password, confirmPassword);
        if (!isValid) return;
        
        // 模拟注册
        StateManager.set('isLoggedIn', true);
        StateManager.set('loginType', 'email');
        StateManager.set('userName', username);
        StateManager.set('userFirstName', firstName);
        StateManager.set('userLastName', lastName);
        StateManager.set('userEmail', email);
        StateManager.set('userCountry', country);
        StateManager.set('lastLogin', new Date().toISOString());
        
        this.showToast('Account created successfully!', 'success');
        this.switchPage('homePage');
    },
    
    validateLoginForm(username, password) {
        let isValid = true;
        
        // 验证用户名/邮箱
        if (!username) {
            this.showError('loginUsernameError', 'Please enter your username or email');
            isValid = false;
        } else {
            this.hideError('loginUsernameError');
        }
        
        // 验证密码
        if (!password) {
            this.showError('loginPasswordError', 'Please enter your password');
            isValid = false;
        } else {
            this.hideError('loginPasswordError');
        }
        
        return isValid;
    },
    
    validateRegisterForm(username, firstName, lastName, email, country, password, confirmPassword) {
        let isValid = true;
        
        // 验证用户名
        if (!username) {
            this.showError('registerUsernameError', 'Please choose a username');
            isValid = false;
        } else if (username.length < 3) {
            this.showError('registerUsernameError', 'Username must be at least 3 characters');
            isValid = false;
        } else {
            this.hideError('registerUsernameError');
        }
        
        // 验证FirstName
        if (!firstName) {
            this.showError('registerFirstNameError', 'Please enter your first name');
            isValid = false;
        } else {
            this.hideError('registerFirstNameError');
        }
        
        // 验证LastName
        if (!lastName) {
            this.showError('registerLastNameError', 'Please enter your last name');
            isValid = false;
        } else {
            this.hideError('registerLastNameError');
        }
        
        // 验证邮箱
        if (!email) {
            this.showError('registerEmailError', 'Please enter your email');
            isValid = false;
        } else if (!this.isValidEmail(email)) {
            this.showError('registerEmailError', 'Please enter a valid email address');
            isValid = false;
        } else {
            this.hideError('registerEmailError');
        }
        
        // 验证国家
        if (!country) {
            this.showError('registerCountryError', 'Please select your country');
            isValid = false;
        } else {
            this.hideError('registerCountryError');
        }
        
        // 验证密码
        if (!password) {
            this.showError('registerPasswordError', 'Please create a password');
            isValid = false;
        } else if (password.length < 6) {
            this.showError('registerPasswordError', 'Password must be at least 6 characters');
            isValid = false;
        } else {
            this.hideError('registerPasswordError');
        }
        
        // 验证确认密码
        if (!confirmPassword) {
            this.showError('registerConfirmPasswordError', 'Please confirm your password');
            isValid = false;
        } else if (password !== confirmPassword) {
            this.showError('registerConfirmPasswordError', 'Passwords do not match');
            isValid = false;
        } else {
            this.hideError('registerConfirmPasswordError');
        }
        
        return isValid;
    },
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    },
    
    hideError(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = 'none';
        }
    },
    
    showForgotPasswordModal() {
        const existingModal = document.getElementById('forgotPasswordModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'forgotPasswordModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3 style="text-align: center; margin-bottom: 24px; background: linear-gradient(135deg, #d4af37, #f4e4ba); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Forgot Password</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px; text-align: center;">Enter your email to reset your password</p>
                <form onsubmit="RoyalLegacyApp.handleForgotPassword(event)">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 500;">Email</label>
                        <input type="email" id="forgotEmail" placeholder="Enter your email" style="width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-md); color: var(--text-primary); font-size: 0.9375rem;">
                        <div id="forgotEmailError" style="color: var(--error); font-size: 0.75rem; margin-top: 4px; display: none;"></div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px 0; font-size: 1rem; margin-bottom: 12px;">Reset Password</button>
                    <button type="button" class="btn btn-secondary" style="width: 100%;" onclick="RoyalLegacyApp.hideModal('forgotPasswordModal')">Cancel</button>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hide'), 10);
    },
    
    handleForgotPassword(event) {
        event.preventDefault();
        
        const email = document.getElementById('forgotEmail').value.trim();
        
        if (!email) {
            this.showError('forgotEmailError', 'Please enter your email');
            return;
        } else if (!this.isValidEmail(email)) {
            this.showError('forgotEmailError', 'Please enter a valid email address');
            return;
        }
        
        // 模拟发送重置链接
        this.showToast('Password reset link sent to your email!', 'success');
        this.hideModal('forgotPasswordModal');
    },

    showParentConsentModal() {
        const existingModal = document.getElementById('parentConsentModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'parentConsentModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <h3 style="text-align: center; margin-bottom: 24px; background: linear-gradient(135deg, #d4af37, #f4e4ba); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Parent/Guardian Consent</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.6;">
                    This application is designed for children under 13. By providing consent, you acknowledge that you are the parent or legal guardian and agree to the terms of service and privacy policy in accordance with COPPA requirements.
                </p>
                <div style="background: rgba(107,78,230,0.1); border: 1px solid rgba(107,78,230,0.3); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                    <h4 style="color: var(--purple-light); margin-bottom: 12px; font-size: 1rem;">Important Information:</h4>
                    <ul style="list-style: disc; list-style-position: inside; color: var(--text-secondary); font-size: 0.875rem; line-height: 1.5;">
                        <li>Child mode restricts all payment options</li>
                        <li>No personal information is collected or shared</li>
                        <li>Game progress is stored locally on this device</li>
                        <li>Content is filtered for age-appropriate material</li>
                        <li>Parent dashboard available for monitoring</li>
                    </ul>
                </div>
                <button onclick="RoyalLegacyApp.parentConsentAgree()" class="btn btn-primary" style="width: 100%; margin-bottom: 12px;">I Agree (Parent/Guardian)</button>
                <button onclick="RoyalLegacyApp.parentConsentDecline()" class="btn btn-secondary" style="width: 100%;">Cancel</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hide'), 10);
    },

    parentConsentAgree() {
        const modal = document.getElementById('parentConsentModal');
        if (modal) modal.remove();
        
        // 家长确认后登录
        this.loginAnonymous();
    },

    parentConsentDecline() {
        const modal = document.getElementById('parentConsentModal');
        if (modal) modal.remove();
        
        // 重置年龄选择
        const ageOptions = document.querySelectorAll('input[name="age"]');
        ageOptions.forEach(option => option.checked = false);
        
        StateManager.set('ageMode', null);
        StateManager.set('isChildMode', false);
        StateManager.set('isTeenMode', false);
        StateManager.set('userAge', null);
    },



    showLoginModal() {
        const state = StateManager.get();
        const isAdultMode = state.ageMode === 'adult';
        const isTeenMode = state.isTeenMode;
        
        // 成人模式显示登录页面
        if (isAdultMode) {
            this.switchPage('loginPage');
            return;
        }
        
        // 青少年模式显示登录模态框
        const existingModal = document.getElementById('loginModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'loginModal';
        modal.className = 'modal';
        
        // 青少年模式只显示匿名登录
        const thirdPartyLogins = isTeenMode ? '' : `
            <button onclick="RoyalLegacyApp.loginGoogle()" class="btn btn-secondary" style="width: 100%; margin-bottom: 12px; justify-content: flex-start; padding: 16px;">
                <span style="font-size: 1.25rem; margin-right: 12px;">🔍</span>
                <span>Login with Google</span>
            </button>
            <button onclick="RoyalLegacyApp.loginApple()" class="btn btn-secondary" style="width: 100%; margin-bottom: 12px; justify-content: flex-start; padding: 16px;">
                <span style="font-size: 1.25rem; margin-right: 12px;">🍎</span>
                <span>Login with Apple</span>
            </button>
            <button onclick="RoyalLegacyApp.loginFacebook()" class="btn btn-secondary" style="width: 100%; margin-bottom: 12px; justify-content: flex-start; padding: 16px;">
                <span style="font-size: 1.25rem; margin-right: 12px;">📘</span>
                <span>Login with Facebook</span>
            </button>
        `;
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3 style="text-align: center; margin-bottom: 24px; background: linear-gradient(135deg, #d4af37, #f4e4ba); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Choose Login Method</h3>
                
                ${thirdPartyLogins}
                
                <button onclick="RoyalLegacyApp.loginAnonymous()" class="btn btn-secondary" style="width: 100%; margin-bottom: 12px; justify-content: flex-start; padding: 16px;">
                    <span style="font-size: 1.25rem; margin-right: 12px;">👤</span>
                    <span>Anonymous Login</span>
                </button>
                
                <p style="text-align: center; color: var(--text-secondary); font-size: 0.75rem; margin-top: 16px;">
                    ${isTeenMode ? 'Teen Mode: Only Anonymous Login is available' : 'Your progress will be saved locally'}
                </p>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hide'), 10);
    },

    loginApple() {
        // 模拟Apple登录
        StateManager.set('isLoggedIn', true);
        StateManager.set('loginType', 'apple');
        StateManager.set('userName', 'Apple User');
        StateManager.set('lastLogin', new Date().toISOString());
        
        const modal = document.getElementById('loginModal');
        if (modal) modal.remove();
        
        this.switchPage('homePage');
    },

    loginFacebook() {
        // 模拟Facebook登录
        StateManager.set('isLoggedIn', true);
        StateManager.set('loginType', 'facebook');
        StateManager.set('userName', 'Facebook User');
        StateManager.set('lastLogin', new Date().toISOString());
        
        const modal = document.getElementById('loginModal');
        if (modal) modal.remove();
        
        this.switchPage('homePage');
    },

    loginGoogle() {
        // 模拟Google登录
        StateManager.set('isLoggedIn', true);
        StateManager.set('loginType', 'google');
        StateManager.set('userName', 'Google User');
        StateManager.set('lastLogin', new Date().toISOString());
        
        const modal = document.getElementById('loginModal');
        if (modal) modal.remove();
        
        this.switchPage('homePage');
    },

    loginAnonymous() {
        StateManager.set('isLoggedIn', true);
        StateManager.set('loginType', 'anonymous');
        StateManager.set('userName', 'Guest');
        StateManager.set('lastLogin', new Date().toISOString());
        
        // 儿童模式下不存储任何个人信息
        const isChildMode = StateManager.get('isChildMode');
        if (isChildMode) {
            // 确保只存储必要的游戏数据
            this._cleanChildModeData();
            this._hidePaymentFeatures();
        }
        
        const modal = document.getElementById('loginModal');
        if (modal) modal.remove();
        
        this.switchPage('homePage');
    },

    _cleanChildModeData() {
        // 确保儿童模式下只存储必要的游戏数据
        const state = StateManager.get();
        const childSafeData = {
            userName: 'Guest',
            lastLogin: new Date().toISOString()
        };
        
        // 使用批量更新保存净化后的数据
        StateManager.batchUpdate(childSafeData);
    },

    // 家长数据管理功能
    showParentDataManager() {
        const existingModal = document.getElementById('parentDataModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'parentDataModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <h3 style="text-align: center; margin-bottom: 24px; background: linear-gradient(135deg, #d4af37, #f4e4ba); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Parent Data Management</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.6;">
                    As a parent or guardian, you can manage your child's game data and privacy settings.
                </p>
                <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
                    <button onclick="RoyalLegacyApp.viewChildData()" class="btn btn-secondary" style="width: 100%;">
                        👁️ View Child's Game Data
                    </button>
                    <button onclick="RoyalLegacyApp.resetChildData()" class="btn btn-secondary" style="width: 100%; color: var(--warning); border-color: var(--warning);">
                        🔄 Reset Game Progress
                    </button>
                    <button onclick="RoyalLegacyApp.deleteChildData()" class="btn btn-secondary" style="width: 100%; color: var(--error); border-color: var(--error);">
                        🗑️ Delete All Child Data
                    </button>
                </div>
                <button onclick="RoyalLegacyApp.hideModal('parentDataModal')" class="btn btn-gold" style="width: 100%;">Close</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hide'), 10);
    },

    viewChildData() {
        const state = StateManager.get();
        const existingModal = document.getElementById('childDataModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'childDataModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3 style="text-align: center; margin-bottom: 16px; background: linear-gradient(135deg, #d4af37, #f4e4ba); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Child's Game Data</h3>
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                    <p style="margin-bottom: 8px; color: var(--text-secondary);"><strong>Account Type:</strong> ${state.loginType || 'Anonymous'}</p>
                    <p style="margin-bottom: 8px; color: var(--text-secondary);"><strong>Age Mode:</strong> ${state.ageMode || 'N/A'}</p>
                    <p style="margin-bottom: 8px; color: var(--text-secondary);"><strong>Gold:</strong> ${state.gold || 0}</p>
                    <p style="margin-bottom: 8px; color: var(--text-secondary);"><strong>Stamina:</strong> ${state.stamina || 0}/${state.maxStamina || 10}</p>
                    <p style="margin-bottom: 8px; color: var(--text-secondary);"><strong>Card Packs:</strong> ${state.cardPacks || 0}</p>
                    <p style="margin-bottom: 8px; color: var(--text-secondary);"><strong>Total Stars:</strong> ${state.totalStars || 0}</p>
                    <p style="margin-bottom: 8px; color: var(--text-secondary);"><strong>Last Login:</strong> ${new Date(state.lastLogin || Date.now()).toLocaleString()}</p>
                </div>
                <p style="text-align: center; color: var(--text-muted); font-size: 0.75rem; margin-bottom: 20px;">
                    No personal information is stored for child accounts.
                </p>
                <button onclick="RoyalLegacyApp.hideModal('childDataModal')" class="btn btn-gold" style="width: 100%;">Close</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hide'), 10);
    },

    resetChildData() {
        this.showConfirmModal('Reset Game Progress', 'Are you sure you want to reset your child\'s game progress? This will reset all game data but preserve account settings.', () => {
            try {
                const result = DataManager.resetGameProgress('child');
                this.showToast(result.message, 'success');
                this.hideModal('parentDataModal');
                this.updateHomeStats();
            } catch (error) {
                console.error('Failed to reset child game progress:', error);
                this.showToast('Failed to reset game progress. Please try again.', 'error');
            }
        });
    },

    deleteChildData() {
        const deletionInfo = DataManager.getDeletionConfirmationMessage();
        
        this.showConfirmModal(deletionInfo.title, deletionInfo.message, async () => {
            try {
                const report = await DataManager.deleteAllUserData('child');
                this.showToast('All child data has been deleted', 'success');
                this.hideModal('parentDataModal');
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                console.error('Failed to delete child data:', error);
                this.showToast('Failed to delete child data. Please try again.', 'error');
            }
        }, true, deletionInfo);
    },

    _hidePaymentFeatures() {
        // 隐藏所有付费相关按钮
        const shopButtons = document.querySelectorAll('[onclick*="showPayModal"]');
        shopButtons.forEach(btn => {
            // 替换商店按钮为儿童模式专属按钮
            if (btn.textContent.includes('Shop')) {
                btn.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span style="font-size: 1.25rem;">💡</span>
                        <span>Game Tips</span>
                    </div>
                `;
                btn.onclick = () => this.showGameTips();
                btn.style.display = 'flex';
            } else {
                btn.style.display = 'none';
            }
        });
        
        // 隐藏皇家通行证
        const royalPass = document.querySelector('.glass-card');
        if (royalPass && royalPass.textContent.includes('Royal Pass')) {
            royalPass.innerHTML = `
                <h3 style="color: var(--gold-primary); margin-bottom: 8px; font-size: 1.25rem;">Kids Mode</h3>
                <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5;">Safe play mode with no in-app purchases</p>
                <div style="background: rgba(212,175,55,0.1); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px;">Kids Mode Features:</div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-size: 0.75rem; display: flex; align-items: center; gap: 6px;">
                            <span>🛡️</span>
                            <span>No in-app purchases</span>
                        </div>
                        <div style="font-size: 0.75rem; display: flex; align-items: center; gap: 6px;">
                            <span>🎮</span>
                            <span>Age-appropriate content</span>
                        </div>
                        <div style="font-size: 0.75rem; display: flex; align-items: center; gap: 6px;">
                            <span>👨‍👩‍👧‍👦</span>
                            <span>Parent controls available</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 隐藏游戏内道具购买按钮
        const gamePropButtons = document.querySelectorAll('[onclick*="useBomb"],[onclick*="refreshBoard"],[onclick*="addSteps"]');
        gamePropButtons.forEach(btn => {
            btn.style.display = 'none';
        });
        
        // 禁用支付页面访问 - 不再直接隐藏页面，而是通过切换active类控制
        // 这样可以确保在非儿童模式下支付页面能正常显示

    },
    
    showGameTips() {
        // 创建游戏提示模态框
        const existingModal = document.getElementById('gameTipsModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'gameTipsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3 style="text-align: center; margin-bottom: 16px; background: linear-gradient(135deg, #d4af37, #f4e4ba); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Game Tips</h3>
                <p style="text-align: center; color: var(--text-secondary); margin-bottom: 24px; font-size: 0.875rem;">Learn how to play better!</p>
                
                <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
                    <div class="glass-card" style="padding: 16px; margin-bottom: 0;">
                        <div style="font-size: 1.25rem; margin-bottom: 8px;">🎯</div>
                        <div style="font-weight: 600; margin-bottom: 4px;">Match 3 or More</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Match 3 or more identical tiles to clear them and score points.</div>
                    </div>
                    <div class="glass-card" style="padding: 16px; margin-bottom: 0;">
                        <div style="font-size: 1.25rem; margin-bottom: 8px;">⏱️</div>
                        <div style="font-weight: 600; margin-bottom: 4px;">Use Steps Wisely</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">You have limited steps to reach your goal. Plan your moves carefully!</div>
                    </div>
                    <div class="glass-card" style="padding: 16px; margin-bottom: 0;">
                        <div style="font-size: 1.25rem; margin-bottom: 8px;">🌟</div>
                        <div style="font-weight: 600; margin-bottom: 4px;">Earn Stars</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Score more points to earn up to 3 stars for each level.</div>
                    </div>
                    <div class="glass-card" style="padding: 16px; margin-bottom: 0;">
                        <div style="font-size: 1.25rem; margin-bottom: 8px;">⚡</div>
                        <div style="font-weight: 600; margin-bottom: 4px;">Stamina</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Stamina regenerates over time. Come back later if you run out!</div>
                    </div>
                </div>
                
                <button class="btn btn-gold" onclick="RoyalLegacyApp.hideModal('gameTipsModal')" style="width: 100%;">Got it!</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hide'), 10);
    },

    // 重写支付相关方法，确保儿童模式下无法访问
    showPayModal() {
        if (StateManager.get('isChildMode')) {
            this.showToast('Payment features are disabled in Child Mode', 'info');
            return;
        }
        
        this.switchPage('paymentPage');
    },

    useBomb() {
        if (StateManager.get('isChildMode')) {
            this.showToast('道具购买在儿童模式下已禁用', 'info');
            return;
        }
        
        const state = StateManager.get();
        if (state.gold < 50) {
            return;
        }

        StateManager.set('gold', state.gold - 50);
        
        const tiles = document.querySelectorAll('.tile');
        const randomIndices = [];
        for (let i = 0; i < 5; i++) {
            randomIndices.push(Math.floor(Math.random() * tiles.length));
        }
        
        randomIndices.forEach(idx => {
            const tile = tiles[idx];
            if (tile) {
                tile.style.animation = 'matchPop 0.3s ease-out';
            }
        });
        
        StateManager.set('score', state.score + 100);
        this.updateGameStats();
    },

    refreshBoard() {
        if (StateManager.get('isChildMode')) {
            this.showToast('道具购买在儿童模式下已禁用', 'info');
            return;
        }
        
        const state = StateManager.get();
        if (state.gold < 30) {
            return;
        }

        StateManager.set('gold', state.gold - 30);
        this.initGameBoard();
        this.updateGameStats();
    },

    addSteps() {
        if (StateManager.get('isChildMode')) {
            this.showToast('道具购买在儿童模式下已禁用', 'info');
            return;
        }
        
        const state = StateManager.get();
        if (state.gold < 100) {
            return;
        }

        StateManager.set('gold', state.gold - 100);
        StateManager.set('steps', state.steps + 5);
        this.updateGameStats();
    },

    // ========== 支付功能 ==========
    
    // 注意：selectPackage函数已在支付流程部分定义，这里不再重复定义


    processDirectPayment(pkg) {
        const state = StateManager.get();
        
        const rewards = {
            '0.99': { gold: 100 },
            '9.99': { gold: 1200, cardPacks: 3 }
        };

        const reward = rewards[pkg];
        if (!reward) return;

        const updates = { gold: state.gold + reward.gold };
        if (reward.cardPacks) updates.cardPacks = state.cardPacks + reward.cardPacks;
        
        StateManager.batchUpdate(updates);
        this.switchPage('homePage');
        this.updateHomeStats();
    },

    showPaymentMethodModal(pkg, isRoyalPass = false) {
        const existingModal = document.getElementById('paymentMethodModal');
        if (existingModal) existingModal.remove();
        
        // 重置支付方式选择
        StateManager.set('selectedPaymentMethod', null);
        
        let pkgName, description;
        if (isRoyalPass) {
            pkgName = 'Royal Pass Subscription';
            description = 'Daily rewards and exclusive benefits';
        } else {
            const pkgNames = {
                '0.99': 'Starter Pack',
                '4.99': 'Royal Pack',
                '9.99': 'Imperial Pack'
            };
            const pkgDescriptions = {
                '0.99': '100 Gold',
                '4.99': '550 Gold + 1 Card Pack',
                '9.99': '1200 Gold + 3 Card Packs'
            };
            pkgName = pkgNames[pkg] || 'Package';
            description = pkgDescriptions[pkg] || '';
        }
        
        const modal = document.createElement('div');
        modal.id = 'paymentMethodModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3 style="text-align: center; margin-bottom: 8px; background: linear-gradient(135deg, #d4af37, #f4e4ba); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${isRoyalPass ? 'Royal Pass Subscription' : 'Select Payment'}</h3>
                <p style="text-align: center; color: rgba(255,255,255,0.7); margin-bottom: 8px; font-size: 0.875rem;">${pkgName}</p>
                <p style="text-align: center; color: rgba(255,255,255,0.5); margin-bottom: 20px; font-size: 0.75rem;">${description} - $${pkg} ${isRoyalPass ? '/ month' : ''}</p>
                
                <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                    <button onclick="RoyalLegacyApp.selectModalPaymentMethod('paypal')" class="btn btn-secondary payment-method-btn" data-method="paypal" style="justify-content: flex-start; padding: 16px;">
                        <span style="font-size: 1.25rem; margin-right: 12px;">💳</span>
                        <span>Pay with PayPal</span>
                    </button>
                    <button onclick="RoyalLegacyApp.selectModalPaymentMethod('card')" class="btn btn-secondary payment-method-btn" data-method="card" style="justify-content: flex-start; padding: 16px;">
                        <span style="font-size: 1.25rem; margin-right: 12px;">💳</span>
                        <span>Pay with Debit/Credit Card</span>
                    </button>
                    <button onclick="RoyalLegacyApp.selectModalPaymentMethod('apple')" class="btn btn-secondary payment-method-btn" data-method="apple" style="justify-content: flex-start; padding: 16px;">
                        <span style="font-size: 1.25rem; margin-right: 12px;">🍎</span>
                        <span>Apple Pay</span>
                    </button>
                    <button onclick="RoyalLegacyApp.selectModalPaymentMethod('google')" class="btn btn-secondary payment-method-btn" data-method="google" style="justify-content: flex-start; padding: 16px;">
                        <span style="font-size: 1.25rem; margin-right: 12px;">🤖</span>
                        <span>Google Pay</span>
                    </button>
                </div>
                
                <button class="btn btn-gold" onclick="RoyalLegacyApp.processPayment()" style="width: 100%; margin-bottom: 10px;">${isRoyalPass ? 'Subscribe Now' : 'Pay Now'}</button>
                <button class="btn btn-secondary" onclick="RoyalLegacyApp.closePaymentModal()" style="width: 100%;">Cancel</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hide'), 10);
    },

    selectModalPaymentMethod(method) {
        StateManager.set('selectedPaymentMethod', method);
        
        document.querySelectorAll('.payment-method-btn').forEach(btn => {
            btn.style.borderColor = 'rgba(255,255,255,0.2)';
            btn.style.background = 'rgba(255,255,255,0.1)';
        });
        
        const selected = document.querySelector(`[data-method="${method}"]`);
        if (selected) {
            selected.style.borderColor = '#d4af37';
            selected.style.background = 'rgba(212,175,55,0.2)';
        }
    },

    closePaymentModal() {
        const modal = document.getElementById('cardPaymentModal');
        if (modal) {
            modal.classList.add('hide');
        }
    },

    backToShop() {
        this.switchPage('homePage');
    },

    // ========== 设置功能 ==========
    
    showSettingsModal() {
        const existingModal = document.getElementById('settingsModal');
        if (existingModal) existingModal.remove();
        
        const state = StateManager.get();
        
        const modal = document.createElement('div');
        modal.id = 'settingsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3 style="text-align: center; margin-bottom: 24px; background: linear-gradient(135deg, #d4af37, #f4e4ba); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Settings</h3>
                
                <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">
                        <span>High Contrast Mode</span>
                        <button onclick="RoyalLegacyApp.toggleSetting('highContrast')" class="toggle-btn ${state.highContrast ? 'active' : ''}" style="width: 50px; height: 26px; border-radius: 13px; background: ${state.highContrast ? '#22c55e' : 'rgba(255,255,255,0.2)'}; border: none; cursor: pointer; position: relative; transition: all 0.3s;">
                            <span style="position: absolute; top: 3px; ${state.highContrast ? 'right: 3px' : 'left: 3px'}; width: 20px; height: 20px; background: white; border-radius: 50%; transition: all 0.3s;"></span>
                        </button>
                    </div>
                    
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">
                        <span>Reduced Motion</span>
                        <button onclick="RoyalLegacyApp.toggleSetting('reducedMotion')" class="toggle-btn ${state.reducedMotion ? 'active' : ''}" style="width: 50px; height: 26px; border-radius: 13px; background: ${state.reducedMotion ? '#22c55e' : 'rgba(255,255,255,0.2)'}; border: none; cursor: pointer; position: relative; transition: all 0.3s;">
                            <span style="position: absolute; top: 3px; ${state.reducedMotion ? 'right: 3px' : 'left: 3px'}; width: 20px; height: 20px; background: white; border-radius: 50%; transition: all 0.3s;"></span>
                        </button>
                    </div>
                    
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">
                        <span>Large Text</span>
                        <button onclick="RoyalLegacyApp.toggleSetting('largeText')" class="toggle-btn ${state.largeText ? 'active' : ''}" style="width: 50px; height: 26px; border-radius: 13px; background: ${state.largeText ? '#22c55e' : 'rgba(255,255,255,0.2)'}; border: none; cursor: pointer; position: relative; transition: all 0.3s;">
                            <span style="position: absolute; top: 3px; ${state.largeText ? 'right: 3px' : 'left: 3px'}; width: 20px; height: 20px; background: white; border-radius: 50%; transition: all 0.3s;"></span>
                        </button>
                    </div>
                    
                    <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">
                        <span>Sound Effects</span>
                        <button onclick="RoyalLegacyApp.toggleSetting('soundEnabled')" class="toggle-btn ${state.soundEnabled ? 'active' : ''}" style="width: 50px; height: 26px; border-radius: 13px; background: ${state.soundEnabled ? '#22c55e' : 'rgba(255,255,255,0.2)'}; border: none; cursor: pointer; position: relative; transition: all 0.3s;">
                            <span style="position: absolute; top: 3px; ${state.soundEnabled ? 'right: 3px' : 'left: 3px'}; width: 20px; height: 20px; background: white; border-radius: 50%; transition: all 0.3s;"></span>
                        </button>
                    </div>
                </div>
                
                ${state.isLoggedIn ? `
                <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin-bottom: 20px;">
                    <h4 style="color: var(--gold-primary); margin-bottom: 12px; font-size: 0.875rem;">Account</h4>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <span style="font-size: 1.5rem;">${state.loginType === 'google' ? '🔍' : '👤'}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text-primary);">${state.userName || 'Guest'}</div>
                            ${state.userFirstName && state.userLastName ? `<div style="font-size: 0.75rem; color: var(--text-secondary);">${state.userFirstName} ${state.userLastName}</div>` : ''}
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${state.loginType === 'google' ? 'Google Account' : state.loginType === 'email' ? 'Email Account' : 'Anonymous Account'}</div>
                        </div>
                    </div>
                    ${state.isChildMode ? `
                    <button onclick="RoyalLegacyApp.showParentDataManager()" class="btn btn-secondary" style="width: 100%; margin-bottom: 12px; color: var(--purple-light); border-color: var(--purple-light);">👨‍👩‍👧‍👦 Parent Data Management</button>
                    ` : ''}
                    <button onclick="RoyalLegacyApp.logout()" class="btn btn-secondary" style="width: 100%; color: var(--warning); border-color: var(--warning);">🚪 Logout</button>
                </div>
                ` : ''}
                
                <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin-bottom: 20px;">
                    <h4 style="color: #ef4444; margin-bottom: 12px; font-size: 0.875rem;">Danger Zone</h4>
                    <button onclick="RoyalLegacyApp.clearAllData()" class="btn btn-secondary" style="width: 100%; color: #ef4444; border-color: #ef4444;">🗑️ Clear All Data</button>
                </div>
                
                <button class="btn btn-gold" onclick="RoyalLegacyApp.hideModal('settingsModal')" style="width: 100%;">Close</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.remove('hide'), 10);
    },

    toggleSetting(setting) {
        const state = StateManager.get();
        const currentValue = state[setting];
        StateManager.set(setting, !currentValue);
        
        if (setting === 'largeText') {
            // 使用body类来控制大字体模式，更高效且易于管理
            if (!currentValue) {
                document.body.classList.add('large-text');
            } else {
                document.body.classList.remove('large-text');
            }
        }
        if (setting === 'highContrast') {
            // 适度增加对比度
            document.body.style.filter = !currentValue ? 'contrast(1.2)' : '';
            // 调整背景和文字颜色，保持舒适度
            document.body.style.backgroundColor = !currentValue ? '#0a0a0f' : '';
            document.body.style.color = !currentValue ? '#ffffff' : '';
            // 增强玻璃卡片的对比度
            document.querySelectorAll('.glass-card').forEach(card => {
                card.style.background = !currentValue ? 'rgba(26,26,46,0.9)' : '';
                card.style.borderColor = !currentValue ? 'rgba(212,175,55,0.6)' : '';
            });
            // 增强按钮对比度
            document.querySelectorAll('.btn').forEach(btn => {
                btn.style.borderWidth = !currentValue ? '2px' : '';
            });
            // 确保文字清晰可读
            document.querySelectorAll('p, span, div').forEach(elem => {
                elem.style.color = !currentValue ? '#ffffff' : '';
            });
        }
        if (setting === 'reducedMotion') {
            // 减少动画效果
            document.body.style.animation = !currentValue ? 'none' : '';
            document.body.style.transition = !currentValue ? 'none' : '';
            // 禁用所有元素的动画
            document.querySelectorAll('*').forEach(elem => {
                elem.style.animation = !currentValue ? 'none' : '';
                elem.style.transition = !currentValue ? 'none' : '';
            });
        }
        
        this.hideModal('settingsModal');
        setTimeout(() => this.showSettingsModal(), 100);
    },

    clearAllData() {
        const deletionInfo = DataManager.getDeletionConfirmationMessage();
        
        this.showConfirmModal(deletionInfo.title, deletionInfo.message, async () => {
            try {
                // 使用DataManager删除所有用户数据
                const report = await DataManager.deleteAllUserData();
                
                // 生成清理报告
                const cleanupReport = `
=== Data Cleanup Report ===
Timestamp: ${report.timestamp}

Items Removed:
- LocalStorage: ${report.itemsRemoved.localStorage}
- SessionStorage: ${report.itemsRemoved.sessionStorage}
- IndexedDB: ${report.itemsRemoved.indexedDB}
- Cache: ${report.itemsRemoved.cache}

Verification:
- Has game data: ${report.verification.localStorage.hasGameData}
- Has related items: ${report.verification.localStorage.hasRelatedItems}
- Related items: ${report.verification.localStorage.relatedItems.join(', ') || 'None'}

Status: ${report.status === 'SUCCESS' ? 'SUCCESS - All game data removed' : 'WARNING - Some items may remain'}
`;
                
                console.log(cleanupReport);
                
                // 显示清理完成提示
                this.showToast('All game data has been cleared successfully', 'success');
                
                // 延迟刷新页面，让用户看到提示
                setTimeout(() => {
                    location.reload();
                }, 1500);
                
            } catch (error) {
                console.error('Failed to clear all data:', error);
                this.showToast('Failed to clear all data. Please try again.', 'error');
            }
        }, true, deletionInfo);
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    _handleInitError(error) {
        console.error('Application initialization failed:', error);
        document.body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:20px;text-align:center;background:#0a0a0f;color:white;">
                <h1 style="color:#d4af37;margin-bottom:16px;">⚠️ Error</h1>
                <p style="color:rgba(255,255,255,0.7);margin-bottom:24px;">Failed to initialize the game. Please refresh the page.</p>
                <button onclick="location.reload()" style="padding:12px 24px;background:#d4af37;color:#0a0a0f;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Refresh Page</button>
            </div>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    RoyalLegacyApp.init();
});

window.RoyalLegacyApp = RoyalLegacyApp;
