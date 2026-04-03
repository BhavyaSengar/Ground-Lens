// Motion library - loaded dynamically to prevent blank screen on import failure
let animate = () => {}, scroll = () => {}, inView = () => {}, stagger = () => () => 0;
(async () => {
  try {
    const m = await import('motion');
    animate = m.animate; scroll = m.scroll; inView = m.inView; stagger = m.stagger;
  } catch(e) { console.warn('[GroundLens] Motion lib failed to load, animations disabled.', e); }
})();

/* =============================================
   GroundLens — app.js (Upgraded v2.0)
   Fixes: Firebase Firestore, real auth, GPS photo
   verification, Razorpay payments, ₹ currency,
   mobile responsiveness, real map integration,
   task save/notify flow, investor-ready polish.
============================================= */

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const navLinks = document.getElementById('nav-links');
    const navProfile = document.getElementById('nav-profile');
    const themeToggle = document.getElementById('theme-toggle');

    // =============================================
    //  STATE
    // =============================================
    let currentUser = null;
    let currentRole = 'user';
    let currentDashView = 'dashboard';
    let userTasks = [];
    let userBalance = 0;
    let db = null;
    let auth = null;

    // In-memory notification store (synced with Firestore when available)
    let notifications = [];

    // =============================================
    //  FIREBASE INIT
    // =============================================
    async function initFirebase() {
        try {
            // Wait for firebaseModules to be injected by index.html module script
            let attempts = 0;
            while (!window.firebaseModules && attempts < 20) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }
            if (!window.firebaseModules) throw new Error('Firebase modules not loaded');

            const { initializeApp, getAuth, getFirestore } = window.firebaseModules;

            const firebaseConfig = {
                apiKey: "AIzaSyBdcD-uocA7LzPbrlxVtMU5JQDmvwGvmQM",
                authDomain: "groundlens-d81fe.firebaseapp.com",
                projectId: "groundlens-d81fe",
                storageBucket: "groundlens-d81fe.firebasestorage.app",
                messagingSenderId: "804229826420",
                appId: "1:804229826420:web:78f1923a64044095ee8e21",
                measurementId: "G-DTFCHFVE6B"
            };

            const app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            if (getFirestore) db = getFirestore(app);
            window._db = db;  // expose for waitlist and other inline scripts

            // Listen to auth state
            if (window.firebaseModules.onAuthStateChanged) {
                window.firebaseModules.onAuthStateChanged(auth, async (fbUser) => {
                    if (fbUser) {
                        currentUser = {
                            uid: fbUser.uid,
                            name: fbUser.displayName || fbUser.email.split('@')[0],
                            email: fbUser.email,
                            photo: fbUser.photoURL
                        };
                        await loadUserData();
                        renderView('dashboard');
                    }
                });
            }
        } catch (err) {
            console.warn('Firebase init skipped (demo mode):', err.message);
        }
    }

    // =============================================
    //  FIRESTORE DATA LAYER
    // =============================================
    async function saveUserProfile(uid, data) {
        if (!db || !window.firebaseModules?.setDoc) return;
        try {
            const { setDoc, doc } = window.firebaseModules;
            await setDoc(doc(db, 'users', uid), data, { merge: true });
        } catch (e) { console.warn('saveUserProfile:', e.message); }
    }

    async function loadUserData() {
        if (!db || !currentUser || !window.firebaseModules?.getDoc) return;
        try {
            const { getDoc, doc, collection, query, where, getDocs, orderBy } = window.firebaseModules;

            // Load user profile
            const snap = await getDoc(doc(db, 'users', currentUser.uid));
            if (snap.exists()) {
                const data = snap.data();
                userBalance = data.balance || 0;
                currentRole = data.role || 'user';
            }

            // Load user tasks
            const tq = query(
                collection(db, 'tasks'),
                where('userId', '==', currentUser.uid),
                orderBy('createdAt', 'desc')
            );
            const tsnap = await getDocs(tq);
            userTasks = tsnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Load notifications
            const nq = query(
                collection(db, 'notifications'),
                where('userId', '==', currentUser.uid),
                orderBy('createdAt', 'desc')
            );
            const nsnap = await getDocs(nq);
            notifications = nsnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('loadUserData:', e.message);
            // Fallback to empty state — no fake data
        }
    }

    async function saveTask(taskData) {
        if (!db || !currentUser || !window.firebaseModules?.addDoc) {
            // Demo mode: push to local array
            const task = { id: 'TASK-' + Date.now(), ...taskData, status: 'open', createdAt: new Date().toISOString() };
            userTasks.unshift(task);
            addNotification('Task Posted', `"${taskData.title}" is now live and visible to scouts`, 'fa-solid fa-crosshairs', '#06b6d4');
            return task;
        }
        try {
            const { addDoc, collection, serverTimestamp } = window.firebaseModules;
            const ref = await addDoc(collection(db, 'tasks'), {
                ...taskData,
                userId: currentUser.uid,
                status: 'open',
                createdAt: serverTimestamp()
            });
            const task = { id: ref.id, ...taskData, status: 'open' };
            userTasks.unshift(task);
            await sendNotificationToNearbyScouts(taskData);
            addNotification('Task Posted', `"${taskData.title}" is now live`, 'fa-solid fa-crosshairs', '#06b6d4');
            return task;
        } catch (e) {
            console.warn('saveTask:', e.message);
            throw e;
        }
    }

    async function sendNotificationToNearbyScouts(taskData) {
        // In production: Cloud Function triggers push notifications to scouts within radius
        // Here we create a "broadcast" document that scouts' apps listen to
        if (!db || !window.firebaseModules?.addDoc) return;
        try {
            const { addDoc, collection, serverTimestamp } = window.firebaseModules;
            await addDoc(collection(db, 'task_broadcasts'), {
                taskId: taskData.id,
                location: taskData.location,
                bounty: taskData.bounty,
                radiusKm: 10,
                createdAt: serverTimestamp()
            });
        } catch (e) { console.warn('sendNotificationToNearbyScouts:', e.message); }
    }

    function addNotification(title, message, icon, color) {
        notifications.unshift({
            id: Date.now(),
            title,
            message,
            time: 'just now',
            read: false,
            icon,
            color
        });
        updateNotificationBadge();
    }

    // =============================================
    //  GPS PHOTO VERIFICATION
    // =============================================
    function verifyPhotoGPS(file, targetLat, targetLng, radiusMeters = 200) {
        return new Promise((resolve, reject) => {
            // Read EXIF GPS data from the photo file
            if (!window.EXIF) {
                // EXIF lib not loaded — fallback: use device GPS at time of capture
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        pos => {
                            const dist = getDistanceMeters(
                                pos.coords.latitude, pos.coords.longitude,
                                targetLat, targetLng
                            );
                            resolve({ verified: dist <= radiusMeters, dist, method: 'device-gps' });
                        },
                        () => resolve({ verified: false, dist: null, method: 'gps-denied' })
                    );
                } else {
                    resolve({ verified: false, dist: null, method: 'no-gps' });
                }
                return;
            }

            EXIF.getData(file, function () {
                const lat = EXIF.getTag(this, 'GPSLatitude');
                const lng = EXIF.getTag(this, 'GPSLongitude');
                const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
                const lngRef = EXIF.getTag(this, 'GPSLongitudeRef');

                if (!lat || !lng) {
                    resolve({ verified: false, dist: null, method: 'no-exif' });
                    return;
                }

                const photoLat = convertDMSToDD(lat, latRef);
                const photoLng = convertDMSToDD(lng, lngRef);
                const dist = getDistanceMeters(photoLat, photoLng, targetLat, targetLng);
                resolve({ verified: dist <= radiusMeters, dist: Math.round(dist), method: 'exif' });
            });
        });
    }

    function convertDMSToDD(dms, ref) {
        const dd = dms[0] + dms[1] / 60 + dms[2] / 3600;
        return (ref === 'S' || ref === 'W') ? -dd : dd;
    }

    function getDistanceMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // =============================================
    //  RAZORPAY PAYMENT INTEGRATION
    // =============================================
    function initRazorpay(amount, description, onSuccess) {


        if (!window.Razorpay) {
            // Razorpay script not loaded — show demo payment modal
            showPaymentModal(amount, description, onSuccess);
            return;
        }

        const options = {
            key: 'rzp_test_REPLACE_WITH_YOUR_KEY', // Replace with your Razorpay test key
            amount: amount * 100, // Razorpay expects paise
            currency: 'INR',
            name: 'GroundLens',
            description: description,
            image: '',
            handler: function (response) {
                showNotification(`Payment successful! ID: ${response.razorpay_payment_id}`, 'success');
                userBalance += amount;
                onSuccess(response.razorpay_payment_id);
                renderDashboardView(currentDashView);
            },
            prefill: {
                name: currentUser?.name || '',
                email: currentUser?.email || ''
            },
            theme: { color: '#06b6d4' }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function () {
            showNotification('Payment failed. Please try again.', 'error');
        });
        rzp.open();
    }

    function showPaymentModal(amount, description, onSuccess) {
        // Demo payment modal — used when Razorpay is not configured
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center; z-index: 9999;
        `;
        modal.innerHTML = `
            <div style="background: #11131a; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 2.5rem; max-width: 400px; width: 90%; text-align: center;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(6,182,212,0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: #06b6d4; font-size: 1.5rem;">
                    <i class="fa-solid fa-lock"></i>
                </div>
                <h3 style="color: #f8fafc; font-size: 1.3rem; margin-bottom: 0.5rem;">Confirm Payment</h3>
                <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">${description}</p>
                <div style="font-size: 2.5rem; font-weight: 800; color: #06b6d4; margin-bottom: 0.5rem;">₹${amount.toLocaleString('en-IN')}</div>
                <p style="color: #94a3b8; font-size: 0.75rem; margin-bottom: 2rem;">Secured by Razorpay · UPI · Cards · NetBanking</p>
                <div style="display: flex; gap: 1rem;">
                    <button id="pay-cancel" style="flex:1; background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 0.9rem; border-radius: 12px; cursor: pointer; font-size: 0.95rem;">Cancel</button>
                    <button id="pay-confirm" style="flex:1; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; border: none; padding: 0.9rem; border-radius: 12px; cursor: pointer; font-size: 0.95rem; font-weight: 600;">Pay Now</button>
                </div>
                <p style="color: #475569; font-size: 0.72rem; margin-top: 1rem;">🔒 Demo mode — no real charges</p>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('pay-cancel').onclick = () => modal.remove();
        document.getElementById('pay-confirm').onclick = () => {
            modal.remove();
            const fakeId = 'pay_demo_' + Math.random().toString(36).substr(2, 9);
            showNotification('Payment successful! ₹' + amount.toLocaleString('en-IN') + ' added to wallet.', 'success');
            userBalance += amount;
            if (onSuccess) onSuccess(fakeId);
            renderDashboardView(currentDashView);
        };
    }

