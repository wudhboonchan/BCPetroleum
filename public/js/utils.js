// ===========================================
// BC PETROLEUM V2 - UTILITY FUNCTIONS
// Modern Glassmorphism Design System
// ===========================================

// API Helper Functions (Same as original but updated for v2 paths)
const API = {
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            const contentType = response.headers.get('content-type');
            let data;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = { error: `Server returned ${response.status} ${response.statusText}`, details: text };
            }

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('user');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(data.error || `Request failed (${response.status})`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    get(url, params) {
        if (params) {
            const queryString = new URLSearchParams(params).toString();
            url = `${url}?${queryString}`;
        }
        return this.request(url);
    },

    post(url, body) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    put(url, body) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    },

    delete(url) {
        return this.request(url, {
            method: 'DELETE',
        });
    },
};

// Authentication Helper
const Auth = {
    async login(username, password) {
        const data = await API.post('/api/auth/login', { username, password });
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
        }
        return data;
    },

    async logout() {
        API.post('/api/auth/logout').catch(err => console.error('Logout API err:', err));
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('/login.html?logout=true');
    },

    async getUser() {
        try {
            const data = await API.get('/api/auth/me');
            return data.user;
        } catch (error) {
            return null;
        }
    },

    isAuthenticated() {
        return localStorage.getItem('user') !== null;
    },

    getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
        }
    },

    setupTopBar() {
        // 1. Update Profile UI
        const user = this.getCurrentUser();
        if (user) {
            const nameEl = document.getElementById('userName');
            const roleEl = document.getElementById('userRole');
            const avatarEl = document.getElementById('userAvatar');

            // Show Name or Username, fallback to 'ผู้ใช้งาน'
            if (nameEl) nameEl.textContent = user.name || user.username || 'ผู้ใช้งาน';

            // Show Role
            if (roleEl) roleEl.textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : (user.role || 'ผู้ใช้งาน');

            // Avatar Initials
            if (avatarEl) {
                const source = user.name || user.username || 'U';
                avatarEl.textContent = source[0].toUpperCase();
            }
        }

        // 2. User Dropdown
        const userProfileBtn = document.querySelector('.user-profile');
        const userDropdown = document.getElementById('userDropdown');
        if (userProfileBtn && userDropdown) {
            // Remove existing listeners by cloning and replacing
            const newBtn = userProfileBtn.cloneNode(true);
            userProfileBtn.parentNode.replaceChild(newBtn, userProfileBtn);

            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('User profile clicked'); // Debug
                userDropdown.classList.toggle('active');
                console.log('Dropdown active:', userDropdown.classList.contains('active')); // Debug
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!newBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                    userDropdown.classList.remove('active');
                }
            });

            // Prevent dropdown from closing when clicking inside it
            userDropdown.addEventListener('click', (e) => e.stopPropagation());
        }

        // 3. Logout Event
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            const newLogout = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newLogout, logoutBtn);

            newLogout.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Logout clicked'); // Debug
                Modal.confirm('ออกจากระบบ', 'คุณต้องการออกจากระบบใช่หรือไม่?', () => this.logout());
            });
        }

        // 4. Date Display
        const dateEl = document.getElementById('currentDate');
        if (dateEl && window.DateUtils) {
            dateEl.textContent = window.DateUtils.getThaiDate();
        }

        // 5. Mobile Menu
        this.setupMobileMenu();
    },

    setupMobileMenu() {
        const menuToggle = document.getElementById('menuToggle');
        const nav = document.querySelector('.top-bar-nav');

        if (menuToggle && nav) {
            // Clone to remove old listeners
            const newToggle = menuToggle.cloneNode(true);
            menuToggle.parentNode.replaceChild(newToggle, menuToggle);

            newToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                nav.classList.toggle('mobile-active');
                newToggle.classList.toggle('active');
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!nav.contains(e.target) && !newToggle.contains(e.target)) {
                    nav.classList.remove('mobile-active');
                    newToggle.classList.remove('active');
                }
            });

            // Close menu when clicking a link
            nav.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    nav.classList.remove('mobile-active');
                    newToggle.classList.remove('active');
                });
            });
        }
    },
};

