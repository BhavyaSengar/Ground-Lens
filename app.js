import { animate, scroll, inView, stagger } from 'motion';

/* app.js */
document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const navLinks = document.getElementById('nav-links');
    const navProfile = document.getElementById('nav-profile');
    const themeToggle = document.getElementById('theme-toggle');

    let currentUser = null; // Mock user
    let currentRole = 'user'; // 'user' or 'doer'
    let currentDashView = 'dashboard';

    // Mock notification data
    let notifications = [
        { id: 1, title: 'Task Accepted', message: 'Scout "Elena S." accepted your task "Verify Central Park Cafe"', time: '2 min ago', read: false, icon: 'fa-solid fa-check-circle', color: '#10b981' },
        { id: 2, title: 'Photo Uploaded', message: 'New verified photo for "Seattle Waterfront Check" is ready for review', time: '15 min ago', read: false, icon: 'fa-solid fa-camera', color: '#6366f1' },
        { id: 3, title: 'Payment Received', message: 'You received $25.00 for completing "Brooklyn Bridge Snap"', time: '1 hr ago', read: false, icon: 'fa-solid fa-dollar-sign', color: '#f59e0b' },
        { id: 4, title: 'New Scout Nearby', message: 'A new verified scout is now active in your area', time: '3 hrs ago', read: true, icon: 'fa-solid fa-user-plus', color: '#06b6d4' },
        { id: 5, title: 'Task Completed', message: '"Times Square Crowd Check" has been marked as complete', time: '5 hrs ago', read: true, icon: 'fa-solid fa-flag-checkered', color: '#a855f7' },
        { id: 6, title: 'System Update', message: 'GroundLens v2.4 is now live with faster GPS verification', time: '1 day ago', read: true, icon: 'fa-solid fa-rocket', color: '#ec4899' },
    ];

    // Mock transaction data
    const transactions = [
        { id: 'TXN-3847', type: 'credit', desc: 'Task Payment - Central Park', amount: '+$25.00', date: 'Feb 28, 2026', status: 'Completed' },
        { id: 'TXN-3846', type: 'debit', desc: 'Task Posted - Seattle Pier', amount: '-$15.00', date: 'Feb 27, 2026', status: 'Completed' },
        { id: 'TXN-3845', type: 'credit', desc: 'Refund - Cancelled Task', amount: '+$10.00', date: 'Feb 26, 2026', status: 'Completed' },
        { id: 'TXN-3844', type: 'debit', desc: 'Task Posted - Brooklyn Bridge', amount: '-$20.00', date: 'Feb 25, 2026', status: 'Completed' },
        { id: 'TXN-3843', type: 'credit', desc: 'Task Payment - Wall Street', amount: '+$30.00', date: 'Feb 24, 2026', status: 'Completed' },
    ];

    // Theme toggle
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });

    // Router function
    window.renderView = function (viewName) {
        mainContent.innerHTML = '';

        let templateId = '';
        switch (viewName) {
            case 'home':
                templateId = 'tmpl-home';
                break;
            case 'login':
            case 'loginForm':
                templateId = 'tmpl-login-form';
                break;
            case 'registerForm':
                templateId = 'tmpl-register-form';
                break;
            case 'dashboard':
                templateId = currentRole === 'doer' ? 'tmpl-doer-dashboard' : 'tmpl-full-dashboard';
                break;
            case 'createTask':
                templateId = 'tmpl-create-task';
                break;
            default:
                templateId = 'tmpl-home';
        }

        const template = document.getElementById(templateId);
        if (template) {
            mainContent.appendChild(template.content.cloneNode(true));
            attachEvents(viewName);
        } else {
            console.error(`Template ${templateId} not found`);
        }

        updateNav();
    };

    function updateNav() {
        if (!navLinks || !navProfile) return;
        navLinks.innerHTML = '';
        navProfile.innerHTML = '';

        if (currentUser) {
            navLinks.innerHTML = `
                <a href="#" onclick="renderView('dashboard'); return false;" style="text-decoration:none; color:var(--text-main); font-weight:600;">Dashboard</a>
            `;
            navProfile.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:32px; height:32px; border-radius:50%; background:var(--brand-cyan); color:white; display:flex; align-items:center; justify-content:center;">${currentUser.name[0]}</div>
                    <button onclick="logout()" class="btn-magnetic" style="background:transparent; border:1px solid var(--glass-border-strong); color:var(--text-main); padding:0.5rem 1rem; border-radius:8px; cursor:pointer;">Logout</button>
                </div>
            `;
        } else {
            navLinks.innerHTML = `
                <a href="#how-it-works" onclick="renderView('home'); return false;" style="text-decoration:none; color:var(--text-muted); font-size: 0.95rem; font-weight:500; transition: color 0.3s ease;" onmouseover="this.style.color='var(--text-main)';" onmouseout="this.style.color='var(--text-muted)';">How It Works</a>
                <a href="#trust" onclick="renderView('home'); return false;" style="text-decoration:none; color:var(--text-muted); font-size: 0.95rem; font-weight:500; transition: color 0.3s ease;" onmouseover="this.style.color='var(--text-main)';" onmouseout="this.style.color='var(--text-muted)';">Trust</a>
                <a href="#use-cases" onclick="renderView('home'); return false;" style="text-decoration:none; color:var(--text-muted); font-size: 0.95rem; font-weight:500; transition: color 0.3s ease;" onmouseover="this.style.color='var(--text-main)';" onmouseout="this.style.color='var(--text-muted)';">Use Cases</a>
            `;
            navProfile.innerHTML = `
                <button onclick="renderView('login')" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-weight:500; font-size: 0.95rem; transition: color 0.3s ease;" onmouseover="this.style.color='var(--text-main)';" onmouseout="this.style.color='var(--text-muted)';">Sign In</button>
                <button onclick="renderView('registerForm')" class="btn-magnetic ripple-button" style="background:linear-gradient(135deg, #06b6d4, #8b5cf6); color:white; border:none; padding:0.6rem 1.2rem; border-radius:30px; cursor:pointer; font-weight:600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);">
                    Get Started <i class="fa-solid fa-arrow-right" style="font-size: 0.8rem;"></i>
                </button>
            `;
        }
    }

    // =============================================
    //  INNER DASHBOARD ROUTER
    // =============================================
    function renderDashboardView(viewName) {
        currentDashView = viewName;
        const container = document.getElementById('dash-content');
        if (!container) return;

        // Update URL hash
        window.location.hash = `#/${viewName}`;

        // Update sidebar active state
        document.querySelectorAll('.dash-nav-item[data-view]').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            }
        });

        // Update notification badge
        updateNotificationBadge();

        // Transition out
        container.classList.remove('dash-content-enter');
        container.classList.add('dash-content-exit');

        setTimeout(() => {
            // Swap content
            switch (viewName) {
                case 'dashboard': container.innerHTML = buildDashboardHome(); break;
                case 'post-task': container.innerHTML = buildPostTask(); break;
                case 'notifications': container.innerHTML = buildNotifications(); break;
                case 'wallet': container.innerHTML = buildWallet(); break;
                case 'analytics': container.innerHTML = buildAnalytics(); break;
                default: container.innerHTML = buildDashboardHome();
            }

            // Transition in
            container.classList.remove('dash-content-exit');
            container.classList.add('dash-content-enter');

            // Attach sub-view events
            attachDashViewEvents(viewName);
        }, 150);
    }

    function updateNotificationBadge() {
        const badge = document.querySelector('.dash-nav-badge');
        if (!badge) return;
        const unread = notifications.filter(n => !n.read).length;
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';

        if (unread > 0) {
            badge.classList.add('pulse');
        } else {
            badge.classList.remove('pulse');
        }
    }

    // =============================================
    //  SUB-VIEW BUILDERS
    // =============================================
    function getGreeting() {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    }

    function buildDashboardHome() {
        const name = currentUser ? currentUser.name.split(' ')[0] : 'User';
        return `
        <!-- Header -->
        <div class="dash-header">
            <div>
                <h2 class="dash-greeting">${getGreeting()}, ${name} 🚀</h2>
                <p class="dash-greeting-sub">Manage your tasks and track progress</p>
            </div>
            <button class="dash-btn-post" id="dash-post-task-btn">
                <i class="fa-solid fa-plus"></i> Post Task
            </button>
        </div>

        <!-- Stats Cards -->
        <div class="dash-stats-row">
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background: rgba(99, 102, 241, 0.15); color: #6366f1;">
                    <i class="fa-solid fa-list-check"></i>
                </div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value" id="dash-total-tasks">0</span>
                    <span class="dash-stat-label">Total Tasks</span>
                </div>
                <span class="dash-stat-trend up"><i class="fa-solid fa-arrow-trend-up"></i> +5 this week</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">
                    <i class="fa-solid fa-clock"></i>
                </div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value" id="dash-active-tasks">0</span>
                    <span class="dash-stat-label">Active</span>
                </div>
                <span class="dash-stat-trend neutral">in progress</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value" id="dash-completed-tasks">0</span>
                    <span class="dash-stat-label">Completed</span>
                </div>
                <span class="dash-stat-trend neutral">0% rate</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background: rgba(168, 85, 247, 0.15); color: #a855f7;">
                    <i class="fa-solid fa-dollar-sign"></i>
                </div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value" id="dash-total-spent">$0</span>
                    <span class="dash-stat-label">Total Spent</span>
                </div>
                <span class="dash-stat-trend neutral">all time</span>
            </div>
        </div>

        <!-- Middle Row: Wallet Card + Task Overview -->
        <div class="dash-middle-row">
            <div class="dash-wallet-card">
                <div class="dash-wallet-bg-orb orb-1"></div>
                <div class="dash-wallet-bg-orb orb-2"></div>
                <button class="dash-wallet-add-btn" id="dash-add-funds">
                    <i class="fa-solid fa-plus"></i> Add Funds
                </button>
                <div class="dash-wallet-balance">
                    <span class="dash-wallet-label">Available Balance</span>
                    <span class="dash-wallet-amount" id="dash-wallet-amount">$0.00</span>
                </div>
            </div>
            <div class="dash-task-overview">
                <h3 class="dash-overview-title">TASK OVERVIEW</h3>
                <div class="dash-overview-rate">
                    <span>Completion Rate</span>
                    <span class="dash-rate-value" id="dash-comp-rate" style="color: #10b981;">0%</span>
                </div>
                <div class="dash-overview-bar">
                    <div class="dash-overview-bar-fill" id="dash-rate-bar" style="width: 0%;"></div>
                </div>
                <div class="dash-overview-stats">
                    <div class="dash-overview-stat-item">
                        <span class="dash-dot" style="background: #f59e0b;"></span><span>Active</span>
                        <span class="dash-overview-count" id="dash-ov-active">0</span>
                    </div>
                    <div class="dash-overview-stat-item">
                        <span class="dash-dot" style="background: #10b981;"></span><span>Completed</span>
                        <span class="dash-overview-count" id="dash-ov-completed">0</span>
                    </div>
                    <div class="dash-overview-stat-item">
                        <span class="dash-dot" style="background: #ef4444;"></span><span>Rejected</span>
                        <span class="dash-overview-count" id="dash-ov-rejected">0</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Recent Tasks -->
        <div class="dash-tasks-section">
            <div class="dash-tasks-header">
                <h3>Recent Tasks</h3>
                <div class="dash-tasks-tabs">
                    <button class="dash-tab active">All</button>
                    <button class="dash-tab">Active</button>
                    <button class="dash-tab">Completed</button>
                </div>
            </div>
            <div class="dash-tasks-list" id="dash-tasks-list">
                <div class="dash-recent-task-item">
                    <div class="dash-recent-task-icon" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">
                        <i class="fa-solid fa-clock"></i>
                    </div>
                    <div class="dash-recent-task-info">
                        <span class="dash-recent-task-title">Verify Central Park Cafe Queue</span>
                        <span class="dash-recent-task-meta">NYC · $15.00 · 2 hrs ago</span>
                    </div>
                    <span class="status-badge status-assigned">In Progress</span>
                </div>
                <div class="dash-recent-task-item">
                    <div class="dash-recent-task-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <div class="dash-recent-task-info">
                        <span class="dash-recent-task-title">Seattle Waterfront Photo</span>
                        <span class="dash-recent-task-meta">Seattle · $20.00 · 1 day ago</span>
                    </div>
                    <span class="status-badge status-review">Completed</span>
                </div>
                <div class="dash-recent-task-item">
                    <div class="dash-recent-task-icon" style="background: rgba(99, 102, 241, 0.15); color: #6366f1;">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <div class="dash-recent-task-info">
                        <span class="dash-recent-task-title">Brooklyn Bridge Condition Check</span>
                        <span class="dash-recent-task-meta">Brooklyn · $25.00 · 2 days ago</span>
                    </div>
                    <span class="status-badge status-completed">Delivered</span>
                </div>
            </div>
        </div>`;
    }

    function buildPostTask() {
        return `
        <div class="dash-header">
            <div>
                <h2 class="dash-greeting"><i class="fa-solid fa-crosshairs" style="color: var(--brand-cyan); margin-right: 0.5rem;"></i>New Targeting Request</h2>
                <p class="dash-greeting-sub">Create a new ground verification task</p>
            </div>
        </div>
        <div class="req-glass-card req-max-w-card" style="margin: 0;">
            <form id="form-post-task" class="req-form">
                <div class="req-form-group">
                    <label>Target Designation</label>
                    <input type="text" id="pt-title" class="req-input-premium" required placeholder="e.g. Verify Parker's queue length" />
                </div>
                <div class="req-form-group">
                    <label>Intelligence Details</label>
                    <textarea id="pt-desc" class="req-input-premium" required rows="3" placeholder="Need a 10s video of the main entrance to check current capacity..."></textarea>
                </div>
                <div class="req-form-group">
                    <label>Coordinates (Location)</label>
                    <div class="req-map-radar" id="map-picker">
                        <div class="req-radar-pulse"></div>
                        <i class="fa-solid fa-location-crosshairs req-radar-pin"></i>
                        <span class="req-radar-text">Click to set target zone</span>
                    </div>
                </div>
                <div class="req-form-row">
                    <div class="req-form-group req-half">
                        <label>Capture Mode</label>
                        <div class="req-media-segmented" id="req-media-toggle">
                            <input type="hidden" id="pt-media" value="photo">
                            <button type="button" class="req-seg-btn active" data-val="photo"><i class="fa-solid fa-camera"></i> Photo</button>
                            <button type="button" class="req-seg-btn" data-val="video"><i class="fa-solid fa-video"></i> Video</button>
                        </div>
                    </div>
                    <div class="req-form-group req-half">
                        <label>Bounty ($)</label>
                        <div class="req-budget-wrapper">
                            <span class="req-budget-currency">$</span>
                            <input type="number" id="pt-budget" class="req-input-premium req-input-budget" min="5" step="1" required placeholder="15" />
                        </div>
                    </div>
                </div>
                <div class="req-form-group">
                    <label>Deadline</label>
                    <input type="datetime-local" id="pt-deadline" class="req-input-premium" />
                </div>
                <div class="req-form-actions">
                    <button type="button" class="req-btn-cancel" id="btn-pt-cancel">Cancel</button>
                    <button type="submit" class="req-btn-primary">Initialize Scan</button>
                </div>
            </form>
        </div>`;
    }

    function buildNotifications() {
        const unreadCount = notifications.filter(n => !n.read).length;
        const listHTML = notifications.map(n => `
            <div class="notif-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
                <div class="notif-icon" style="background: ${n.color}20; color: ${n.color};">
                    <i class="${n.icon}"></i>
                </div>
                <div class="notif-body">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-message">${n.message}</div>
                    <div class="notif-time"><i class="fa-regular fa-clock"></i> ${n.time}</div>
                </div>
                ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
                <button class="notif-mark-btn" data-id="${n.id}" title="${n.read ? 'Marked as read' : 'Mark as read'}">
                    <i class="fa-solid ${n.read ? 'fa-check-double' : 'fa-check'}"></i>
                </button>
            </div>
        `).join('');

        return `
        <div class="dash-header">
            <div>
                <h2 class="dash-greeting"><i class="fa-solid fa-bell" style="color: var(--brand-cyan); margin-right: 0.5rem;"></i>Notifications</h2>
                <p class="dash-greeting-sub">${unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}</p>
            </div>
            <button class="dash-btn-post" id="btn-mark-all-read" style="background: linear-gradient(135deg, #06b6d4, #0891b2);">
                <i class="fa-solid fa-check-double"></i> Mark All Read
            </button>
        </div>
        <div class="notif-list">
            ${listHTML}
        </div>`;
    }

    function buildWallet() {
        const txRows = transactions.map(tx => `
            <div class="wallet-tx-row">
                <div class="wallet-tx-icon ${tx.type}">
                    <i class="fa-solid ${tx.type === 'credit' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                </div>
                <div class="wallet-tx-info">
                    <span class="wallet-tx-desc">${tx.desc}</span>
                    <span class="wallet-tx-date">${tx.date} · ${tx.id}</span>
                </div>
                <div class="wallet-tx-amount ${tx.type}">
                    ${tx.amount}
                </div>
            </div>
        `).join('');

        return `
        <div class="dash-header">
            <div>
                <h2 class="dash-greeting"><i class="fa-solid fa-wallet" style="color: var(--brand-cyan); margin-right: 0.5rem;"></i>Wallet</h2>
                <p class="dash-greeting-sub">Manage your funds and transactions</p>
            </div>
        </div>

        <!-- Balance Cards -->
        <div class="wallet-balance-row">
            <div class="dash-wallet-card" style="flex: 1;">
                <div class="dash-wallet-bg-orb orb-1"></div>
                <div class="dash-wallet-bg-orb orb-2"></div>
                <div class="dash-wallet-balance">
                    <span class="dash-wallet-label">Available Balance</span>
                    <span class="dash-wallet-amount" id="wallet-balance">$0.00</span>
                </div>
                <div style="display: flex; gap: 0.75rem; z-index: 2; margin-top: 1rem;">
                    <button class="dash-wallet-add-btn" id="wallet-add-funds">
                        <i class="fa-solid fa-plus"></i> Add Funds
                    </button>
                    <button class="wallet-withdraw-btn" id="wallet-withdraw">
                        <i class="fa-solid fa-arrow-up-from-bracket"></i> Withdraw
                    </button>
                </div>
            </div>
            <div class="wallet-stats-col">
                <div class="wallet-mini-stat">
                    <div class="wallet-mini-stat-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
                        <i class="fa-solid fa-arrow-down"></i>
                    </div>
                    <div>
                        <span class="wallet-mini-stat-label">Total Earned</span>
                        <span class="wallet-mini-stat-value" id="wallet-earned">$0</span>
                    </div>
                </div>
                <div class="wallet-mini-stat">
                    <div class="wallet-mini-stat-icon" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">
                        <i class="fa-solid fa-arrow-up"></i>
                    </div>
                    <div>
                        <span class="wallet-mini-stat-label">Total Spent</span>
                        <span class="wallet-mini-stat-value" id="wallet-spent">$0</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Transaction History -->
        <div class="dash-tasks-section" style="margin-top: 1.5rem;">
            <div class="dash-tasks-header">
                <h3>Transaction History</h3>
            </div>
            <div class="wallet-tx-list">
                ${txRows}
            </div>
        </div>`;
    }

    function buildAnalytics() {
        return `
        <div class="dash-header">
            <div>
                <h2 class="dash-greeting"><i class="fa-solid fa-chart-line" style="color: var(--brand-cyan); margin-right: 0.5rem;"></i>Analytics</h2>
                <p class="dash-greeting-sub">Insights into your GroundLens activity</p>
            </div>
        </div>

        <!-- Stats Cards -->
        <div class="dash-stats-row">
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background: rgba(99, 102, 241, 0.15); color: #6366f1;">
                    <i class="fa-solid fa-bullseye"></i>
                </div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value analytics-counter" data-target="156">0</span>
                    <span class="dash-stat-label">Tasks Completed</span>
                </div>
                <span class="dash-stat-trend up"><i class="fa-solid fa-arrow-trend-up"></i> +12% this month</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4;">
                    <i class="fa-solid fa-bolt"></i>
                </div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value analytics-counter" data-target="8" data-suffix=" min">0</span>
                    <span class="dash-stat-label">Avg. Response Time</span>
                </div>
                <span class="dash-stat-trend up"><i class="fa-solid fa-arrow-trend-up"></i> 15% faster</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
                    <i class="fa-solid fa-sack-dollar"></i>
                </div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value analytics-counter" data-target="3250" data-prefix="$">0</span>
                    <span class="dash-stat-label">Total Earnings</span>
                </div>
                <span class="dash-stat-trend up"><i class="fa-solid fa-arrow-trend-up"></i> +$420 this month</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background: rgba(168, 85, 247, 0.15); color: #a855f7;">
                    <i class="fa-solid fa-star"></i>
                </div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value analytics-counter" data-target="98" data-suffix="%">0</span>
                    <span class="dash-stat-label">Satisfaction Rate</span>
                </div>
                <span class="dash-stat-trend neutral">consistent</span>
            </div>
        </div>

        <!-- Charts Row -->
        <div class="analytics-charts-row">
            <!-- Tasks Chart -->
            <div class="analytics-chart-card">
                <h3 class="analytics-chart-title">Tasks This Week</h3>
                <div class="analytics-bar-chart" id="chart-tasks">
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="40" style="background: linear-gradient(180deg, #6366f1, #818cf8);"></div>
                        <span class="analytics-bar-label">Mon</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="65" style="background: linear-gradient(180deg, #6366f1, #818cf8);"></div>
                        <span class="analytics-bar-label">Tue</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="30" style="background: linear-gradient(180deg, #6366f1, #818cf8);"></div>
                        <span class="analytics-bar-label">Wed</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="85" style="background: linear-gradient(180deg, #6366f1, #818cf8);"></div>
                        <span class="analytics-bar-label">Thu</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="55" style="background: linear-gradient(180deg, #6366f1, #818cf8);"></div>
                        <span class="analytics-bar-label">Fri</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="90" style="background: linear-gradient(180deg, #6366f1, #818cf8);"></div>
                        <span class="analytics-bar-label">Sat</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="70" style="background: linear-gradient(180deg, #6366f1, #818cf8);"></div>
                        <span class="analytics-bar-label">Sun</span>
                    </div>
                </div>
            </div>

            <!-- Earnings Chart -->
            <div class="analytics-chart-card">
                <h3 class="analytics-chart-title">Earnings ($)</h3>
                <div class="analytics-bar-chart" id="chart-earnings">
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="50" style="background: linear-gradient(180deg, #10b981, #34d399);"></div>
                        <span class="analytics-bar-label">Mon</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="80" style="background: linear-gradient(180deg, #10b981, #34d399);"></div>
                        <span class="analytics-bar-label">Tue</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="35" style="background: linear-gradient(180deg, #10b981, #34d399);"></div>
                        <span class="analytics-bar-label">Wed</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="95" style="background: linear-gradient(180deg, #10b981, #34d399);"></div>
                        <span class="analytics-bar-label">Thu</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="60" style="background: linear-gradient(180deg, #10b981, #34d399);"></div>
                        <span class="analytics-bar-label">Fri</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="75" style="background: linear-gradient(180deg, #10b981, #34d399);"></div>
                        <span class="analytics-bar-label">Sat</span>
                    </div>
                    <div class="analytics-bar-wrapper">
                        <div class="analytics-bar" data-height="45" style="background: linear-gradient(180deg, #10b981, #34d399);"></div>
                        <span class="analytics-bar-label">Sun</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Performance Overview -->
        <div class="analytics-perf-section">
            <h3 class="analytics-chart-title" style="margin-bottom: 1.5rem;">Performance Overview</h3>
            <div class="analytics-perf-grid">
                <div class="analytics-perf-item">
                    <div class="analytics-perf-ring" data-percent="92" style="--ring-color: #10b981;">
                        <svg viewBox="0 0 36 36">
                            <path class="analytics-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                            <path class="analytics-ring-fill" stroke-dasharray="0, 100" data-dash="92" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                        </svg>
                        <span class="analytics-ring-text">92%</span>
                    </div>
                    <span class="analytics-perf-label">Completion</span>
                </div>
                <div class="analytics-perf-item">
                    <div class="analytics-perf-ring" data-percent="87" style="--ring-color: #6366f1;">
                        <svg viewBox="0 0 36 36">
                            <path class="analytics-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                            <path class="analytics-ring-fill" stroke-dasharray="0, 100" data-dash="87" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                        </svg>
                        <span class="analytics-ring-text">87%</span>
                    </div>
                    <span class="analytics-perf-label">On-Time</span>
                </div>
                <div class="analytics-perf-item">
                    <div class="analytics-perf-ring" data-percent="95" style="--ring-color: #f59e0b;">
                        <svg viewBox="0 0 36 36">
                            <path class="analytics-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                            <path class="analytics-ring-fill" stroke-dasharray="0, 100" data-dash="95" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                        </svg>
                        <span class="analytics-ring-text">95%</span>
                    </div>
                    <span class="analytics-perf-label">Quality</span>
                </div>
                <div class="analytics-perf-item">
                    <div class="analytics-perf-ring" data-percent="78" style="--ring-color: #ec4899;">
                        <svg viewBox="0 0 36 36">
                            <path class="analytics-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                            <path class="analytics-ring-fill" stroke-dasharray="0, 100" data-dash="78" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                        </svg>
                        <span class="analytics-ring-text">78%</span>
                    </div>
                    <span class="analytics-perf-label">Response</span>
                </div>
            </div>
        </div>`;
    }

    // =============================================
    //  SUB-VIEW EVENT HANDLERS
    // =============================================
    function attachDashViewEvents(viewName) {
        if (viewName === 'dashboard') {
            // Post task buttons
            const postBtn = document.getElementById('dash-post-task-btn');
            if (postBtn) postBtn.addEventListener('click', () => renderDashboardView('post-task'));

            // Animate counters
            setTimeout(() => {
                animateNumber(document.getElementById('dash-total-tasks'), 156, 1200);
                animateNumber(document.getElementById('dash-active-tasks'), 12, 1000);
                animateNumber(document.getElementById('dash-completed-tasks'), 140, 1500);
                animateNumber(document.getElementById('dash-wallet-amount'), 1250, 1500, '$');
                animateNumber(document.getElementById('dash-comp-rate'), 92, 1500, '', '%');
                const rateBar = document.getElementById('dash-rate-bar');
                if (rateBar) setTimeout(() => { rateBar.style.width = '92%'; }, 500);
                animateNumber(document.getElementById('dash-ov-active'), 12, 1000);
                animateNumber(document.getElementById('dash-ov-completed'), 140, 1500);
                animateNumber(document.getElementById('dash-ov-rejected'), 4, 800);
            }, 200);

        } else if (viewName === 'post-task') {
            // Media toggle
            const mediaBtns = document.querySelectorAll('.req-seg-btn');
            const mediaInput = document.getElementById('pt-media');
            if (mediaBtns.length > 0 && mediaInput) {
                mediaBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        mediaBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        mediaInput.value = btn.dataset.val;
                    });
                });
            }

            // Cancel button
            const cancelBtn = document.getElementById('btn-pt-cancel');
            if (cancelBtn) cancelBtn.addEventListener('click', () => renderDashboardView('dashboard'));

            // Form submit
            const form = document.getElementById('form-post-task');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const title = document.getElementById('pt-title').value.trim();
                    const desc = document.getElementById('pt-desc').value.trim();
                    const budget = document.getElementById('pt-budget').value;
                    const deadline = document.getElementById('pt-deadline').value;

                    if (!title) {
                        showNotification('Please provide a Target Designation', 'warning');
                        return;
                    }
                    if (!desc || desc.length < 10) {
                        showNotification('Please provide more Intelligence Details (min 10 chars)', 'warning');
                        return;
                    }
                    if (!budget || isNaN(budget) || Number(budget) < 5) {
                        showNotification('Minimum bounty requirement is $5', 'warning');
                        return;
                    }
                    if (!deadline) {
                        showNotification('Please specify a Deadline', 'warning');
                        return;
                    }
                    showNotification('Targeting Scan Initialized! Task posted successfully.', 'success');
                    setTimeout(() => renderDashboardView('dashboard'), 1200);
                });
            }

        } else if (viewName === 'notifications') {
            // Mark individual as read
            document.querySelectorAll('.notif-mark-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    const notif = notifications.find(n => n.id === id);
                    if (notif && !notif.read) {
                        notif.read = true;
                        renderDashboardView('notifications');
                    }
                });
            });

            // Mark all as read
            const markAllBtn = document.getElementById('btn-mark-all-read');
            if (markAllBtn) {
                markAllBtn.addEventListener('click', () => {
                    notifications.forEach(n => n.read = true);
                    renderDashboardView('notifications');
                });
            }

        } else if (viewName === 'wallet') {
            // Animate wallet values
            setTimeout(() => {
                animateNumber(document.getElementById('wallet-balance'), 1250, 1500, '$');
                animateNumber(document.getElementById('wallet-earned'), 3250, 1500, '$');
                animateNumber(document.getElementById('wallet-spent'), 2000, 1500, '$');
            }, 200);

            const withdrawBtn = document.getElementById('wallet-withdraw');
            if (withdrawBtn) {
                withdrawBtn.addEventListener('click', () => {
                    showNotification('Withdrawal request submitted. Funds will arrive in 2-3 business days.', 'success');
                });
            }

        } else if (viewName === 'analytics') {
            // Animate analytics counters
            setTimeout(() => {
                document.querySelectorAll('.analytics-counter').forEach(el => {
                    const target = parseInt(el.dataset.target);
                    const prefix = el.dataset.prefix || '';
                    const suffix = el.dataset.suffix || '';
                    animateNumber(el, target, 1500, prefix, suffix);
                });
            }, 200);

            // Animate chart bars
            setTimeout(() => {
                document.querySelectorAll('.analytics-bar').forEach(bar => {
                    const height = bar.dataset.height;
                    bar.style.height = height + '%';
                });
            }, 400);

            // Animate ring charts
            setTimeout(() => {
                document.querySelectorAll('.analytics-ring-fill').forEach(ring => {
                    const dash = ring.dataset.dash;
                    ring.style.strokeDasharray = `${dash}, 100`;
                });
            }, 600);
        }
    }

    // =============================================
    //  MAIN EVENT ATTACHMENTS
    // =============================================
    function attachEvents(viewName) {
        if (viewName === 'home') {
            document.querySelectorAll('.role-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    currentRole = e.target.dataset.role || 'user';
                    renderView('registerForm');
                });
            });
            initHomeAnimations();
        } else if (viewName === 'login' || viewName === 'loginForm') {
            const loginForm = document.getElementById('form-login');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    currentUser = { name: 'Alex Johnson', email: 'alex@example.com' };
                    renderView('dashboard');
                });
            }
            // Google login
            const googleBtn = document.getElementById('btn-google-login');
            if (googleBtn) {
                googleBtn.addEventListener('click', () => {
                    currentUser = { name: 'Alex Johnson', email: 'alex@example.com' };
                    renderView('dashboard');
                });
            }
        } else if (viewName === 'registerForm') {
            const regForm = document.getElementById('form-register');
            if (regForm) {
                regForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const nameInput = document.getElementById('reg-name');
                    const name = nameInput ? (nameInput.value || 'New User') : 'New User';
                    currentUser = { name: name, email: 'new@example.com' };
                    renderView('dashboard');
                });
            }
        } else if (viewName === 'dashboard') {
            // Populate user info in sidebar
            const dashName = document.getElementById('dash-user-name');
            const dashEmail = document.getElementById('dash-user-email');
            const dashAvatar = document.getElementById('dash-avatar');
            if (dashName && currentUser) dashName.textContent = currentUser.name;
            if (dashEmail && currentUser) dashEmail.textContent = currentUser.email;
            if (dashAvatar && currentUser) dashAvatar.textContent = currentUser.name[0];

            // Sign out
            const signoutBtn = document.getElementById('dash-signout');
            if (signoutBtn) {
                signoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    logout();
                });
            }

            // Sidebar navigation click handlers
            document.querySelectorAll('.dash-nav-item[data-view]').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    renderDashboardView(item.dataset.view);
                });
            });

            // Render the default sub-view
            // Check hash
            const hash = window.location.hash;
            if (hash && hash.startsWith('#/')) {
                const page = hash.replace('#/', '');
                renderDashboardView(page);
            } else {
                renderDashboardView(currentDashView || 'dashboard');
            }

        } else if (viewName === 'createTask') {
            const cancelBtn = document.getElementById('btn-cancel-task');
            if (cancelBtn) cancelBtn.addEventListener('click', () => renderView('dashboard'));

            const mediaBtns = document.querySelectorAll('.req-seg-btn');
            const mediaInput = document.getElementById('task-media');
            if (mediaBtns.length > 0 && mediaInput) {
                mediaBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        mediaBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        mediaInput.value = btn.dataset.val;
                    });
                });
            }

            const createForm = document.getElementById('form-create-task');
            if (createForm) {
                createForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    alert('Targeting Scan Initialized! (Mock)');
                    renderView('dashboard');
                });
            }
        }
    }

    // =============================================
    //  UTILITIES
    // =============================================
    window.logout = function () {
        currentUser = null;
        currentDashView = 'dashboard';
        renderView('home');
    };

    window.togglePassword = function (icon) {
        const input = icon.previousElementSibling;
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    };

    window.selectRole = function (role) {
        currentRole = role;
        const userCard = document.getElementById('role-user-card');
        const doerCard = document.getElementById('role-doer-card');
        if (userCard) {
            userCard.style.background = role === 'user' ? 'var(--brand-cyan-muted)' : 'var(--card-dark-bg)';
            userCard.style.borderColor = role === 'user' ? 'var(--brand-cyan)' : 'var(--glass-border-strong)';
        }
        if (doerCard) {
            doerCard.style.background = role === 'doer' ? 'var(--brand-cyan-muted)' : 'var(--card-dark-bg)';
            doerCard.style.borderColor = role === 'doer' ? 'var(--brand-cyan)' : 'var(--glass-border-strong)';
        }
    };

    function showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        if (!container) return;
        const colors = { success: '#10b981', warning: '#f59e0b', info: '#6366f1', error: '#ef4444' };
        const icons = { success: 'fa-circle-check', warning: 'fa-triangle-exclamation', info: 'fa-circle-info', error: 'fa-circle-xmark' };
        const notif = document.createElement('div');
        notif.style.cssText = `
            display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.5rem;
            background: rgba(15, 23, 42, 0.95); border: 1px solid ${colors[type]}40;
            border-left: 3px solid ${colors[type]}; border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(20px);
            color: var(--text-main); font-size: 0.9rem; margin-bottom: 0.5rem;
            animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        `;
        notif.innerHTML = `<i class="fa-solid ${icons[type]}" style="color: ${colors[type]}; font-size: 1.1rem;"></i> ${message}`;
        container.appendChild(notif);
        setTimeout(() => {
            notif.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    /**
     * Animates a number counting up to its target value.
     */
    function animateNumber(element, target, duration = 1000, prefix = '', suffix = '') {
        if (!element) return;
        const start = 0;
        const change = target - start;
        const startTime = performance.now();

        function updateNumber(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(start + (change * easeProgress));
            const formattedValue = currentValue.toLocaleString();
            element.innerText = `${prefix}${formattedValue}${suffix}`;
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                element.innerText = `${prefix}${target.toLocaleString()}${suffix}`;
            }
        }
        requestAnimationFrame(updateNumber);
    }

    // Global Easing for Framer Motion emulation
    const appleEase = [0.16, 1, 0.3, 1];

    function initHomeAnimations() {
        animate('.hero-word',
            { opacity: [0, 1], transform: ['translateY(40px)', 'translateY(0px)'] },
            { delay: stagger(0.05), ease: appleEase, duration: 0.8 }
        );

        document.querySelectorAll('.motion-section').forEach(section => {
            inView(section, () => {
                animate(section,
                    { opacity: 1, y: 0, filter: 'blur(0px)' },
                    { duration: 0.8, ease: appleEase }
                );
            }, { margin: "-100px 0px" });
        });

        const heroTitle = document.querySelector('.hero-title');
        const heroSection = document.querySelector('.hero-section');
        if (heroTitle && heroSection) {
            scroll(animate(heroTitle, { y: [0, -200] }), {
                target: heroSection,
                offset: ['start start', 'end start']
            });
        }

        const heroCard = document.querySelector('.hero-glass-map-card');
        if (heroCard && heroSection) {
            scroll(animate(heroCard, { scale: [1, 0.9], opacity: [1, 0] }), {
                target: heroSection,
                offset: ['start start', 'end start']
            });
        }

        document.querySelectorAll('.features-grid').forEach(grid => {
            inView(grid, () => {
                const cards = grid.querySelectorAll('.glass-card');
                if (cards.length > 0) {
                    animate(cards,
                        { opacity: [0, 1], y: [40, 0] },
                        { delay: stagger(0.1), duration: 0.8, ease: appleEase }
                    );
                }
            }, { margin: "-100px 0px" });
        });

        const stepCards = document.querySelectorAll('.step-card');
        const uis = [
            document.getElementById('iphone-ui-1'),
            document.getElementById('iphone-ui-2'),
            document.getElementById('iphone-ui-3'),
            document.getElementById('iphone-ui-4')
        ];

        stepCards.forEach((card, index) => {
            inView(card, () => {
                uis.forEach(ui => { if (ui) { ui.style.opacity = '0'; } });
                if (uis[index]) {
                    uis[index].style.opacity = '1';
                    animate(uis[index], { scale: [1.1, 1] }, { duration: 0.8, ease: appleEase });
                }
            }, { margin: "-40% 0px -40% 0px" });
        });
    }

    // Listen to hash changes for browser nav
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        if (currentUser && hash && hash.startsWith('#/')) {
            const page = hash.replace('#/', '');
            // Only render if it's different to prevent double-rendering
            if (currentDashView !== page) {
                renderDashboardView(page);
            }
        }
    });

    // Initialize
    renderView('home');
});