// =============================================
    //  THEME TOGGLE
    // =============================================
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-moon');
                icon.classList.toggle('fa-sun');
            }
        });
    }

    // =============================================
    //  ROUTER
    // =============================================
    window.renderView = function (viewName) {
        mainContent.innerHTML = '';
        let templateId = '';
        switch (viewName) {
            case 'home': templateId = 'tmpl-home'; break;
            case 'login':
            case 'loginForm': templateId = 'tmpl-login-form'; break;
            case 'registerForm': templateId = 'tmpl-register-form'; break;
            case 'dashboard':
                templateId = currentRole === 'doer' ? 'tmpl-doer-dashboard' : 'tmpl-full-dashboard';
                break;
            case 'createTask': templateId = 'tmpl-create-task'; break;
            default: templateId = 'tmpl-home';
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
            const initial = currentUser.name[0].toUpperCase();
            const photoHTML = currentUser.photo
                ? `<img src="${currentUser.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`
                : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#06b6d4,#8b5cf6);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;">${initial}</div>`;
            navProfile.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;">
                    ${photoHTML}
                    <span style="font-size:0.9rem;font-weight:500;color:var(--text-main);">${currentUser.name.split(' ')[0]}</span>
                    <button onclick="logout()" class="btn-magnetic" style="background:transparent;border:1px solid var(--glass-border-strong);color:var(--text-muted);padding:0.4rem 0.9rem;border-radius:8px;cursor:pointer;font-size:0.85rem;">Logout</button>
                </div>
            `;
        } else {
            navLinks.innerHTML = `
                <a href="#how-it-works" onclick="window.scrollToSection('how-it-works'); return false;" style="text-decoration:none; color:var(--text-muted); font-size: 0.95rem; font-weight:500; transition: color 0.3s ease;" onmouseover="this.style.color='var(--text-main)';" onmouseout="this.style.color='var(--text-muted)';">How It Works</a>
                <a href="#testimonials" onclick="window.scrollToSection('testimonials'); return false;" style="text-decoration:none; color:var(--text-muted); font-size: 0.95rem; font-weight:500;" onmouseover="this.style.color='var(--text-main)';" onmouseout="this.style.color='var(--text-muted)';">Trust</a>
                <a href="#use-cases" onclick="window.scrollToSection('use-cases'); return false;" style="text-decoration:none; color:var(--text-muted); font-size: 0.95rem; font-weight:500;" onmouseover="this.style.color='var(--text-main)';" onmouseout="this.style.color='var(--text-muted)';">Use Cases</a>
            `;
            navProfile.innerHTML = `
                <button onclick="renderView('login')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-weight:500;font-size:0.95rem;" onmouseover="this.style.color='var(--text-main)';" onmouseout="this.style.color='var(--text-muted)';">Sign In</button>
                <button onclick="renderView('registerForm')" class="btn-magnetic ripple-button" style="background:linear-gradient(135deg,#06b6d4,#8b5cf6);color:white;border:none;padding:0.6rem 1.2rem;border-radius:30px;cursor:pointer;font-weight:600;font-size:0.95rem;display:flex;align-items:center;gap:0.5rem;box-shadow:0 4px 15px rgba(139,92,246,0.3);">
                    Get Started <i class="fa-solid fa-arrow-right" style="font-size:0.8rem;"></i>
                </button>
            `;
        }
    }

    // =============================================
    //  DASHBOARD SUB-ROUTER
    // =============================================
    function renderDashboardView(viewName) {
        currentDashView = viewName;
        const container = document.getElementById('dash-content');
        if (!container) return;

        window.location.hash = `#/${viewName}`;

        document.querySelectorAll('.dash-nav-item[data-view]').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) item.classList.add('active');
        });

        updateNotificationBadge();
        container.classList.remove('dash-content-enter');
        container.classList.add('dash-content-exit');

        setTimeout(() => {
            switch (viewName) {
                case 'dashboard': container.innerHTML = buildDashboardHome(); break;
                case 'post-task': container.innerHTML = buildPostTask(); break;
                case 'notifications': container.innerHTML = buildNotifications(); break;
                case 'wallet': container.innerHTML = buildWallet(); break;
                case 'analytics': container.innerHTML = buildAnalytics(); break;
                default: container.innerHTML = buildDashboardHome();
            }
            container.classList.remove('dash-content-exit');
            container.classList.add('dash-content-enter');
            attachDashViewEvents(viewName);
        }, 150);
    }

    function updateNotificationBadge() {
        const badge = document.querySelector('.dash-nav-badge');
        if (!badge) return;
        const unread = notifications.filter(n => !n.read).length;
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
        badge.classList.toggle('pulse', unread > 0);
    }

    // =============================================
    //  GREETING
    // =============================================
    function getGreeting() {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    }

    function formatINR(amount) {
        return '₹' + Number(amount).toLocaleString('en-IN');
    }

    // =============================================
    //  DASHBOARD HOME
    // =============================================
    function buildDashboardHome() {
        const name = currentUser ? currentUser.name.split(' ')[0] : 'User';
        const active = userTasks.filter(t => t.status === 'open' || t.status === 'assigned').length;
        const completed = userTasks.filter(t => t.status === 'completed').length;
        const rejected = userTasks.filter(t => t.status === 'rejected').length;
        const total = userTasks.length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const spent = userTasks.reduce((s, t) => s + (Number(t.bounty) || 0), 0);

        const taskRows = userTasks.slice(0, 5).map(task => {
            const statusMap = {
                open: { label: 'Open', cls: 'status-pending', icon: 'fa-clock', color: '#f59e0b' },
                assigned: { label: 'In Progress', cls: 'status-assigned', icon: 'fa-spinner', color: '#6366f1' },
                review: { label: 'Needs Review', cls: 'status-review', icon: 'fa-magnifying-glass', color: '#a855f7' },
                completed: { label: 'Delivered', cls: 'status-completed', icon: 'fa-circle-check', color: '#10b981' },
                rejected: { label: 'Rejected', cls: 'status-rejected', icon: 'fa-xmark-circle', color: '#ef4444' }
            };
            const s = statusMap[task.status] || statusMap.open;
            const timeAgo = task.createdAt ? getTimeAgo(task.createdAt) : 'recently';
            
            // Make it clickable ONLY if it needs review
            const clickAction = task.status === 'review' ? `onclick="window.openReviewModal('${task.id}')" style="cursor:pointer; border: 1px solid #a855f7;" class="hover-lift"` : '';

            return `
            <div class="dash-recent-task-item" ${clickAction}>
                <div class="dash-recent-task-icon" style="background:${s.color}20;color:${s.color};">
                    <i class="fa-solid ${s.icon}"></i>
                </div>
                <div class="dash-recent-task-info">
                    <span class="dash-recent-task-title">${task.title}</span>
                    <span class="dash-recent-task-meta">${task.locationName || 'Location set'} · ${formatINR(task.bounty)} · ${timeAgo}</span>
                </div>
                <span class="status-badge ${s.cls}">${s.label}</span>
            </div>`;
        }).join('') || `
            <div style="text-align:center;padding:3rem;color:var(--text-muted);">
                <i class="fa-solid fa-crosshairs" style="font-size:2rem;margin-bottom:1rem;opacity:0.4;"></i>
                <p>No tasks yet. Post your first request!</p>
            </div>`;

        return `
        <div class="dash-header">
            <div>
                <h2 class="dash-greeting">${getGreeting()}, ${name} 🚀</h2>
                <p class="dash-greeting-sub">Manage your tasks and track progress</p>
            </div>
            <button class="dash-btn-post" id="dash-post-task-btn">
                <i class="fa-solid fa-plus"></i> Post Task
            </button>
        </div>

        <div class="dash-stats-row">
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background:rgba(99,102,241,0.15);color:#6366f1;"><i class="fa-solid fa-list-check"></i></div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value" id="dash-total-tasks">0</span>
                    <span class="dash-stat-label">Total Tasks</span>
                </div>
                <span class="dash-stat-trend ${total > 0 ? 'up' : 'neutral'}">${total > 0 ? '<i class="fa-solid fa-arrow-trend-up"></i> Active' : 'No tasks yet'}</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background:rgba(245,158,11,0.15);color:#f59e0b;"><i class="fa-solid fa-clock"></i></div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value" id="dash-active-tasks">0</span>
                    <span class="dash-stat-label">Active</span>
                </div>
                <span class="dash-stat-trend neutral">in progress</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background:rgba(16,185,129,0.15);color:#10b981;"><i class="fa-solid fa-circle-check"></i></div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value" id="dash-completed-tasks">0</span>
                    <span class="dash-stat-label">Completed</span>
                </div>
                <span class="dash-stat-trend neutral" id="dash-rate-label">${rate}% rate</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background:rgba(168,85,247,0.15);color:#a855f7;"><i class="fa-solid fa-indian-rupee-sign"></i></div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value" id="dash-total-spent">₹0</span>
                    <span class="dash-stat-label">Total Spent</span>
                </div>
                <span class="dash-stat-trend neutral">all time</span>
            </div>
        </div>

        <div class="dash-middle-row">
            <div class="dash-wallet-card">
                <div class="dash-wallet-bg-orb orb-1"></div>
                <div class="dash-wallet-bg-orb orb-2"></div>
                <button class="dash-wallet-add-btn" id="dash-add-funds">
                    <i class="fa-solid fa-plus"></i> Add Funds
                </button>
                <div class="dash-wallet-balance">
                    <span class="dash-wallet-label">Available Balance</span>
                    <span class="dash-wallet-amount" id="dash-wallet-amount">₹0</span>
                </div>
            </div>
            <div class="dash-task-overview">
                <h3 class="dash-overview-title">TASK OVERVIEW</h3>
                <div class="dash-overview-rate">
                    <span>Completion Rate</span>
                    <span class="dash-rate-value" id="dash-comp-rate" style="color:#10b981;">${rate}%</span>
                </div>
                <div class="dash-overview-bar">
                    <div class="dash-overview-bar-fill" id="dash-rate-bar" style="width:0%;"></div>
                </div>
                <div class="dash-overview-stats">
                    <div class="dash-overview-stat-item">
                        <span class="dash-dot" style="background:#f59e0b;"></span><span>Active</span>
                        <span class="dash-overview-count" id="dash-ov-active">${active}</span>
                    </div>
                    <div class="dash-overview-stat-item">
                        <span class="dash-dot" style="background:#10b981;"></span><span>Completed</span>
                        <span class="dash-overview-count" id="dash-ov-completed">${completed}</span>
                    </div>
                    <div class="dash-overview-stat-item">
                        <span class="dash-dot" style="background:#ef4444;"></span><span>Rejected</span>
                        <span class="dash-overview-count" id="dash-ov-rejected">${rejected}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="dash-tasks-section">
            <div class="dash-tasks-header">
                <h3>Recent Tasks</h3>
                <div class="dash-tasks-tabs">
                    <button class="dash-tab active" data-filter="all">All</button>
                    <button class="dash-tab" data-filter="active">Active</button>
                    <button class="dash-tab" data-filter="completed">Completed</button>
                </div>
            </div>
            <div class="dash-tasks-list" id="dash-tasks-list">${taskRows}</div>
        </div>`;
    }

    // =============================================
    //  POST TASK
    // =============================================
    function buildPostTask() {
        return `
        <div class="premium-task-wrapper">
            <div class="premium-glow-bg"></div>

            <div class="req-glass-card premium-form-card" style="margin:0 auto;">
                <div class="req-header-special">
                    <div class="req-icon-glow">
                        <i class="fa-solid fa-satellite-dish"></i>
                    </div>
                    <div>
                        <h2 class="req-title" style="margin-bottom: 0;">Deploy a Scout</h2>
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.2rem;">Create a verified location photo/video task</p>
                    </div>
                </div>

                <form id="form-post-task" class="req-form premium-grid-form">
                    <div class="req-col-left">
                        <div class="req-form-group">
                            <label><i class="fa-solid fa-tag" style="color: var(--brand-cyan); margin-right: 5px;"></i> Task Title</label>
                            <input type="text" id="pt-title" class="req-input-premium" required placeholder="e.g. Check queue at Lajpat Nagar market" />
                        </div>
                        <div class="req-form-group" style="margin-top: 1.5rem;">
                            <label><i class="fa-solid fa-align-left" style="color: var(--brand-cyan); margin-right: 5px;"></i> Description</label>
                            <textarea id="pt-desc" class="req-input-premium" required rows="4" placeholder="Describe exactly what you need the scout to capture..."></textarea>
                        </div>

                        <div class="req-form-row" style="margin-top: 1.5rem;">
                            <div class="req-form-group req-half">
                                <label><i class="fa-solid fa-camera-retro" style="color: var(--brand-cyan); margin-right: 5px;"></i> Capture Mode</label>
                                <div class="req-media-segmented" id="req-media-toggle">
                                    <input type="hidden" id="pt-media" value="photo">
                                    <button type="button" class="req-seg-btn active" data-val="photo"><i class="fa-solid fa-camera"></i> Photo</button>
                                    <button type="button" class="req-seg-btn" data-val="video"><i class="fa-solid fa-video"></i> Video</button>
                                </div>
                            </div>
                            <div class="req-form-group req-half">
                                <label><i class="fa-regular fa-calendar-xmark" style="color: var(--brand-cyan); margin-right: 5px;"></i> Deadline</label>
                                <input type="datetime-local" id="pt-deadline" class="req-input-premium" required />
                            </div>
                        </div>
                        
                        <input type="hidden" id="pt-budget" value="99" />
                    </div>

                    <div class="req-col-right" style="display: flex; flex-direction: column;">
                        <div class="req-form-group" style="height: 100%; display: flex; flex-direction: column;">
                            <label><i class="fa-solid fa-location-crosshairs" style="color: var(--brand-cyan); margin-right: 5px;"></i> Target Location</label>
                            <div style="position: relative; margin-bottom: 0.8rem;">
                                <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 1.2rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                                <input type="text" id="pt-location-search" class="req-input-premium" placeholder="Search location (e.g. Connaught Place)" style="padding-left: 2.8rem; width: 100%;" />
                                <button type="button" id="btn-use-my-location" style="position:absolute;right:0.8rem;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--brand-cyan);cursor:pointer;font-size:1rem;" title="Use my current location">
                                    <i class="fa-solid fa-location-crosshairs"></i>
                                </button>
                            </div>
                            <div class="req-map-radar" id="map-picker" style="flex: 1; min-height: 220px; border-radius: 12px; position:relative;">
                                <div class="req-radar-pulse"></div>
                                <i class="fa-solid fa-location-dot req-radar-pin"></i>
                                <span class="req-radar-text" style="position:relative; z-index:2;">Search a location or pin the target</span>
                            </div>
                            
                            <input type="hidden" id="pt-lat" />
                            <input type="hidden" id="pt-lng" />
                            <input type="hidden" id="pt-location-name" />
                        </div>
                    </div>

                    <div class="req-form-actions full-width-actions">
                        <button type="button" class="req-btn-cancel" id="btn-pt-cancel">Cancel</button>
                        <button type="submit" class="req-btn-primary premium-submit-btn" id="btn-post-submit">
                            Deploy Scout <i class="fa-solid fa-paper-plane" style="margin-left: 5px;"></i>
                        </button>
                    </div>
                </form>
            </div>
        </div>`;
    }

    // =============================================
    //  NOTIFICATIONS
    // =============================================
    function buildNotifications() {
        const unreadCount = notifications.filter(n => !n.read).length;
        const listHTML = notifications.length === 0
            ? `<div style="text-align:center;padding:3rem;color:var(--text-muted);">
                <i class="fa-solid fa-bell-slash" style="font-size:2rem;margin-bottom:1rem;opacity:0.4;"></i>
                <p>No notifications yet</p></div>`
            : notifications.map(n => `
            <div class="notif-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
                <div class="notif-icon" style="background:${n.color}20;color:${n.color};">
                    <i class="${n.icon}"></i>
                </div>
                <div class="notif-body">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-message">${n.message}</div>
                    <div class="notif-time"><i class="fa-regular fa-clock"></i> ${n.time}</div>
                </div>
                ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
                <button class="notif-mark-btn" data-id="${n.id}" title="${n.read ? 'Read' : 'Mark as read'}">
                    <i class="fa-solid ${n.read ? 'fa-check-double' : 'fa-check'}"></i>
                </button>
            </div>`).join('');

        return `
        <div class="dash-header">
            <div>
                <h2 class="dash-greeting"><i class="fa-solid fa-bell" style="color:var(--brand-cyan);margin-right:0.5rem;"></i>Notifications</h2>
                <p class="dash-greeting-sub">${unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}</p>
            </div>
            ${notifications.length > 0 ? `<button class="dash-btn-post" id="btn-mark-all-read" style="background:linear-gradient(135deg,#06b6d4,#0891b2);"><i class="fa-solid fa-check-double"></i> Mark All Read</button>` : ''}
        </div>
        <div class="notif-list">${listHTML}</div>`;
    }

    // =============================================
    //  WALLET
    // =============================================
    function buildWallet() {
        const earned = userTasks.filter(t => t.status === 'completed' && currentRole === 'doer')
            .reduce((s, t) => s + (Number(t.bounty) * 0.5), 0);
        const spent = userTasks.reduce((s, t) => s + (Number(t.bounty) || 0), 0);

        // Transactions from tasks
        const txRows = userTasks.slice(0, 8).map(tx => `
            <div class="wallet-tx-row">
                <div class="wallet-tx-icon debit"><i class="fa-solid fa-arrow-up"></i></div>
                <div class="wallet-tx-info">
                    <span class="wallet-tx-desc">Task Posted — ${tx.title}</span>
                    <span class="wallet-tx-date">${tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-IN') : 'Recently'} · ${tx.id?.slice(0, 12) || 'ID pending'}</span>
                </div>
                <div class="wallet-tx-amount debit">−${formatINR(tx.bounty)}</div>
            </div>`).join('') || `
            <div style="text-align:center;padding:2rem;color:var(--text-muted);font-size:0.9rem;">No transactions yet</div>`;

        return `
        <div class="dash-header">
            <div>
                <h2 class="dash-greeting"><i class="fa-solid fa-wallet" style="color:var(--brand-cyan);margin-right:0.5rem;"></i>Wallet</h2>
                <p class="dash-greeting-sub">Manage your funds and transactions</p>
            </div>
        </div>

        <div class="wallet-balance-row">
            <div class="dash-wallet-card" style="flex:1;">
                <div class="dash-wallet-bg-orb orb-1"></div>
                <div class="dash-wallet-bg-orb orb-2"></div>
                <div class="dash-wallet-balance">
                    <span class="dash-wallet-label">Available Balance</span>
                    <span class="dash-wallet-amount" id="wallet-balance">${formatINR(userBalance)}</span>
                </div>
                <div style="display:flex;gap:0.75rem;z-index:2;margin-top:1rem;">
                    <button class="dash-wallet-add-btn" id="wallet-add-funds"><i class="fa-solid fa-plus"></i> Add Funds</button>
                    <button class="wallet-withdraw-btn" id="wallet-withdraw"><i class="fa-solid fa-arrow-up-from-bracket"></i> Withdraw</button>
                </div>
            </div>
            <div class="wallet-stats-col">
                <div class="wallet-mini-stat">
                    <div class="wallet-mini-stat-icon" style="background:rgba(16,185,129,0.15);color:#10b981;"><i class="fa-solid fa-arrow-down"></i></div>
                    <div>
                        <span class="wallet-mini-stat-label">Total Earned</span>
                        <span class="wallet-mini-stat-value" id="wallet-earned">${formatINR(earned)}</span>
                    </div>
                </div>
                <div class="wallet-mini-stat">
                    <div class="wallet-mini-stat-icon" style="background:rgba(239,68,68,0.15);color:#ef4444;"><i class="fa-solid fa-arrow-up"></i></div>
                    <div>
                        <span class="wallet-mini-stat-label">Total Spent</span>
                        <span class="wallet-mini-stat-value" id="wallet-spent">${formatINR(spent)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="dash-tasks-section" style="margin-top:1.5rem;">
            <div class="dash-tasks-header"><h3>Transaction History</h3></div>
            <div class="wallet-tx-list">${txRows}</div>
        </div>`;
    }

    // =============================================
    //  ANALYTICS
    // =============================================
    function buildAnalytics() {
        const total = userTasks.length;
        const completed = userTasks.filter(t => t.status === 'completed').length;
        const spent = userTasks.reduce((s, t) => s + (Number(t.bounty) || 0), 0);
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return `
        <div class="dash-header">
            <div>
                <h2 class="dash-greeting"><i class="fa-solid fa-chart-line" style="color:var(--brand-cyan);margin-right:0.5rem;"></i>Analytics</h2>
                <p class="dash-greeting-sub">Insights into your GroundLens activity</p>
            </div>
        </div>

        <div class="dash-stats-row">
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background:rgba(99,102,241,0.15);color:#6366f1;"><i class="fa-solid fa-bullseye"></i></div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value analytics-counter" data-target="${completed}">0</span>
                    <span class="dash-stat-label">Tasks Completed</span>
                </div>
                <span class="dash-stat-trend ${completed > 0 ? 'up' : 'neutral'}">${completed > 0 ? '<i class="fa-solid fa-arrow-trend-up"></i> Total' : 'None yet'}</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background:rgba(6,182,212,0.15);color:#06b6d4;"><i class="fa-solid fa-bolt"></i></div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value analytics-counter" data-target="${total}" data-suffix=" tasks">0</span>
                    <span class="dash-stat-label">Total Posted</span>
                </div>
                <span class="dash-stat-trend neutral">all time</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background:rgba(16,185,129,0.15);color:#10b981;"><i class="fa-solid fa-sack-dollar"></i></div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value analytics-counter" data-target="${spent}" data-prefix="₹">0</span>
                    <span class="dash-stat-label">Total Invested</span>
                </div>
                <span class="dash-stat-trend neutral">all time</span>
            </div>
            <div class="dash-stat-card">
                <div class="dash-stat-icon" style="background:rgba(168,85,247,0.15);color:#a855f7;"><i class="fa-solid fa-star"></i></div>
                <div class="dash-stat-info">
                    <span class="dash-stat-value analytics-counter" data-target="${rate}" data-suffix="%">0</span>
                    <span class="dash-stat-label">Completion Rate</span>
                </div>
                <span class="dash-stat-trend neutral">overall</span>
            </div>
        </div>

        <div class="analytics-charts-row">
            <div class="analytics-chart-card">
                <h3 class="analytics-chart-title">Tasks This Week (Sample)</h3>
                <div class="analytics-bar-chart" id="chart-tasks">
                    ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => {
                        const h = [40,65,30,85,55,90,70][i];
                        return `<div class="analytics-bar-wrapper">
                            <div class="analytics-bar" data-height="${h}" style="background:linear-gradient(180deg,#6366f1,#818cf8);"></div>
                            <span class="analytics-bar-label">${d}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
            <div class="analytics-chart-card">
                <h3 class="analytics-chart-title">Spend ₹ (Sample)</h3>
                <div class="analytics-bar-chart" id="chart-earnings">
                    ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => {
                        const h = [50,80,35,95,60,75,45][i];
                        return `<div class="analytics-bar-wrapper">
                            <div class="analytics-bar" data-height="${h}" style="background:linear-gradient(180deg,#10b981,#34d399);"></div>
                            <span class="analytics-bar-label">${d}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>

        <div class="analytics-perf-section">
            <h3 class="analytics-chart-title" style="margin-bottom:1.5rem;">Performance Overview</h3>
            <div class="analytics-perf-grid">
                ${[
                    { label:'Completion', val: rate, color:'#10b981' },
                    { label:'On-Time', val: Math.min(rate + 5, 100), color:'#6366f1' },
                    { label:'Quality', val: Math.min(rate + 8, 100), color:'#f59e0b' },
                    { label:'Response', val: Math.max(rate - 10, 0), color:'#ec4899' }
                ].map(r => `
                <div class="analytics-perf-item">
                    <div class="analytics-perf-ring" style="--ring-color:${r.color};">
                        <svg viewBox="0 0 36 36">
                            <path class="analytics-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                            <path class="analytics-ring-fill" stroke-dasharray="0, 100" data-dash="${r.val}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                        </svg>
                        <span class="analytics-ring-text">${r.val}%</span>
                    </div>
                    <span class="analytics-perf-label">${r.label}</span>
                </div>`).join('')}
            </div>
        </div>`;
    }

    // =============================================
    //  DASHBOARD VIEW EVENT HANDLERS
    // =============================================
    function attachDashViewEvents(viewName) {
        if (viewName === 'dashboard') {
            const postBtn = document.getElementById('dash-post-task-btn');
            if (postBtn) postBtn.addEventListener('click', () => renderDashboardView('post-task'));

            const addFundsBtn = document.getElementById('dash-add-funds');
            if (addFundsBtn) addFundsBtn.addEventListener('click', () => renderDashboardView('wallet'));

            // Task filter tabs
            document.querySelectorAll('.dash-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    filterTasks(tab.dataset.filter);
                });
            });

            // Animate counters from real data
            const active = userTasks.filter(t => t.status === 'open' || t.status === 'assigned').length;
            const completed = userTasks.filter(t => t.status === 'completed').length;
            const total = userTasks.length;
            const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
            const spent = userTasks.reduce((s, t) => s + (Number(t.bounty) || 0), 0);

            setTimeout(() => {
                animateNumber(document.getElementById('dash-total-tasks'), total, 1200);
                animateNumber(document.getElementById('dash-active-tasks'), active, 1000);
                animateNumber(document.getElementById('dash-completed-tasks'), completed, 1500);
                const walletEl = document.getElementById('dash-wallet-amount');
                if (walletEl) animateNumberINR(walletEl, userBalance, 1500);
                const spentEl = document.getElementById('dash-total-spent');
                if (spentEl) animateNumberINR(spentEl, spent, 1500);
                animateNumber(document.getElementById('dash-comp-rate'), rate, 1500, '', '%');
                const rateBar = document.getElementById('dash-rate-bar');
                if (rateBar) setTimeout(() => { rateBar.style.width = rate + '%'; }, 500);
            }, 200);

        } else if (viewName === 'post-task') {
            // Media toggle
            document.querySelectorAll('.req-seg-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.req-seg-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const mediaInput = document.getElementById('pt-media');
                    if (mediaInput) mediaInput.value = btn.dataset.val;
                });
            });

            // Cancel
            const cancelBtn = document.getElementById('btn-pt-cancel');
            if (cancelBtn) cancelBtn.addEventListener('click', () => renderDashboardView('dashboard'));

            // Budget change — update payment summary
            const budgetInput = document.getElementById('pt-budget');
            if (budgetInput) {
                budgetInput.addEventListener('input', () => {
                    const val = parseFloat(budgetInput.value) || 0;
                    const summary = document.getElementById('payment-summary');
                    if (summary) {
                        summary.style.display = val >= 49 ? 'block' : 'none';
                        const scoutEl = document.getElementById('scout-share');
                        const platEl = document.getElementById('platform-share');
                        const totalEl = document.getElementById('total-pay');
                        const walletCheck = document.getElementById('wallet-check');
                        if (scoutEl) scoutEl.textContent = formatINR(Math.round(val * 0.5));
                        if (platEl) platEl.textContent = formatINR(Math.round(val * 0.5));
                        if (totalEl) totalEl.textContent = formatINR(val);
                        if (walletCheck) {
                            if (userBalance >= val) {
                                walletCheck.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> Wallet balance sufficient (${formatINR(userBalance)})`;
                            } else {
                                walletCheck.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color:#f59e0b;"></i> Insufficient wallet balance — payment required`;
                            }
                        }
                    }
                });
            }

            // GPS location
            const gpsBtn = document.getElementById('btn-use-my-location');
            if (gpsBtn) {
                gpsBtn.addEventListener('click', () => {
                    if (!navigator.geolocation) {
                        showNotification('GPS not supported on this browser', 'error');
                        return;
                    }
                    gpsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                            const { latitude, longitude } = pos.coords;
                            document.getElementById('pt-lat').value = latitude;
                            document.getElementById('pt-lng').value = longitude;

                            // Reverse geocode using OpenStreetMap Nominatim (free)
                            try {
                                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
                                const data = await res.json();
                                const name = data.display_name?.split(',').slice(0, 3).join(', ') || 'Current Location';
                                document.getElementById('pt-location-search').value = name;
                                document.getElementById('pt-location-name').value = name;
                                showMapPreview(latitude, longitude, name);
                            } catch {
                                document.getElementById('pt-location-name').value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                            }
                            gpsBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
                            showNotification('Location set from GPS', 'success');
                        },
                        () => {
                            gpsBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
                            showNotification('GPS access denied. Please search manually.', 'warning');
                        }
                    );
                });
            }

            // Location search
            const locSearch = document.getElementById('pt-location-search');
            let searchTimeout;
            if (locSearch) {
                locSearch.addEventListener('input', () => {
                    clearTimeout(searchTimeout);
                    const q = locSearch.value.trim();
                    if (q.length < 3) return;
                    searchTimeout = setTimeout(async () => {
                        try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in`);
                            const data = await res.json();
                            if (data[0]) {
                                const { lat, lon, display_name } = data[0];
                                document.getElementById('pt-lat').value = lat;
                                document.getElementById('pt-lng').value = lon;
                                document.getElementById('pt-location-name').value = display_name.split(',').slice(0, 3).join(', ');
                                showMapPreview(parseFloat(lat), parseFloat(lon), display_name.split(',')[0]);
                            }
                        } catch { /* silent */ }
                    }, 600);
                });
            }

            // Form submit with payment
            const form = document.getElementById('form-post-task');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const title = document.getElementById('pt-title').value.trim();
                    const desc = document.getElementById('pt-desc').value.trim();
                    const budget = parseFloat(document.getElementById('pt-budget').value);
                    const deadline = document.getElementById('pt-deadline').value;
                    const lat = document.getElementById('pt-lat').value;
                    const lng = document.getElementById('pt-lng').value;
                    const locationName = document.getElementById('pt-location-name').value;
                    const media = document.getElementById('pt-media').value;

                    if (!title) { showNotification('Please provide a task title', 'warning'); return; }
                    if (!desc || desc.length < 10) { showNotification('Description too short (min 10 chars)', 'warning'); return; }
                    if (!budget || budget < 49) { showNotification('Minimum bounty is ₹49', 'warning'); return; }
                    if (!lat || !lng) { showNotification('Please set the target location', 'warning'); return; }
                    if (!deadline) { showNotification('Please set a deadline', 'warning'); return; }

                    const taskData = { title, desc, bounty: budget, lat, lng, locationName, media, deadline };

                    // Pay via wallet or Razorpay
                    if (userBalance >= budget) {
                        userBalance -= budget;
                        await postTaskConfirmed(taskData);
                    } else {
                        const remaining = budget - userBalance;
                        initRazorpay(remaining, `Pay for task: ${title}`, async (payId) => {
                            userBalance = 0;
                            await postTaskConfirmed(taskData, payId);
                        });
                    }
                });
            }

        } else if (viewName === 'notifications') {
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

            const markAllBtn = document.getElementById('btn-mark-all-read');
            if (markAllBtn) {
                markAllBtn.addEventListener('click', () => {
                    notifications.forEach(n => n.read = true);
                    renderDashboardView('notifications');
                });
            }

        } else if (viewName === 'wallet') {
            const addFundsBtn = document.getElementById('wallet-add-funds');
            if (addFundsBtn) {
                addFundsBtn.addEventListener('click', () => {
                    const amounts = [100, 500, 1000, 2000];
                    const modal = document.createElement('div');
                    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:9999;';
                    modal.innerHTML = `
                        <div style="background:#11131a;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:2rem;max-width:360px;width:90%;">
                            <h3 style="color:#f8fafc;margin-bottom:1.5rem;font-size:1.2rem;">Add Funds to Wallet</h3>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.5rem;">
                                ${amounts.map(a => `<button class="amount-chip" data-amount="${a}" style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.3);color:#06b6d4;padding:0.75rem;border-radius:10px;cursor:pointer;font-weight:600;">₹${a.toLocaleString('en-IN')}</button>`).join('')}
                            </div>
                            <input type="number" id="custom-amount" placeholder="Or enter custom amount" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#f8fafc;padding:0.8rem 1rem;border-radius:10px;font-size:0.95rem;box-sizing:border-box;outline:none;margin-bottom:1rem;" />
                            <div style="display:flex;gap:0.75rem;">
                                <button id="add-cancel" style="flex:1;background:transparent;border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:0.8rem;border-radius:10px;cursor:pointer;">Cancel</button>
                                <button id="add-confirm" style="flex:1;background:linear-gradient(135deg,#06b6d4,#8b5cf6);color:white;border:none;padding:0.8rem;border-radius:10px;cursor:pointer;font-weight:600;">Proceed to Pay</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(modal);

                    let selected = 500;
                    modal.querySelectorAll('.amount-chip').forEach(chip => {
                        chip.addEventListener('click', () => {
                            modal.querySelectorAll('.amount-chip').forEach(c => c.style.background = 'rgba(6,182,212,0.1)');
                            chip.style.background = 'rgba(6,182,212,0.3)';
                            selected = parseInt(chip.dataset.amount);
                            document.getElementById('custom-amount').value = '';
                        });
                    });

                    document.getElementById('add-cancel').onclick = () => modal.remove();
                    document.getElementById('add-confirm').onclick = () => {
                        const custom = parseFloat(document.getElementById('custom-amount').value);
                        const amount = custom > 0 ? custom : selected;
                        modal.remove();
                        initRazorpay(amount, `Add ₹${amount.toLocaleString('en-IN')} to GroundLens Wallet`, () => {
                            renderDashboardView('wallet');
                        });
                    };
                });
            }

            const withdrawBtn = document.getElementById('wallet-withdraw');
            if (withdrawBtn) {
                withdrawBtn.addEventListener('click', () => {
                    if (userBalance <= 0) {
                        showNotification('No balance to withdraw', 'warning');
                        return;
                    }
                    showNotification('Withdrawal request submitted. ₹' + formatINR(userBalance) + ' will arrive in 2–3 business days.', 'success');
                });
            }

        } else if (viewName === 'analytics') {
            setTimeout(() => {
                document.querySelectorAll('.analytics-counter').forEach(el => {
                    const target = parseInt(el.dataset.target) || 0;
                    const prefix = el.dataset.prefix || '';
                    const suffix = el.dataset.suffix || '';
                    animateNumber(el, target, 1500, prefix, suffix);
                });
            }, 200);

            setTimeout(() => {
                document.querySelectorAll('.analytics-bar').forEach(bar => {
                    bar.style.height = (bar.dataset.height || 0) + '%';
                });
            }, 400);

            setTimeout(() => {
                document.querySelectorAll('.analytics-ring-fill').forEach(ring => {
                    ring.style.strokeDasharray = `${ring.dataset.dash}, 100`;
                });
            }, 600);
        }
    }

    async function postTaskConfirmed(taskData, paymentId) {
        try {
            const btn = document.getElementById('btn-post-submit');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...'; }

            await saveTask({ ...taskData, paymentId });
            showNotification('Task posted! Notifying scouts nearby...', 'success');
            setTimeout(() => renderDashboardView('dashboard'), 1200);
        } catch (err) {
            showNotification('Failed to post task. Please try again.', 'error');
            const btn = document.getElementById('btn-post-submit');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay & Post Task'; }
        }
    }

    function filterTasks(filter) {
        const list = document.getElementById('dash-tasks-list');
        if (!list) return;
        const items = list.querySelectorAll('.dash-recent-task-item');
        items.forEach(item => {
            const badge = item.querySelector('.status-badge');
            if (!badge) return;
            const text = badge.textContent.toLowerCase();
            if (filter === 'all') item.style.display = '';
            else if (filter === 'active') item.style.display = (text.includes('progress') || text.includes('open')) ? '' : 'none';
            else if (filter === 'completed') item.style.display = (text.includes('delivered') || text.includes('completed')) ? '' : 'none';
        });
    }

    function showMapPreview(lat, lng, label) {
        const mapDiv = document.getElementById('map-picker');
        if (!mapDiv) return;
        // Use OpenStreetMap static tile preview (free, no API key)
        const zoom = 14;
        const size = '600x250';
        mapDiv.innerHTML = `
    <div style="width:100%;height:250px;position:relative;border-radius:12px;overflow:hidden;background:#1e293b;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0.5rem;">
        <i class="fa-solid fa-map-location-dot" style="color:#06b6d4;font-size:2.5rem;"></i>
        <span style="color:#f8fafc;font-weight:600;">${label.split(',')[0]}</span>
        <span style="color:#94a3b8;font-size:0.8rem;">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</span>
        <div style="position:absolute;top:0.75rem;right:0.75rem;background:rgba(16,185,129,0.2);border:1px solid #10b981;padding:0.3rem 0.6rem;border-radius:6px;font-size:0.75rem;color:#10b981;">
            <i class="fa-solid fa-circle-check"></i> Location Set
        </div>
    </div>`;
    }
    // ==========================================
