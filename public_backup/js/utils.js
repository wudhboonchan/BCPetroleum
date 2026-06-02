// API Helper Functions
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
                // If not JSON (e.g. HTML error page), read as text
                const text = await response.text();
                data = { error: `Server returned ${response.status} ${response.statusText}`, details: text };
            }

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/login';
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
        // Fire and forget API call
        API.post('/api/auth/logout').catch(err => console.error('Logout API err:', err));
        
        // Clear local state
        localStorage.clear();
        sessionStorage.clear();
        
        // Force redirect with flag
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
            window.location.href = '/login';
        }
    },
};

// Date Formatting
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

    // Format date string to Thai short format
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

// Number Formatting
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
        // Format meter readings without commas, just decimal with 3 places
        return parseFloat(value).toFixed(3);
    },
};

// Toast Notifications
const Toast = {
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      color: white;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      animation: slideInRight 0.3s ease;
      max-width: 400px;
    `;

        const colors = {
            success: 'linear-gradient(135deg, #00C896, #00A878)',
            error: 'linear-gradient(135deg, #FF6B6B, #E63946)',
            warning: 'linear-gradient(135deg, #FFB84D, #FF9A3D)',
            info: 'linear-gradient(135deg, #00A8E8, #7B68EE)',
        };

        toast.style.background = colors[type] || colors.info;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
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

// Add animation styles
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
`;
document.head.appendChild(style);

// Loading Spinner
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
        background: rgba(255, 255, 255, 0.9);
        z-index: 9998;
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

// Modal Dialog
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
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

        const dialog = modal.querySelector('.modal-dialog');
        dialog.style.cssText = `
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    `;

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

// Form Validation
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

// Chart Helper (for future use with Chart.js)
const ChartUtils = {
    fuelColors: {
        e91: {
            background: 'rgba(255, 107, 157, 0.2)',
            border: '#FF6B9D',
        },
        e95: {
            background: 'rgba(78, 205, 196, 0.2)',
            border: '#4ECDC4',
        },
        b7: {
            background: 'rgba(69, 183, 209, 0.2)',
            border: '#45B7D1',
        },
    },
};
