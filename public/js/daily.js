// Daily Management JavaScript
Auth.requireAuth();

// Load user info
function loadUserInfo() {
    const user = Auth.getCurrentUser();
    if (user) {
        document.getElementById('userName').textContent = user.name || user.username;
        document.getElementById('userRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน';
        document.getElementById('userAvatar').textContent = user.name ? user.name[0].toUpperCase() : 'U';
    }
}

// Initialize Date Picker
const datePicker = document.getElementById('datePicker');

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Set default to today
function initializeDate() {
    const today = new Date();
    datePicker.value = formatDate(today);

    // Listen for changes
    datePicker.addEventListener('change', () => {
        loadDataForDate(datePicker.value);
    });
}

// Load data for specific date
async function loadDataForDate(dateStr) {
    Loading.show();
    try {
        const currentDate = new Date(dateStr);
        // Calculate "Yesterday" relative to selected date
        const yesterday = new Date(currentDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = formatDate(yesterday);

        // Fetch Yesterday and Today data in parallel
        const [yesterdayRes, currentRes] = await Promise.all([
            API.get(`/api/daily/${yesterdayStr}`),
            API.get(`/api/daily/${dateStr}`)
        ]);

        // 1. Process Yesterday's Data (Relative)
        if (yesterdayRes.data) {
            const yData = yesterdayRes.data;

            // Set prices if not already set (inheritance logic)
            // Only set if field is empty to avoid overwriting user input on re-load
            if (!document.getElementById('e91CostPrice').value) {
                document.getElementById('e91CostPrice').value = yData.e91_cost_price ? Number(yData.e91_cost_price).toFixed(2) : '';
                document.getElementById('e91SellPrice').value = yData.e91_sell_price ? Number(yData.e91_sell_price).toFixed(2) : '';
                document.getElementById('e95CostPrice').value = yData.e95_cost_price ? Number(yData.e95_cost_price).toFixed(2) : '';
                document.getElementById('e95SellPrice').value = yData.e95_sell_price ? Number(yData.e95_sell_price).toFixed(2) : '';
                document.getElementById('b7CostPrice').value = yData.b7_cost_price ? Number(yData.b7_cost_price).toFixed(2) : '';
                document.getElementById('b7SellPrice').value = yData.b7_sell_price ? Number(yData.b7_sell_price).toFixed(2) : '';
            }

            // Set Yesterday's Meter Readings text
            for (let i = 1; i <= 8; i++) {
                const yVal = yData[`nozzle_${i}_today`];
                document.getElementById(`nozzle${i}Yesterday`).textContent = NumberUtils.formatLiters(yVal);
                document.getElementById(`nozzle${i}YesterdayInput`).value = yVal || 0;
            }
        } else {
            // Reset if no yesterday data
            for (let i = 1; i <= 8; i++) {
                document.getElementById(`nozzle${i}Yesterday`).textContent = '0.000';
                document.getElementById(`nozzle${i}YesterdayInput`).value = 0;
            }
        }

        // 2. Process Selected Date's Data (if exists)
        if (currentRes.data) {
            const cData = currentRes.data;

            // Fill prices (overwrite inheritance if exists)
            document.getElementById('e91CostPrice').value = cData.e91_cost_price ? Number(cData.e91_cost_price).toFixed(2) : '';
            document.getElementById('e91SellPrice').value = cData.e91_sell_price ? Number(cData.e91_sell_price).toFixed(2) : '';
            document.getElementById('e95CostPrice').value = cData.e95_cost_price ? Number(cData.e95_cost_price).toFixed(2) : '';
            document.getElementById('e95SellPrice').value = cData.e95_sell_price ? Number(cData.e95_sell_price).toFixed(2) : '';
            document.getElementById('b7CostPrice').value = cData.b7_cost_price ? Number(cData.b7_cost_price).toFixed(2) : '';
            document.getElementById('b7SellPrice').value = cData.b7_sell_price ? Number(cData.b7_sell_price).toFixed(2) : '';

            // Fill meter readings
            for (let i = 1; i <= 8; i++) {
                const val = cData[`nozzle_${i}_today`];
                if (val) document.getElementById(`nozzle${i}Today`).value = val;
                else document.getElementById(`nozzle${i}Today`).value = '';
            }

            if (currentRes.metrics) {
                displayMetrics(currentRes.metrics);
            }
        } else {
            // New entry for this date - DO NOT clear prices (keep inherited)
            // Clear Today's input
            for (let i = 1; i <= 8; i++) {
                document.getElementById(`nozzle${i}Today`).value = '';
            }
            document.getElementById('summarySection').style.display = 'none';
        }

    } catch (error) {
        console.error('Error loading data:', error);
        Toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
        Loading.hide();
    }
}

// Load Inventory Data
async function loadInventoryData() {
    try {
        const res = await API.get('/api/inventory/fuel');
        if (res && res.inventory) {
            renderInventoryWidget(res.inventory);
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        document.getElementById('inventoryContainer').innerHTML = '<div style="color: #ef4444; padding: 1rem;">❌ ไม่สามารถโหลดข้อมูลคลังน้ำมันได้</div>';
    }
}

let currentInventoryData = [];

function renderInventoryWidget(inventory) {
    currentInventoryData = inventory;
    const container = document.getElementById('inventoryContainer');
    if (!inventory.length) {
        container.innerHTML = '<div style="color: #64748b; padding: 1rem;">ยังไม่มีข้อมูลคลังน้ำมัน</div>';
        return;
    }

    // Sort order: B7, E91, E95
    const sorted = [...inventory].sort((a, b) => {
        const order = { 'b7': 1, 'e91': 2, 'e95': 3 };
        return (order[a.fuel_type] || 99) - (order[b.fuel_type] || 99);
    });
    
    currentInventoryData = sorted;

    let html = '';
    sorted.forEach(item => {
        const remaining = Number(item.current_liters) || 0;
        const threshold = Number(item.alert_threshold) || 1000;
        const isLow = remaining < threshold;

        html += `
            <div class="inventory-card ${item.fuel_type} ${isLow ? 'danger' : ''}">
                <div class="inventory-status-chip ${isLow ? 'low' : 'ok'}">
                    ${isLow ? '⚠️ น้ำมันใกล้หมด' : '✅ ปกติ'}
                </div>
                <div class="inventory-title">${item.display_name}</div>
                <div class="inventory-value">${NumberUtils.formatLiters(remaining)} L</div>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.5rem;">
                    จุดสั่งซื้อ: ${NumberUtils.formatLiters(threshold)} ลิตร
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function openInventorySettings() {
    const body = document.getElementById('inventorySettingsBody');
    if (!currentInventoryData.length) {
        body.innerHTML = '<p style="text-align: center; color: #64748b;">ไม่มีข้อมูลคลังน้ำมัน</p>';
        document.getElementById('inventorySettingsModal').classList.add('active');
        return;
    }

    let html = '';
    currentInventoryData.forEach(item => {
        html += `
            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;">
                <h4 style="margin-bottom: 0.5rem; color: #1e293b;">${item.display_name}</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <label class="form-label" style="font-size: 0.8rem;">ปริมาณน้ำมันเริ่มต้น (ลิตร)</label>
                        <input type="number" class="form-control" id="inv_initial_${item.fuel_type}" step="0.001" value="${item.initial_liters || 0}">
                    </div>
                    <div>
                        <label class="form-label" style="font-size: 0.8rem;">จุดแจ้งเตือน (ลิตร)</label>
                        <input type="number" class="form-control" id="inv_threshold_${item.fuel_type}" step="0.001" value="${item.alert_threshold || 1000}">
                    </div>
                </div>
            </div>
        `;
    });

    body.innerHTML = html;
    document.getElementById('inventorySettingsModal').classList.add('active');
}

async function saveInventorySettings() {
    try {
        Loading.show();
        // Update all types concurrently
        const promises = currentInventoryData.map(item => {
            const initial = parseFloat(document.getElementById(`inv_initial_${item.fuel_type}`).value) || 0;
            const threshold = parseFloat(document.getElementById(`inv_threshold_${item.fuel_type}`).value) || 0;
            return API.put(`/api/inventory/fuel/${item.fuel_type}`, {
                initial_liters: initial,
                alert_threshold: threshold
            });
        });

        await Promise.all(promises);

        Toast.success('บันทึกการตั้งค่าคลังน้ำมันสำเร็จ');
        document.getElementById('inventorySettingsModal').classList.remove('active');

        // Reload inventory
        await loadInventoryData();

    } catch (error) {
        console.error('Save inventory settings error:', error);
        Toast.error('เกิดข้อผิดพลาดในการบันทึกการตั้งค่าคลังน้ำมัน');
    } finally {
        Loading.hide();
    }
}



// Calculate metrics
function calculateMetrics() {
    const formData = {
        e91CostPrice: parseFloat(document.getElementById('e91CostPrice').value) || 0,
        e91SellPrice: parseFloat(document.getElementById('e91SellPrice').value) || 0,
        e95CostPrice: parseFloat(document.getElementById('e95CostPrice').value) || 0,
        e95SellPrice: parseFloat(document.getElementById('e95SellPrice').value) || 0,
        b7CostPrice: parseFloat(document.getElementById('b7CostPrice').value) || 0,
        b7SellPrice: parseFloat(document.getElementById('b7SellPrice').value) || 0,
    };

    const nozzleLiters = [];
    for (let i = 1; i <= 8; i++) {
        const today = parseFloat(document.getElementById(`nozzle${i}Today`).value) || 0;
        const yesterday = parseFloat(document.getElementById(`nozzle${i}YesterdayInput`).value) || 0;
        nozzleLiters.push(today - yesterday);
    }

    const e91Liters = nozzleLiters[0] + nozzleLiters[2]; // Nozzles 1, 3
    const b7Liters = nozzleLiters[1] + nozzleLiters[3] + nozzleLiters[5] + nozzleLiters[7]; // Nozzles 2, 4, 6, 8
    const e95Liters = nozzleLiters[4] + nozzleLiters[6]; // Nozzles 5, 7

    const e91Sales = e91Liters * formData.e91SellPrice;
    const e91Profit = e91Liters * (formData.e91SellPrice - formData.e91CostPrice);

    const e95Sales = e95Liters * formData.e95SellPrice;
    const e95Profit = e95Liters * (formData.e95SellPrice - formData.e95CostPrice);

    const b7Sales = b7Liters * formData.b7SellPrice;
    const b7Profit = b7Liters * (formData.b7SellPrice - formData.b7CostPrice);

    return {
        totalSales: e91Sales + e95Sales + b7Sales,
        totalProfit: e91Profit + e95Profit + b7Profit,
        totalLiters: e91Liters + e95Liters + b7Liters,
        e91: { sales: e91Sales, profit: e91Profit, liters: e91Liters },
        e95: { sales: e95Sales, profit: e95Profit, liters: e95Liters },
        b7: { sales: b7Sales, profit: b7Profit, liters: b7Liters },
        nozzles: nozzleLiters
    };
}

// Display metrics
function displayMetrics(metrics) {
    const summarySection = document.getElementById('summarySection');
    summarySection.style.display = 'block';

    document.getElementById('summaryTotalSales').textContent = '฿' + NumberUtils.formatNumber(metrics.totalSales, 0);
    document.getElementById('summaryTotalProfit').textContent = '฿' + NumberUtils.formatNumber(metrics.totalProfit, 0);
    document.getElementById('summaryTotalLiters').textContent = NumberUtils.formatLiters(metrics.totalLiters) + ' L';

    // Fuel breakdown (Reordered: B7 -> E91 -> E95)
    const fuelBreakdown = document.getElementById('fuelBreakdown');
    fuelBreakdown.innerHTML = `
    <div class="fuel-breakdown-card">
      <h5 style="color: #45B7D1; margin-bottom: 0.75rem;">ดีเซล B7</h5>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span>ยอดขาย:</span>
        <strong>฿${NumberUtils.formatNumber(metrics.b7.sales, 0)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span>กำไร:</span>
        <strong>฿${NumberUtils.formatNumber(metrics.b7.profit, 0)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>ลิตร:</span>
        <strong>${NumberUtils.formatLiters(metrics.b7.liters)} L</strong>
      </div>
    </div>

    <div class="fuel-breakdown-card">
      <h5 style="color: #FF6B9D; margin-bottom: 0.75rem;">เบนซิล E91</h5>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span>ยอดขาย:</span>
        <strong>฿${NumberUtils.formatNumber(metrics.e91.sales, 0)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span>กำไร:</span>
        <strong>฿${NumberUtils.formatNumber(metrics.e91.profit, 0)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>ลิตร:</span>
        <strong>${NumberUtils.formatLiters(metrics.e91.liters)} L</strong>
      </div>
    </div>
    
    <div class="fuel-breakdown-card">
      <h5 style="color: #4ECDC4; margin-bottom: 0.75rem;">เบนซิล E95</h5>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span>ยอดขาย:</span>
        <strong>฿${NumberUtils.formatNumber(metrics.e95.sales, 0)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span>กำไร:</span>
        <strong>฿${NumberUtils.formatNumber(metrics.e95.profit, 0)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>ลิตร:</span>
        <strong>${NumberUtils.formatLiters(metrics.e95.liters)} L</strong>
      </div>
    </div>
  `;

    // Nozzle breakdown (Separated by Pump)
    const nozzleLabels = [
        'ตู้1-หัว1 (E91)', 'ตู้1-หัว2 (B7)', 'ตู้1-หัว3 (E91)', 'ตู้1-หัว4 (B7)',
        'ตู้2-หัว1 (E95)', 'ตู้2-หัว2 (B7)', 'ตู้2-หัว3 (E95)', 'ตู้2-หัว4 (B7)'
    ];

    const pump1Nozzles = metrics.nozzles.slice(0, 4);
    const pump2Nozzles = metrics.nozzles.slice(4, 8);

    const nozzleBreakdown = document.getElementById('nozzleBreakdown');
    nozzleBreakdown.innerHTML = '';

    // Create container style for full width separation
    const pumpContainerStyle = 'grid-column: 1 / -1; margin-bottom: 1rem;';

    // Pump 1 Section
    const pump1Html = `
        <div style="${pumpContainerStyle}">
            <h5 style="margin-bottom: 0.5rem; color: var(--text-secondary);">ตู้จ่ายที่ 1</h5>
            <div class="fuel-breakdown" style="margin-top: 0;">
                ${pump1Nozzles.map((liters, i) => `
                <div class="fuel-breakdown-card">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${nozzleLabels[i]}</span>
                        <strong style="font-size: 1.25rem;">${NumberUtils.formatLiters(liters)} L</strong>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
    `;

    // Pump 2 Section
    const pump2Html = `
        <div style="${pumpContainerStyle}">
            <h5 style="margin-bottom: 0.5rem; color: var(--text-secondary); margin-top: 1rem;">ตู้จ่ายที่ 2</h5>
            <div class="fuel-breakdown" style="margin-top: 0;">
                ${pump2Nozzles.map((liters, i) => `
                <div class="fuel-breakdown-card">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${nozzleLabels[i + 4]}</span>
                        <strong style="font-size: 1.25rem;">${NumberUtils.formatLiters(liters)} L</strong>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
    `;

    nozzleBreakdown.innerHTML = pump1Html + pump2Html;

    // Smooth scroll to summary
    setTimeout(() => {
        summarySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

// Submit form
document.getElementById('meterForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate meter readings
    if (checkMeterReadings(true)) { // Pass true to show toast on submit
        Modal.confirm(
            'ตรวจพบค่าผิดปกติ',
            'ค่ามิเตอร์บางหัวจ่ายมีค่าน้อยกว่าหรือเท่ากับเมื่อวาน ต้องการดำเนินการต่อหรือไม่?',
            submitData
        );
    } else {
        submitData();
    }
});

async function submitData() {
    const formData = {
        date: document.getElementById('datePicker').value,
        e91CostPrice: parseFloat(document.getElementById('e91CostPrice').value),
        e91SellPrice: parseFloat(document.getElementById('e91SellPrice').value),
        e95CostPrice: parseFloat(document.getElementById('e95CostPrice').value),
        e95SellPrice: parseFloat(document.getElementById('e95SellPrice').value),
        b7CostPrice: parseFloat(document.getElementById('b7CostPrice').value),
        b7SellPrice: parseFloat(document.getElementById('b7SellPrice').value),
    };

    for (let i = 1; i <= 8; i++) {
        formData[`nozzle${i}Today`] = parseFloat(document.getElementById(`nozzle${i}Today`).value);
        formData[`nozzle${i}Yesterday`] = parseFloat(document.getElementById(`nozzle${i}YesterdayInput`).value);
    }

    Loading.show();

    try {
        const data = await API.post('/api/daily/submit', formData);

        Loading.hide();
        Toast.success('บันทึกข้อมูลสำเร็จ');

        // Display calculated metrics
        displayMetrics(data.metrics);

        // Reload inventory since metrics affect current stock
        loadInventoryData();
    } catch (error) {
        Loading.hide();
        Toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        console.error('Submit error:', error);
    }
}

// Check meter readings (returns true if error found)
function checkMeterReadings(showToast = false) {
    let hasError = false;

    for (let i = 1; i <= 8; i++) {
        const todayInput = document.getElementById(`nozzle${i}Today`);
        const yesterdayValue = parseFloat(document.getElementById(`nozzle${i}YesterdayInput`).value) || 0;

        // If empty, remove warning and skip
        if (!todayInput.value) {
            todayInput.classList.remove('warning');
            continue;
        }

        const todayValue = parseFloat(todayInput.value) || 0;

        // Check if today's value is less than or equal to yesterday's
        if (todayValue > 0 && todayValue <= yesterdayValue) {
            const card = todayInput.closest('.nozzle-card');
            if (card) card.classList.add('warning');
            hasError = true;
        } else {
            const card = todayInput.closest('.nozzle-card');
            if (card) card.classList.remove('warning');
        }
    }

    if (hasError && showToast) {
        Toast.warning('ตรวจพบค่ามิเตอร์วันนี้น้อยกว่าหรือเท่ากับเมื่อวาน โปรดตรวจสอบ');
    }

    return hasError;
}

// Add real-time validation (on blur only)
// Add real-time validation (on blur only) & Formatting
function setupInputFormatters() {
    // 1. Meter Readings (3 decimals)
    for (let i = 1; i <= 8; i++) {
        const input = document.getElementById(`nozzle${i}Today`);

        // Input restriction: max 3 decimals
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.includes('.')) {
                const parts = val.split('.');
                if (parts[1].length > 3) {
                    e.target.value = parts[0] + '.' + parts[1].slice(0, 3);
                }
            }
        });

        // Blur formatting: force 3 decimals
        input.addEventListener('blur', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                e.target.value = val.toFixed(3);
            }
            checkMeterReadings(false);
        });
    }

    // 2. Fuel Prices (2 decimals)
    const priceInputs = [
        'e91CostPrice', 'e91SellPrice',
        'e95CostPrice', 'e95SellPrice',
        'b7CostPrice', 'b7SellPrice'
    ];

    priceInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('blur', (e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                    e.target.value = val.toFixed(2);
                }
            });
        }
    });
}

setupInputFormatters();

// Logout
document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    Modal.confirm(
        'ออกจากระบบ',
        'คุณต้องการออกจากระบบหรือไม่?',
        async () => {
            await Auth.logout();
        }
    );
});

// Initialize
loadUserInfo();
initializeDate();
// Initial load
loadDataForDate(datePicker.value);
loadInventoryData();