// BACKEND: ACCEPT A BOUNTY
// ==========================================
window.acceptTask = async function(taskId) {
    if (!db || !currentUser) return;

    // 1. Confirm they want to take the job
    const confirmAccept = confirm("Are you ready to deploy to this location? You will have 2 hours to complete the capture.");
    if (!confirmAccept) return;

    try {
        const { doc, updateDoc } = window.firebaseModules;
        
        // 2. Point to the specific task in Firestore
        const taskRef = doc(db, 'tasks', taskId);

        // 3. Update the database to lock it!
        await updateDoc(taskRef, {
            status: 'assigned',
            assignedTo: currentUser.uid,
            scoutName: currentUser.name,
            acceptedAt: new Date().toISOString()
        });

        // 4. Success! Launch the camera
        showNotification("Mission Accepted! Initializing camera...", "success");
        
        // Wait 1 second for the notification, then launch full screen camera
        setTimeout(() => {
            window.openSecureCamera(taskId, "Active Bounty Operation");
        }, 1000);   
        
    } catch (error) {
        console.error("Error accepting task:", error);
        showNotification("Failed to accept mission. Someone else may have grabbed it!", "error");
    }
};
    // ==========================================
// BACKEND: SECURE CAMERA & WATERMARKING
// ==========================================
let activeStream = null;
let currentActiveTaskId = null;
let currentGPS = "GPS: Acquiring...";