// Date Formatting (Same as original)
const DateUtils = {
    getThaiDate(date = new Date()) {
        const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const thaiMonths = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];

        const d = new Date(date);
        const dayName = thaiDays[d.getDay()];
        const day = d.getDate();
        const month = thaiMonths[d.getMonth()];
        const year = d.getFullYear() + 543;

        return `วัน${dayName}ที่ ${day} ${month} ${year}`;
    },

    formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        if (format === 'YYYY-MM-DD') {
            return `${year}-${month}-${day}`;
        } else if (format === 'DD/MM/YYYY') {
            return `${day}/${month}/${year}`;
        }
        return date;
    },

    getTodayString() {
        return this.formatDate(new Date());
    },

    getYesterdayString() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return this.formatDate(yesterday);
    },

    formatThaiDate(dateStr) {
        const thaiMonths = [
            'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
            'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ];

        const d = new Date(dateStr);
        const day = d.getDate();
        const month = thaiMonths[d.getMonth()];
        const year = d.getFullYear() + 543;

        return `${day} ${month} ${year}`;
    },
};

// Number Formatting (Same as original)
const NumberUtils = {
    formatCurrency(value) {
        return new Intl.NumberFormat('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    },

    formatNumber(value, decimals = 0) {
        return new Intl.NumberFormat('th-TH', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(value);
    },

    formatLiters(value) {
        return parseFloat(value).toFixed(3);
    },
};

// Modern Toast Notifications with Glassmorphism
const Toast = {
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${this.getIcon(type)}</div>
            <div class="toast-message">${message}</div>
        `;

        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 1rem;
            color: white;
            font-weight: 500;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 30000;
            animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            max-width: 400px;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        const colors = {
            success: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            error: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            warning: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        };

        toast.style.background = colors[type] || colors.info;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    },

    success(message, duration) {
        this.show(message, 'success', duration);
    },

    error(message, duration) {
        this.show(message, 'error', duration);
    },

    warning(message, duration) {
        this.show(message, 'warning', duration);
    },

    info(message, duration) {
        this.show(message, 'info', duration);
    },
};

// Add modern animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  .toast-icon {
    font-size: 1.25rem;
    font-weight: bold;
  }

  .toast-message {
    flex: 1;
  }
`;
document.head.appendChild(style);

// Modern Loading Spinner with Glassmorphism
const Loading = {
    show(element) {
        const spinner = document.createElement('div');
        spinner.className = 'loading';
        spinner.innerHTML = '<div class="spinner"></div>';
        spinner.id = 'loading-spinner';

        if (element) {
            element.appendChild(spinner);
        } else {
            document.body.appendChild(spinner);
            spinner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(15, 15, 30, 0.8);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 30000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
        }
    },

    hide() {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.remove();
        }
    },
};

// Modern Modal Dialog with Glassmorphism
const Modal = {
    confirm(title, message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="modal-cancel">ยกเลิก</button>
                    <button class="btn btn-primary" id="modal-confirm">ยืนยัน</button>
                </div>
            </div>
        `;

        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease;
        `;

        const dialog = modal.querySelector('.modal-dialog');
        dialog.style.cssText = `
            background: #ffffff;
            padding: 2rem;
            border-radius: 1rem;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            color: #1f2937;
            border: 1px solid #e5e7eb;
        `;

        // Add additional styles for headings and text
        const titleEl = modal.querySelector('h3');
        if (titleEl) {
            titleEl.style.cssText = `
                margin-top: 0;
                color: #000000; /* Pure black for maximum contrast */
                font-weight: 700; /* Bolder */
                font-size: 1.35rem; /* Slightly larger */
                margin-bottom: 1rem;
            `;
        }

        const textEl = modal.querySelector('p');
        if (textEl) {
            textEl.style.cssText = `
                color: #333333; /* Dark gray, almost black */
                line-height: 1.6;
                font-size: 1.05rem;
                font-weight: 500;
            `;

            // Should verify if we can target nested small tags via JS directly or if we rely on CSS inheritance/selectors?
            // Since this sets inline styles on the <p>, nested elements might need their own check or rely on inheritance.
            // But the accounting.js passed inline styles: style="color: #64748b;"
            // We'll update the innerHTML handling in accounting.js to use better colors, 
            // OR we can try to force color here if possible, but JS style.cssText on <p> won't override inline style of children.

            // Let's modify the small tags if present
            const smallTags = textEl.querySelectorAll('small');
            smallTags.forEach(small => {
                small.style.cssText = `
                   display: block;
                   margin-top: 0.5rem;
                   color: #4b5563 !important; /* Force darker gray for secondary text */
                   font-size: 0.9rem;
                   font-weight: 400;
               `;
            });
        }

        const actions = modal.querySelector('.modal-actions');
        actions.style.cssText = `
            display: flex;
            gap: 1rem;
            margin-top: 1.5rem;
            justify-content: flex-end;
        `;

        document.body.appendChild(modal);

        modal.querySelector('#modal-cancel').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('#modal-confirm').addEventListener('click', () => {
            modal.remove();
            if (onConfirm) onConfirm();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },
};

// Form Validation (Same as original)
const Validator = {
    required(value, fieldName) {
        if (!value || value.trim() === '') {
            return `${fieldName}จำเป็นต้องกรอก`;
        }
        return null;
    },

    number(value, fieldName) {
        if (isNaN(value)) {
            return `${fieldName}ต้องเป็นตัวเลข`;
        }
        return null;
    },

    minValue(value, min, fieldName) {
        if (parseFloat(value) < min) {
            return `${fieldName}ต้องมากกว่าหรือเท่ากับ ${min}`;
        }
        return null;
    },

    maxValue(value, max, fieldName) {
        if (parseFloat(value) > max) {
            return `${fieldName}ต้องน้อยกว่าหรือเท่ากับ ${max}`;
        }
        return null;
    },
};

// Chart Helper for V2 (Updated colors for new design)
const ChartUtils = {
    fuelColors: {
        e91: {
            background: 'rgba(239, 68, 68, 0.2)', // Red
            border: '#ef4444',
        },
        e95: {
            background: 'rgba(16, 185, 129, 0.2)', // Green
            border: '#10b981',
        },
        b7: {
            background: 'rgba(59, 130, 246, 0.2)', // Blue
            border: '#3b82f6',
        },
    },

    setupChartDefaults() {
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = "'Bai Jamjuree', 'Sarabun', 'Inter', sans-serif";
            Chart.defaults.font.size = 14;
            Chart.defaults.color = '#334155'; // Slate 700

            // Common tooltip styles
            Chart.defaults.plugins.tooltip.titleFont = {
                family: "'Bai Jamjuree', 'Sarabun', 'Inter', sans-serif",
                size: 14,
                weight: '600'
            };
            Chart.defaults.plugins.tooltip.bodyFont = {
                family: "'Bai Jamjuree', 'Sarabun', 'Inter', sans-serif",
                size: 13
            };
        }
    }
};

// Check if Chart is loaded and setup defaults
if (typeof Chart !== 'undefined') {
    ChartUtils.setupChartDefaults();
}

// Make utilities globally available
window.API = API;
window.Auth = Auth;
window.DateUtils = DateUtils;
window.NumberUtils = NumberUtils;
window.Toast = Toast;
window.Loading = Loading;
window.Modal = Modal;
window.Validator = Validator;
window.ChartUtils = ChartUtils;

// Use Flatpickr to enforce DD/MM/YYYY date formatting completely across all browsers (including Safari)
document.addEventListener('DOMContentLoaded', () => {
    const dateInputs = document.querySelectorAll('input[type="date"]');
    if (dateInputs.length === 0) return;

    // Load Flatpickr CSS
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
    document.head.appendChild(css);

    // Custom CSS to match the app's clean glassmorphism theme
    const customCss = document.createElement('style');
    customCss.innerHTML = `
        .flatpickr-calendar {
            font-family: inherit !important;
            border-radius: 12px !important;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1) !important;
            border: none !important;
        }
        .flatpickr-day.selected {
            background: #2563eb !important;
            border-color: #2563eb !important;
        }
        /* Ensure the alt input looks like a normal input and NOT full width */
        .flatpickr-input[readonly] {
            background-color: #ffffff !important;
            width: auto !important;
            min-width: 140px !important;
            max-width: 200px !important;
        }
    `;
    document.head.appendChild(customCss);

    // Load Flatpickr JS & setup
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
    script.onload = () => {
        const thScript = document.createElement('script');
        thScript.src = 'https://npmcdn.com/flatpickr/dist/l10n/th.js';
        thScript.onload = () => {
            // Apply to all date inputs
            // altInputClass is key: we do NOT pass 'form-control' here, 
            // so the alt input won't inherit width:100% and will stay compact.
            flatpickr(dateInputs, {
                altInput: true,
                altFormat: "d/m/Y",
                dateFormat: "Y-m-d",
                altInputClass: "date-display-input",
                locale: "th",
                disableMobile: true
            });

            // Copy color/font from original so it matches the page theme
            dateInputs.forEach(input => {
                const altInput = input.nextElementSibling;
                if (altInput && altInput.classList.contains('flatpickr-input')) {
                    if (input.style.color) altInput.style.color = input.style.color;
                    if (input.style.fontSize) altInput.style.fontSize = input.style.fontSize;
                    if (input.style.fontWeight) altInput.style.fontWeight = input.style.fontWeight;
                }
            });
        };
        document.head.appendChild(thScript);
    };
    document.head.appendChild(script);
});
