// Mobile Navigation Handler (Auto-Fixed)
(function () {
    'use strict';

    function initMobileNav() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        // ---- 1. Create UI Elements ----
        if (!document.querySelector('.mobile-menu-toggle')) {
            const btn = document.createElement('button');
            btn.className = 'mobile-menu-toggle';
            btn.innerHTML = '☰';
            btn.onclick = () => {
                sidebar.classList.toggle('active');
                document.querySelector('.sidebar-overlay').classList.toggle('active');
            };
            document.body.appendChild(btn);
        }

        if (!document.querySelector('.sidebar-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.onclick = () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            };
            document.body.appendChild(overlay);
        }

        // ---- 2. Handle Normal Links ----
        sidebar.querySelectorAll('.sidebar-nav a:not(#logoutBtn)').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    sidebar.classList.remove('active');
                    document.querySelector('.sidebar-overlay').classList.remove('active');
                }
            });
        });

        // ---- 3. LOGOUT HANDLER (DIRECT & CLEAR) ----
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            // Replace button to remove all old listeners
            const cleanBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(cleanBtn, logoutBtn);

            cleanBtn.addEventListener('click', function(e) {
                e.preventDefault(); 
                e.stopPropagation();

                if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
                    // Force Clear ALL Storage
                    try {
                        localStorage.clear();
                        sessionStorage.clear();
                    } catch(err) {}

                    // Force Redirect
                    window.location.replace('/login.html?logout=true');
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileNav);
    } else {
        initMobileNav();
    }
})();