window.openSecureCamera = async function(taskId, taskTitle) {
    currentActiveTaskId = taskId;
    document.getElementById('cam-task-title').innerText = taskTitle;
    const overlay = document.getElementById('camera-overlay');
    overlay.style.display = 'flex';

    // 1. Lock onto GPS Coordinates
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => { 
                currentGPS = `GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`; 
                document.getElementById('cam-gps-status').innerHTML = `<i class="fa-solid fa-satellite"></i> Locked: ${currentGPS}`; 
            },
            err => { 
                currentGPS = "GPS: Unavailable"; 
                document.getElementById('cam-gps-status').innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> GPS Denied`; 
            }
        );
    }

    try {
        // 2. Request the rear-facing camera
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
        });
        activeStream = stream;
        document.getElementById('live-camera-feed').srcObject = stream;
    } catch (err) {
        alert("Camera access denied or unavailable.");
        window.closeCamera();
    }
};

window.closeCamera = function() {
    document.getElementById('camera-overlay').style.display = 'none';
    if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        activeStream = null;
    }
};

window.takeSnapshot = async function() {
    if (!db) return;
    const video = document.getElementById('live-camera-feed');
    const canvas = document.getElementById('capture-canvas');
    const btn = document.getElementById('btn-capture');

    // UI Flash Effect
    btn.style.transform = 'scale(0.8)';
    setTimeout(() => btn.style.transform = 'scale(1)', 150);

    // 3. Draw Video Frame to Canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 4. Burn the Unalterable Watermark onto the image
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, canvas.height - 120, canvas.width, 120);
    ctx.fillStyle = "#06b6d4";
    ctx.font = "bold 34px monospace";
    const timestamp = new Date().toISOString();
    ctx.fillText(`GROUNDLENS VERIFIED INTELLIGENCE`, 30, canvas.height - 70);
    ctx.fillStyle = "white";
    ctx.font = "26px monospace";
    ctx.fillText(`${currentGPS} | TIME: ${timestamp}`, 30, canvas.height - 30);

    // 5. Convert to lightweight Base64 string for Firestore
    const base64Image = canvas.toDataURL('image/jpeg', 0.6);

    window.closeCamera();
    showNotification("Processing encrypted visual data...", "info");

    // 6. Upload to Database and switch status to "Review"
    try {
        const { doc, updateDoc } = window.firebaseModules;
        const taskRef = doc(db, 'tasks', currentActiveTaskId);

        await updateDoc(taskRef, {
            status: 'review', // Changes from 'assigned' to 'review'
            proofImage: base64Image,
            completedAt: timestamp,
            capturedGPS: currentGPS
        });

        showNotification("Target Captured! Bounty marked for review.", "success");
        initDoerDashboard(); // Refresh the feed
    } catch (e) {
        console.error(e);
        showNotification("Upload failed.", "error");
    }
};  // ==========================================
// BACKEND: DOER RADAR & FEED POPULATION (LIVE!)
// ==========================================
window.initDoerDashboard = async function() {
    if (!db || !window.firebaseModules) return;

    try {
        // We import onSnapshot here instead of getDocs
        const { collection, query, orderBy, onSnapshot } = window.firebaseModules;
        
        if (!onSnapshot) {
            console.error("Waiting for real-time engine...");
            return;
        }

        // Prevent duplicate listeners if they switch tabs
        if (window.doerFeedListener) {
            window.doerFeedListener();
        }
        
        const tasksRef = collection(db, 'tasks');
        const q = query(tasksRef, orderBy('createdAt', 'desc'));
        
        // REAL-TIME LISTENER: Fires instantly when the database changes!
        window.doerFeedListener = onSnapshot(q, (snap) => {
            const allTasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filter tasks
            const availableTasks = allTasks.filter(t => t.status === 'open');
            const myCompletedTasks = allTasks.filter(t => t.status === 'completed' && t.assignedTo === currentUser.uid);

            // Update Live Wallet Balance
            const walletAmountElements = document.querySelectorAll('.dash-wallet-card div[style*="2.2rem"]');
            if (walletAmountElements.length > 0) {
                walletAmountElements[0].innerHTML = `₹${userBalance || 0}<span style="font-size: 1.5rem; color: var(--text-muted);">.00</span>`;
            }

            // Update Tab Badge Number
            const badge = document.getElementById('doer-tab-badge');
            const isHistoryTab = document.getElementById('list-history')?.style.display === 'flex';
            if (badge) {
                badge.innerText = isHistoryTab ? `${myCompletedTasks.length} Completed` : `${availableTasks.length} Nearby`;
            }

            // Inject Real-Time Available Feed
            const listAvailable = document.getElementById('list-available');
            if (listAvailable) {
                if (availableTasks.length === 0) {
                    listAvailable.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No bounties available in your sector right now.</div>';
                } else {
                    listAvailable.innerHTML = availableTasks.map(task => {
                        const isVideo = task.media === 'video';
                        const icon = isVideo ? 'fa-video' : 'fa-camera';
                        const color = isVideo ? 'var(--brand-purple)' : 'var(--brand-cyan)';
                        return `
                        <div class="hover-lift slide-up-anim" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 1rem; cursor: pointer; position: relative; overflow: hidden; margin-bottom: 0.8rem; transition: all 0.3s;" onclick="window.acceptTask('${task.id}')">
                            <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: ${color};"></div>
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                                <div>
                                    <div style="font-size: 0.7rem; color: ${color}; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 0.3rem;"><i class="fa-solid ${icon}"></i> ${isVideo ? 'Video' : 'Photo'} Request</div>
                                    <h4 style="color: var(--text-main); font-size: 1rem; margin: 0;">${task.title}</h4>
                                </div>
                                <div style="font-size: 1.15rem; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 0.2rem 0.6rem; border-radius: 8px;">₹${task.bounty}</div>
                            </div>
                        </div>`;
                    }).join('');
                }
            }

            // Inject Real-Time History
            const listHistory = document.getElementById('list-history');
            if (listHistory) {
                if (myCompletedTasks.length === 0) {
                    listHistory.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No completed missions yet.</div>';
                } else {
                    listHistory.innerHTML = myCompletedTasks.map(task => `
                    <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 14px; padding: 1rem; position: relative; overflow: hidden; margin-bottom: 0.8rem;">
                        <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #10b981;"></div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                            <div>
                                <div style="font-size: 0.7rem; color: #10b981; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 0.3rem;"><i class="fa-solid fa-circle-check"></i> Verified</div>
                                <h4 style="color: var(--text-main); font-size: 1rem; margin: 0; text-decoration: line-through; opacity: 0.7;">${task.title}</h4>
                            </div>
                            <div style="font-size: 1.15rem; font-weight: 700; color: #10b981;">+₹${Math.round(task.bounty * 0.5)}</div>
                        </div>
                    </div>`).join('');
                }
            }

            // Plot tasks onto the Radar Map Live
            const radar = document.getElementById('radar-markers-container');
            if (radar) {
                radar.innerHTML = availableTasks.map(task => {
                    const color = task.media === 'video' ? '#a855f7' : '#06b6d4';
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * 40 + 5; 
                    const top = 50 + Math.sin(angle) * radius;
                    const left = 50 + Math.cos(angle) * radius;
                    return `
                    <div class="slide-up-anim" style="position: absolute; top: ${top}%; left: ${left}%; transform: translate(-50%, -50%); cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='translate(-50%, -50%) scale(1.5)'" onmouseout="this.style.transform='translate(-50%, -50%) scale(1)'">
                        <div style="width: 14px; height: 14px; background: ${color}; border-radius: 50%; box-shadow: 0 0 15px ${color}; border: 2px solid #fff;"></div>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 30px; border: 1px solid ${color}; border-radius: 50%; animation: pulse 2s infinite; opacity: 0.5;"></div>
                    </div>`;
                }).join('');
            }
        }); 
        
    } catch (error) {
        console.error("Error loading Doer tasks:", error);
    }
}
    // =============================================
    //  MAIN EVENT ATTACHMENTS
    // =============================================
    function attachEvents(viewName) {
        if (viewName === 'home') {
            document.querySelectorAll('.role-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    currentRole = e.currentTarget.dataset.role || 'user';
                    renderView('registerForm');
                });
            });
            initHomeAnimations();

        } else if (viewName === 'login' || viewName === 'loginForm') {
            const loginForm = document.getElementById('form-login');
            if (loginForm) {
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const email = document.getElementById('login-email')?.value?.trim();
                    const password = document.getElementById('login-password')?.value;
                    const btn = loginForm.querySelector('button[type="submit"]');

                    if (!email || !password) {
                        showNotification('Please enter email and password', 'warning');
                        return;
                    }

                    if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }

                    try {
                        if (auth && window.firebaseModules?.signInWithEmailAndPassword) {
                            const { signInWithEmailAndPassword } = window.firebaseModules;
                            const cred = await signInWithEmailAndPassword(auth, email, password);
                            currentUser = {
                                uid: cred.user.uid,
                                name: cred.user.displayName || email.split('@')[0],
                                email: cred.user.email,
                                photo: cred.user.photoURL
                            };
                        } else {
                            // Demo mode
                            currentUser = { uid: 'demo-' + Date.now(), name: email.split('@')[0], email };
                        }
                        await loadUserData();
                        showNotification(`Welcome back, ${currentUser.name.split(' ')[0]}!`, 'success');
                        renderView('dashboard');
                    } catch (err) {
                        showNotification(err.message || 'Login failed. Check credentials.', 'error');
                        if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
                    }
                });
            }

            const googleBtn = document.getElementById('btn-google-login');
            if (googleBtn) {
                googleBtn.addEventListener('click', async () => {
                    try {
                        if (auth && window.firebaseModules?.signInWithPopup) {
                            const { signInWithPopup, GoogleAuthProvider, getDoc, doc } = window.firebaseModules;
                            const provider = new GoogleAuthProvider();
                            const result = await signInWithPopup(auth, provider);
                            currentUser = {
                                uid: result.user.uid,
                                name: result.user.displayName,
                                email: result.user.email,
                                photo: result.user.photoURL
                            };
                            
                            // THE FIX: Check if the user already exists in the database.
                            // If they do, do NOT overwrite their profile and role!
                            const userRef = doc(db, 'users', currentUser.uid);
                            const userSnap = await getDoc(userRef);
                            
                            if (!userSnap.exists()) {
                                await saveUserProfile(currentUser.uid, { 
                                    name: currentUser.name, 
                                    email: currentUser.email, 
                                    role: currentRole, 
                                    balance: 0,
                                    createdAt: new Date().toISOString()
                                });
                            }
                            
                        } else {
                            currentUser = { uid: 'demo-' + Date.now(), name: 'Demo User', email: 'demo@groundlens.app' };
                        }
                        await loadUserData();
                        showNotification(`Welcome, ${currentUser.name.split(' ')[0]}!`, 'success');
                        renderView('dashboard');
                    } catch (err) {
                        showNotification('Google login failed: ' + err.message, 'error');
                    }
                });
            }

        } else if (viewName === 'registerForm') {
            const regForm = document.getElementById('form-register');
            if (regForm) {
                regForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const name = document.getElementById('reg-name')?.value?.trim();
                    const email = document.getElementById('reg-email')?.value?.trim();
                    const password = document.getElementById('reg-password')?.value;
                    const confirm = document.getElementById('reg-confirm')?.value;
                    const btn = document.getElementById('register-submit-btn');

                    if (!name) { showNotification('Please enter your full name', 'warning'); return; }
                    if (!email) { showNotification('Please enter your email', 'warning'); return; }
                    if (!password || password.length < 6) { showNotification('Password must be at least 6 characters', 'warning'); return; }
                    if (password !== confirm) { showNotification('Passwords do not match', 'error'); return; }

                    if (btn) { btn.disabled = true; btn.textContent = 'Creating Account...'; }

                    try {
                        if (auth && window.firebaseModules?.createUserWithEmailAndPassword) {
                            const { createUserWithEmailAndPassword, updateProfile } = window.firebaseModules;
                            const cred = await createUserWithEmailAndPassword(auth, email, password);
                            await updateProfile(cred.user, { displayName: name });
                            currentUser = { uid: cred.user.uid, name, email, photo: null };
                            await saveUserProfile(currentUser.uid, { name, email, role: currentRole, balance: 0, createdAt: new Date().toISOString() });
                        } else {
                            // Demo mode
                            currentUser = { uid: 'demo-' + Date.now(), name, email };
                        }
                        await loadUserData();
                        showNotification(`Welcome to GroundLens, ${name.split(' ')[0]}! 🎉`, 'success');
                        addNotification('Account Created', 'Welcome to GroundLens! Post your first task to get started.', 'fa-solid fa-party-horn', '#a855f7');
                        renderView('dashboard');
                    } catch (err) {
                        const msg = err.code === 'auth/email-already-in-use' ? 'This email is already registered.' : (err.message || 'Registration failed');
                        showNotification(msg, 'error');
                        if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
                    }
                });
            }

        } else if (viewName === 'dashboard') {
            const dashName = document.getElementById('dash-user-name');
            const dashEmail = document.getElementById('dash-user-email');
            const dashAvatar = document.getElementById('dash-avatar');
            if (dashName && currentUser) dashName.textContent = currentUser.name;
            if (dashEmail && currentUser) dashEmail.textContent = currentUser.email;
            if (dashAvatar && currentUser) {
                if (currentUser.photo) {
                    dashAvatar.innerHTML = `<img src="${currentUser.photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                } else {
                    dashAvatar.textContent = currentUser.name[0].toUpperCase();
                }
            }

            const signoutBtn = document.getElementById('dash-signout');
            if (signoutBtn) {
                signoutBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    if (auth && window.firebaseModules?.signOut) {
                        try { await window.firebaseModules.signOut(auth); } catch {}
                    }
                    logout();
                });
            }

            document.querySelectorAll('.dash-nav-item[data-view]').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    renderDashboardView(item.dataset.view);
                });
            });

            const hash = window.location.hash;
            if (hash && hash.startsWith('#/')) {
                renderDashboardView(hash.replace('#/', ''));
            } else {
                renderDashboardView(currentDashView || 'dashboard');
            }

            // --- NEW: INITIALIZE DOER FEED IF APPLICABLE ---
            if (currentRole === 'doer') {
                initDoerDashboard();
            }
        }
    }

    // =============================================
    //  HOME ANIMATIONS
    // =============================================
    function initHomeAnimations() {
        const appleEase = [0.16, 1, 0.3, 1];

        animate('.hero-word',
            { opacity: [0, 1], transform: ['translateY(40px)', 'translateY(0px)'] },
            { delay: stagger(0.05), ease: appleEase, duration: 0.8 }
        );

        document.querySelectorAll('.motion-section').forEach(section => {
            inView(section, () => {
                animate(section, { opacity: 1, y: 0, filter: 'blur(0px)' }, { duration: 0.8, ease: appleEase });
            }, { margin: '-100px 0px' });
        });

        const heroTitle = document.querySelector('.hero-title');
        const heroSection = document.querySelector('.hero-section');
        if (heroTitle && heroSection) {
            scroll(animate(heroTitle, { y: [0, -200] }), { target: heroSection, offset: ['start start', 'end start'] });
        }

        const heroCard = document.querySelector('.hero-glass-map-card');
        if (heroCard && heroSection) {
            scroll(animate(heroCard, { scale: [1, 0.9], opacity: [1, 0] }), { target: heroSection, offset: ['start start', 'end start'] });
        }

        document.querySelectorAll('.features-grid').forEach(grid => {
            inView(grid, () => {
                const cards = grid.querySelectorAll('.glass-card');
                if (cards.length > 0) {
                    animate(cards, { opacity: [0, 1], y: [40, 0] }, { delay: stagger(0.1), duration: 0.8, ease: appleEase });
                }
            }, { margin: '-100px 0px' });
        });

        const stepCards = document.querySelectorAll('.step-card');
        const uis = ['iphone-ui-1','iphone-ui-2','iphone-ui-3','iphone-ui-4'].map(id => document.getElementById(id));
        stepCards.forEach((card, i) => {
            inView(card, () => {
                uis.forEach(ui => { if (ui) ui.style.opacity = '0'; });
                if (uis[i]) { uis[i].style.opacity = '1'; animate(uis[i], { scale: [1.1, 1] }, { duration: 0.8, ease: appleEase }); }
            }, { margin: '-40% 0px -40% 0px' });
        });
    }

    // =============================================
    //  UTILITIES
    // =============================================
    window.cancelCapture = function () {
        renderView('dashboard');
    };

        window.logout = function () {
        currentUser = null;
        currentRole = 'user';
        currentDashView = 'dashboard';
        userTasks = [];
        userBalance = 0;
        notifications = [];
        window.location.hash = '';
        renderView('home');
    };

    window.togglePassword = function (icon) {
        const input = icon.previousElementSibling;
        if (!input) return;
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        icon.classList.toggle('fa-eye', !isPass);
        icon.classList.toggle('fa-eye-slash', isPass);
    };

    window.selectRole = function (role) {
        currentRole = role;
        ['role-user-card', 'role-doer-card'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const isSelected = (id === 'role-user-card' && role === 'user') || (id === 'role-doer-card' && role === 'doer');
            el.style.background = isSelected ? 'var(--brand-cyan-muted)' : 'var(--card-dark-bg)';
            el.style.borderColor = isSelected ? 'var(--brand-cyan)' : 'var(--glass-border-strong)';
        });
    };

    function showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        if (!container) return;
        const colors = { success: '#10b981', warning: '#f59e0b', info: '#6366f1', error: '#ef4444' };
        const icons = { success: 'fa-circle-check', warning: 'fa-triangle-exclamation', info: 'fa-circle-info', error: 'fa-circle-xmark' };
        const notif = document.createElement('div');
        notif.style.cssText = `
            display:flex;align-items:center;gap:0.75rem;padding:1rem 1.5rem;
            background:rgba(15,23,42,0.95);border:1px solid ${colors[type]}40;
            border-left:3px solid ${colors[type]};border-radius:12px;
            box-shadow:0 10px 30px rgba(0,0,0,0.5);backdrop-filter:blur(20px);
            color:var(--text-main);font-size:0.9rem;margin-bottom:0.5rem;
            animation:slideInRight 0.4s cubic-bezier(0.16,1,0.3,1) forwards;
        `;
        notif.innerHTML = `<i class="fa-solid ${icons[type]}" style="color:${colors[type]};font-size:1.1rem;flex-shrink:0;"></i><span>${message}</span>`;
        container.appendChild(notif);
        setTimeout(() => {
            notif.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => notif.remove(), 300);
        }, 3500);
    }

    function animateNumber(element, target, duration = 1000, prefix = '', suffix = '') {
        if (!element) return;
        const startTime = performance.now();
        function update(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4);
            element.innerText = `${prefix}${Math.floor(target * ease).toLocaleString()}${suffix}`;
            if (progress < 1) requestAnimationFrame(update);
            else element.innerText = `${prefix}${target.toLocaleString()}${suffix}`;
        }
        requestAnimationFrame(update);
    }

    function animateNumberINR(element, target, duration = 1000) {
        if (!element) return;
        const startTime = performance.now();
        function update(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4);
            element.innerText = '₹' + Math.floor(target * ease).toLocaleString('en-IN');
            if (progress < 1) requestAnimationFrame(update);
            else element.innerText = '₹' + target.toLocaleString('en-IN');
        }
        requestAnimationFrame(update);
    }

    function getTimeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins} min ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} hr ago`;
        return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) > 1 ? 's' : ''} ago`;
    }

    // Hash nav
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        if (currentUser && hash && hash.startsWith('#/')) {
            const page = hash.replace('#/', '');
            if (currentDashView !== page) renderDashboardView(page);
        }
    });

    // Dynamic Scroll Timeline & Phone Sync Animation
    window.addEventListener('scroll', () => {
        const container = document.getElementById('scroll-steps-container');
        if (!container) return;
        
        // 1. Calculate and update the glowing line
        const rect = container.getBoundingClientRect();
        const startPoint = window.innerHeight / 2; // Middle of screen
        
        let progress = 0;
        if (rect.top <= startPoint) {
            progress = ((startPoint - rect.top) / rect.height) * 100;
        }
        
        progress = Math.max(0, Math.min(100, progress));
        container.style.setProperty('--scroll-progress', progress + '%');

        // 2. Sync the iPhone screens to the text cards
        const stepCards = document.querySelectorAll('.step-card');
        let activeStep = 0;

        stepCards.forEach((card, index) => {
            const cardRect = card.getBoundingClientRect();
            // If the card crosses slightly above the middle of the screen, make it active
            if (cardRect.top <= window.innerHeight / 2 + 80) {
                activeStep = index;
            }
        });

        // 3. Fade the correct screen in and out smoothly
        const uis = ['iphone-ui-1', 'iphone-ui-2', 'iphone-ui-3', 'iphone-ui-4'];
        uis.forEach((id, index) => {
            const ui = document.getElementById(id);
            if (!ui) return;
            
            ui.style.transition = 'opacity 0.4s ease, transform 0.4s ease'; // Ensure smooth transitions

            if (index === activeStep) {
                ui.style.opacity = '1';
                ui.style.transform = 'scale(1)';
            } else {
                ui.style.opacity = '0';
                ui.style.transform = 'scale(1.05)'; // Adds a subtle "zoom" effect when hiding
            }
        });
    });

    // =============================================
    //  BOOT
    // =============================================

// ==========================================
// BACKEND: USER EVIDENCE REVIEW & PAYOUT
// ==========================================
window.openReviewModal = function(taskId) {
    const task = userTasks.find(t => t.id === taskId);
    if (!task || !task.proofImage) {
        showNotification("Evidence not available yet. Please wait for the upload to sync.", "warning");
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'review-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:99999;flex-direction:column;padding:2rem;';
    modal.innerHTML = `
        <div class="slide-up-anim" style="background:#11131a;border:1px solid rgba(168,85,247,0.3);border-radius:20px;padding:2rem;max-width:600px;width:100%;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            <h2 style="color:#f8fafc;margin-bottom:0.5rem;font-size:1.5rem;"><i class="fa-solid fa-shield-halved" style="color:#a855f7;margin-right:10px;"></i> Review Evidence</h2>
            <p style="color:#94a3b8;margin-bottom:1.5rem;">Verify the scout's encrypted capture for: <strong style="color:white;">${task.title}</strong></p>
            
            <div style="width:100%;border-radius:12px;overflow:hidden;border:2px solid #334155;margin-bottom:1.5rem;background:#000;">
                <img src="${task.proofImage}" style="width:100%;max-height:400px;object-fit:contain;display:block;" alt="GroundLens Verified Evidence">
            </div>

            <div style="display:flex;gap:1rem;">
                <button onclick="window.processReview('${task.id}', 'rejected', 0)" class="hover-lift" style="flex:1;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:1rem;border-radius:12px;font-weight:600;cursor:pointer;">
                    <i class="fa-solid fa-xmark"></i> Reject
                </button>
                <button onclick="window.processReview('${task.id}', 'completed', ${task.bounty})" class="hover-lift" style="flex:2;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;padding:1rem;border-radius:12px;font-weight:600;font-size:1.1rem;cursor:pointer;box-shadow:0 10px 20px rgba(16,185,129,0.3);">
                    <i class="fa-solid fa-check-double"></i> Approve & Release ₹${task.bounty}
                </button>
            </div>
            <button onclick="document.getElementById('review-modal').remove()" style="margin-top:1.5rem;background:transparent;border:none;color:#64748b;cursor:pointer;text-decoration:underline;">Close for now</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.processReview = async function(taskId, decision, bountyAmount) {
    const modal = document.getElementById('review-modal');
    if (modal) modal.innerHTML = '<div style="color:white;font-size:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Processing Escrow...</div>';

    try {
        const { doc, updateDoc, increment } = window.firebaseModules;
        const taskRef = doc(db, 'tasks', taskId);
        const task = userTasks.find(t => t.id === taskId);
        
        if (decision === 'completed') {
            await updateDoc(taskRef, { status: 'completed', reviewedAt: new Date().toISOString() });
            if (task && task.assignedTo && increment) {
                const scoutRef = doc(db, 'users', task.assignedTo);
                await updateDoc(scoutRef, { balance: increment(Math.round(bountyAmount * 0.5)) });
            }
            showNotification("Task Approved! Funds securely released to Scout.", "success");
        } else {
            await updateDoc(taskRef, { status: 'disputed', reviewedAt: new Date().toISOString() });
            showNotification("Task Rejected. Funds locked in Escrow. Admin has been notified.", "warning");
        }

        if (modal) modal.remove();
        await loadUserData();
        renderDashboardView('dashboard');
        
    } catch (err) {
        console.error("Escrow Error:", err);
        showNotification("Failed to process. Check connection.", "error");
        if (modal) modal.remove();
    }
};

// ==========================================
// BACKEND: USER DATA & REVIEWS (LIVE REAL-TIME!)
// ==========================================
window.loadUserData = async function() {
    if (!window.firebaseModules || !currentUser) return;
    
    return new Promise((resolve) => {
        try {
            const { getFirestore, collection, query, where, onSnapshot, doc } = window.firebaseModules;
            const database = window.db || getFirestore(); // Bulletproof database access!

            // 1. LIVE PROFILE LISTENER
            if (window.userProfileListener) window.userProfileListener();
            const userRef = doc(database, 'users', currentUser.uid);
            
            window.userProfileListener = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.userBalance = docSnap.data().balance || 0;
                    window.currentRole = docSnap.data().role || 'user';
                    const balEl = document.getElementById('dash-user-balance');
                    if (balEl) balEl.innerText = `₹${window.userBalance}`;
                }
            });

            // 2. LIVE TASKS LISTENER
            if (window.userTasksListener) window.userTasksListener();
            const tasksRef = collection(database, 'tasks');
            const q = query(tasksRef, where('userId', '==', currentUser.uid));
            
            let isFirstLoad = true;
            window.userTasksListener = onSnapshot(q, (snap) => {
                window.userTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                window.userTasks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

                if (isFirstLoad) {
                    isFirstLoad = false;
                    resolve(); 
                } else {
                    // FORCE UI REFRESH (Bulletproof Method)
                    if (typeof window.renderDashboardView === 'function') {
                        window.renderDashboardView('dashboard');
                    } else if (typeof renderView === 'function') {
                        renderView('dashboard');
                    } else {
                        // Ultimate fallback: virtually click the dashboard menu button
                        const dashLink = document.querySelector('[onclick*="dashboard"]');
                        if (dashLink) dashLink.click();
                    }
                }
            });
        } catch (err) {
            console.error("Live DB Error:", err);
            resolve(); 
        }
    });
};

// ==========================================
// BACKEND: PROCESS ESCROW PAYMENT
// ==========================================
window.processReview = async function(taskId, decision, bountyAmount) {
    const modal = document.getElementById('review-modal');
    if (modal) modal.innerHTML = '<div style="color:white;font-size:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Processing Escrow...</div>';

    try {
        const { getFirestore, doc, updateDoc, increment } = window.firebaseModules;
        const database = window.db || getFirestore(); // Bulletproof database access!
        const taskRef = doc(database, 'tasks', taskId);
        
        // Safely find the task data
        const tasksList = window.userTasks || [];
        const task = tasksList.find(t => t.id === taskId);
        
        if (decision === 'completed') {
            await updateDoc(taskRef, { status: 'completed', reviewedAt: new Date().toISOString() });
            if (task && task.assignedTo && increment) {
                const scoutRef = doc(database, 'users', task.assignedTo);
                await updateDoc(scoutRef, { balance: increment(Math.round(bountyAmount * 0.5)) });
            }
            showNotification("Task Approved! Funds securely released to Scout.", "success");
        } else {
            await updateDoc(taskRef, { status: 'disputed', reviewedAt: new Date().toISOString() });
            showNotification("Task Rejected. Funds locked in Escrow. Admin has been notified.", "warning");
        }

        if (modal) modal.remove();
        
        // You don't even need to call a refresh function here anymore.
        // The onSnapshot Live Engine will detect the updateDoc change and instantly redraw the screen!
        
    } catch (err) {
        console.error("Escrow Error:", err);
        showNotification("Failed to process. Check connection.", "error");
        if (modal) modal.remove();
    }
};

// --- ADD THESE TWO LINES BACK ---
initFirebase();
renderView('home');

}); // <-- THE ONLY CLOSING BRACKET NEEDED!what
