// Cash Management JavaScript
Auth.requireAuth();

// Global variables
let currentDate = new Date().toISOString().split('T')[0];
let fuelPrices = { e91: 0, e95: 0, b7: 0 };
let customers = [];
let personalFuelUsage = [];
let creditPayments = [];

// Initialize
function init() {
    loadUserInfo();
    updateDate();
    setupDatePicker();
    setupEventListeners();
    loadData();
}

// Load user info
function loadUserInfo() {
    const user = Auth.getCurrentUser();
    if (user) {
        document.getElementById('userName').textContent = user.name || user.username;
        document.getElementById('userRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน';
        document.getElementById('userAvatar').textContent = user.name ? user.name[0].toUpperCase() : 'U';
    }
}

// Update date display
function updateDate() {
    document.getElementById('currentDate').textContent = DateUtils.getThaiDate();
}

// Setup date picker
function setupDatePicker() {
    const dateInput = document.getElementById('selectedDate');
    dateInput.value = currentDate;
    
    dateInput.addEventListener('change', (e) => {
        currentDate = e.target.value;
        loadData();
    });
}

// Setup event listeners for real-time calculations
function setupEventListeners() {
    // Cash counter inputs
    const denominations = ['bills_1000', 'bills_500', 'bills_100', 'bills_50', 'bills_20', 
                          'coins_10', 'coins_5', 'coins_2', 'coins_1'];
    
    denominations.forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('input', calculateCashTotal);
    });

    // Bank transfer
    document.getElementById('bankTransfer').addEventListener('input', updateReconciliation);

    // Personal fuel usage
    document.getElementById('fuelE91').addEventListener('input', () => calculateFuelValue('e91'));
    document.getElementById('fuelE95').addEventListener('input', () => calculateFuelValue('e95'));
    document.getElementById('fuelB7').addEventListener('input', () => calculateFuelValue('b7'));
}

// Calculate cash total
function calculateCashTotal() {
    const bills_1000 = parseInt(document.getElementById('bills_1000').value) || 0;
    const bills_500 = parseInt(document.getElementById('bills_500').value) || 0;
    const bills_100 = parseInt(document.getElementById('bills_100').value) || 0;
    const bills_50 = parseInt(document.getElementById('bills_50').value) || 0;
    const bills_20 = parseInt(document.getElementById('bills_20').value) || 0;
    const coins_10 = parseInt(document.getElementById('coins_10').value) || 0;
    const coins_5 = parseInt(document.getElementById('coins_5').value) || 0;
    const coins_2 = parseInt(document.getElementById('coins_2').value) || 0;
    const coins_1 = parseInt(document.getElementById('coins_1').value) || 0;

    // Update individual values (no decimals for cash counting)
    document.getElementById('value_1000').textContent = '฿' + NumberUtils.formatNumber(bills_1000 * 1000);
    document.getElementById('value_500').textContent = '฿' + NumberUtils.formatNumber(bills_500 * 500);
    document.getElementById('value_100').textContent = '฿' + NumberUtils.formatNumber(bills_100 * 100);
    document.getElementById('value_50').textContent = '฿' + NumberUtils.formatNumber(bills_50 * 50);
    document.getElementById('value_20').textContent = '฿' + NumberUtils.formatNumber(bills_20 * 20);
    document.getElementById('value_10').textContent = '฿' + NumberUtils.formatNumber(coins_10 * 10);
    document.getElementById('value_5').textContent = '฿' + NumberUtils.formatNumber(coins_5 * 5);
    document.getElementById('value_2').textContent = '฿' + NumberUtils.formatNumber(coins_2 * 2);
    document.getElementById('value_1').textContent = '฿' + NumberUtils.formatNumber(coins_1 * 1);

    // Calculate total
    const total = bills_1000 * 1000 + bills_500 * 500 + bills_100 * 100 + 
                  bills_50 * 50 + bills_20 * 20 + coins_10 * 10 + 
                  coins_5 * 5 + coins_2 * 2 + coins_1 * 1;

    document.getElementById('totalCountedCash').textContent = '฿' + NumberUtils.formatNumber(total);

    // Net cash sales (after working change)
    const netCashSales = total - 1000;
    document.getElementById('netCashSales').textContent = '฿' + NumberUtils.formatNumber(netCashSales);

    updateReconciliation();
}

// Calculate fuel liters from baht amount
function calculateFuelValue(fuelType) {
    const amount = parseFloat(document.getElementById(`fuel${fuelType.toUpperCase()}`).value) || 0;
    const price = fuelPrices[fuelType];
    const liters = price > 0 ? amount / price : 0;

    // Display calculated liters
    document.getElementById(`liters${fuelType.toUpperCase()}`).textContent = 
        liters > 0 ? `= ${liters.toFixed(3)} ลิตร` : '';

    // Update total fuel value in baht
    const totalFuel = 
        (parseFloat(document.getElementById('fuelE91').value) || 0) +
        (parseFloat(document.getElementById('fuelE95').value) || 0) +
        (parseFloat(document.getElementById('fuelB7').value) || 0);

    document.getElementById('totalFuelValue').textContent = '฿' + NumberUtils.formatCurrency(totalFuel);

    updateReconciliation();
}

// Update reconciliation summary
async function updateReconciliation() {
    try {
        // Get summary data
        const result = await API.get(`/api/cash/summary/${currentDate}`);
        const { metrics, totalCreditSales, totalFuelValue, cashRecord } = result;

        // Calculate values
        const totalCountedCash = parseFloat(document.getElementById('totalCountedCash').textContent.replace(/[฿,]/g, '')) || 0;
        const netCashSales = totalCountedCash - 1000;
        const bankTransfer = parseFloat(document.getElementById('bankTransfer').value) || 0;
        
        // Sum credit payments from the list (Only Confirmed ones count towards Revenue?)
        // User said: "Confirm ... to add the total"
        const creditPaymentsTotal = creditPayments
            .filter(p => p.is_confirmed)
            .reduce((sum, p) => sum + parseFloat(p.amount), 0);
        
        const totalRevenue = netCashSales + bankTransfer + creditPaymentsTotal;

        // Expected sales calculation
        const nozzleSales = metrics?.total_sales || 0;
        const personalFuelTotal = totalFuelValue || 0;
        const expectedSales = nozzleSales - totalCreditSales - personalFuelTotal;

        // Difference
        const difference = totalRevenue - expectedSales;

        // Update UI
        document.getElementById('reconTotalRevenue').textContent = '฿' + NumberUtils.formatCurrency(totalRevenue);
        document.getElementById('reconCashSales').textContent = '฿' + NumberUtils.formatCurrency(netCashSales);
        document.getElementById('reconBankTransfer').textContent = '฿' + NumberUtils.formatCurrency(bankTransfer);
        document.getElementById('reconCreditPayments').textContent = '฿' + NumberUtils.formatCurrency(creditPaymentsTotal);

        document.getElementById('reconExpectedSales').textContent = '฿' + NumberUtils.formatCurrency(expectedSales);
        document.getElementById('reconNozzleSales').textContent = '฿' + NumberUtils.formatCurrency(nozzleSales);
        document.getElementById('reconCreditSales').textContent = '฿' + NumberUtils.formatCurrency(totalCreditSales);
        document.getElementById('reconPersonalFuel').textContent = '฿' + NumberUtils.formatCurrency(personalFuelTotal);

        document.getElementById('reconDifference').textContent = '฿' + NumberUtils.formatCurrency(Math.abs(difference));
        
        const diffLabel = document.getElementById('reconDifferenceLabel');
        if (difference > 0) {
            diffLabel.textContent = '✅ เกิน';
            diffLabel.style.color = '#10B981';
        } else if (difference < 0) {
            diffLabel.textContent = '⚠️ ขาด';
            diffLabel.style.color = '#EF4444';
        } else {
            diffLabel.textContent = '✓ ตรงพอดี';
            diffLabel.style.color = '#10B981';
        }

    } catch (error) {
        console.error('Reconciliation error:', error);
    }
}



// Load data for selected date
async function loadData() {
    try {
        Loading.show();

        // Load fuel prices from daily_records
        const pricesResult = await API.get(`/api/daily/${currentDate}`);
        if (pricesResult.data) {
            fuelPrices.e91 = pricesResult.data.e91_sell_price || 0;
            fuelPrices.e95 = pricesResult.data.e95_sell_price || 0;
            fuelPrices.b7 = pricesResult.data.b7_sell_price || 0;

            document.getElementById('priceE91').textContent = `@ ฿${NumberUtils.formatCurrency(fuelPrices.e91)}`;
            document.getElementById('priceE95').textContent = `@ ฿${NumberUtils.formatCurrency(fuelPrices.e95)}`;
            document.getElementById('priceB7').textContent = `@ ฿${NumberUtils.formatCurrency(fuelPrices.b7)}`;
        }

        // Load cash record
        const cashResult = await API.get(`/api/cash/${currentDate}`);
        const { cashRecord, fuelUsage, creditPayments: payments } = cashResult;

        // Populate cash record if exists
        if (cashRecord) {
            document.getElementById('bills_1000').value = cashRecord.bills_1000 || 0;
            document.getElementById('bills_500').value = cashRecord.bills_500 || 0;
            document.getElementById('bills_100').value = cashRecord.bills_100 || 0;
            document.getElementById('bills_50').value = cashRecord.bills_50 || 0;
            document.getElementById('bills_20').value = cashRecord.bills_20 || 0;
            document.getElementById('coins_10').value = cashRecord.coins_10 || 0;
            document.getElementById('coins_5').value = cashRecord.coins_5 || 0;
            document.getElementById('coins_2').value = cashRecord.coins_2 || 0;
            document.getElementById('coins_1').value = cashRecord.coins_1 || 0;
            document.getElementById('bankTransfer').value = cashRecord.bank_transfer_amount || 0;
            
            calculateCashTotal();
        } else {
            // Reset form
            resetForm();
        }

        // Load fuel usage
        personalFuelUsage = fuelUsage || [];
        renderPersonalFuelList();

        // Load credit payments
        creditPayments = payments || [];
        renderCreditPaymentsList();

        updateReconciliation();
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Load data error:', error);
        Toast.error('ไม่สามารถโหลดข้อมูลได้');
    }
}

// Reset form
function resetForm() {
    document.getElementById('bills_1000').value = 0;
    document.getElementById('bills_500').value = 0;
    document.getElementById('bills_100').value = 0;
    document.getElementById('bills_50').value = 0;
    document.getElementById('bills_20').value = 0;
    document.getElementById('coins_10').value = 0;
    document.getElementById('coins_5').value = 0;
    document.getElementById('coins_2').value = 0;
    document.getElementById('coins_1').value = 0;
    document.getElementById('bankTransfer').value = 0;
    document.getElementById('fuelE91').value = '';
    document.getElementById('fuelE95').value = '';
    document.getElementById('fuelB7').value = '';
    
    calculateCashTotal();
}

// Save cash record
async function saveCashRecord() {
    try {
        Loading.show();

        const cashData = {
            date: currentDate,
            bills_1000: parseInt(document.getElementById('bills_1000').value) || 0,
            bills_500: parseInt(document.getElementById('bills_500').value) || 0,
            bills_100: parseInt(document.getElementById('bills_100').value) || 0,
            bills_50: parseInt(document.getElementById('bills_50').value) || 0,
            bills_20: parseInt(document.getElementById('bills_20').value) || 0,
            coins_10: parseInt(document.getElementById('coins_10').value) || 0,
            coins_5: parseInt(document.getElementById('coins_5').value) || 0,
            coins_2: parseInt(document.getElementById('coins_2').value) || 0,
            coins_1: parseInt(document.getElementById('coins_1').value) || 0,
            bank_transfer_amount: parseFloat(document.getElementById('bankTransfer').value) || 0,
            note: ''
        };

        await API.post('/api/cash', cashData);
        
        Toast.success('บันทึกข้อมูลสำเร็จ');
        Loading.hide();
        loadData(); // Reload to get updated reconciliation

    } catch (error) {
        Loading.hide();
        console.error('Save error:', error);
        Toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// Save personal fuel usage
async function savePersonalFuel() {
    try {
        const e91Amount = parseFloat(document.getElementById('fuelE91').value) || 0;
        const e95Amount = parseFloat(document.getElementById('fuelE95').value) || 0;
        const b7Amount = parseFloat(document.getElementById('fuelB7').value) || 0;

        const fuelEntries = [];
        
        // Convert baht to liters for each fuel type
        if (e91Amount > 0 && fuelPrices.e91 > 0) {
            fuelEntries.push({ 
                fuel_type: 'e91', 
                liters: (e91Amount / fuelPrices.e91).toFixed(3)
            });
        }
        if (e95Amount > 0 && fuelPrices.e95 > 0) {
            fuelEntries.push({ 
                fuel_type: 'e95', 
                liters: (e95Amount / fuelPrices.e95).toFixed(3)
            });
        }
        if (b7Amount > 0 && fuelPrices.b7 > 0) {
            fuelEntries.push({ 
                fuel_type: 'b7', 
                liters: (b7Amount / fuelPrices.b7).toFixed(3)
            });
        }

        if (fuelEntries.length === 0) {
            Toast.warning('กรุณากรอกจำนวนเงิน');
            return;
        }

        Loading.show();

        for (const entry of fuelEntries) {
            await API.post('/api/personal-fuel', {
                date: currentDate,
                ...entry,
                note: ''
            });
        }

        Toast.success('บันทึกน้ำมันใช้เองสำเร็จ');
        
        // Clear inputs
        document.getElementById('fuelE91').value = '';
        document.getElementById('fuelE95').value = '';
        document.getElementById('fuelB7').value = '';
        document.getElementById('litersE91').textContent = '';
        document.getElementById('litersE95').textContent = '';
        document.getElementById('litersB7').textContent = '';
        
        calculateFuelValue('e91');
        calculateFuelValue('e95');
        calculateFuelValue('b7');

        loadData(); // Reload
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Save fuel error:', error);
        Toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// Render personal fuel list
function renderPersonalFuelList() {
    const container = document.getElementById('personalFuelList');
    
    if (personalFuelUsage.length === 0) {
        container.innerHTML = '<p style="color: #999;">ยังไม่มีข้อมูลน้ำมันใช้เองในวันนี้</p>';
        return;
    }

    container.innerHTML = personalFuelUsage.map(fuel => {
        const fuelName = fuel.fuel_type === 'e91' ? 'E91' : 
                        fuel.fuel_type === 'e95' ? 'E95' : 'B7';
        return `
            <div class="list-item">
                <div>
                    <strong>${fuelName}</strong>: ${fuel.liters} ลิตร × ฿${NumberUtils.formatCurrency(fuel.price_per_liter)} 
                    = <span style="font-weight: bold; color: #00A8E8;">฿${NumberUtils.formatCurrency(fuel.total_value)}</span>
                </div>
                <button class="btn-delete" onclick="deletePersonalFuel(${fuel.id})">ลบ</button>
            </div>
        `;
    }).join('');
}

// Delete personal fuel
async function deletePersonalFuel(id) {
    if (!confirm('ต้องการลบรายการนี้?')) return;

    try {
        Loading.show();
        await API.delete(`/api/personal-fuel/${id}`);
        Toast.success('ลบรายการสำเร็จ');
        loadData();
        Loading.hide();
    } catch (error) {
        Loading.hide();
        console.error('Delete error:', error);
        Toast.error('เกิดข้อผิดพลาดในการลบ');
    }
}

// Add credit payment
async function addCreditPayment() {
    const customerId = document.getElementById('creditCustomerSelect').value;
    const amount = parseFloat(document.getElementById('creditPaymentAmount').value);

    if (!customerId) {
        Toast.warning('กรุณาเลือกลูกค้า');
        return;
    }

    if (!amount || amount <= 0) {
        Toast.warning('กรุณากรอกจำนวนเงิน');
        return;
    }

    try {
        Loading.show();

        await API.post('/api/credit-payment/cash', {
            date: currentDate,
            customer_id: customerId,
            amount: amount,
            note: ''
        });

        Toast.success('บันทึกการชำระเงินสำเร็จ');
        
        // Clear inputs
        document.getElementById('creditCustomerSelect').value = '';
        document.getElementById('creditPaymentAmount').value = '';

        loadData(); // Reload
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Payment error:', error);
        Toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// Render credit payments list
function renderCreditPaymentsList() {
    const container = document.getElementById('creditPaymentsList');
    
    if (creditPayments.length === 0) {
        container.innerHTML = '<p style="color: #999;">ยังไม่มีการชำระเงินเชื่อในวันนี้</p>';
        return;
    }

    container.innerHTML = creditPayments.map(payment => {
        const methodIcon = payment.payment_method === 'transfer' ? '📲' : '💵';
        const methodText = payment.payment_method === 'transfer' ? 'โอน' : 'สด';
        
        // Status Badge Logic
        let statusBadge = '';
        if (payment.is_confirmed) {
            statusBadge = '<span class="badge bg-success" style="font-size: 0.9rem; padding: 0.5rem 1rem;">✅ ยืนยันแล้ว</span>';
        } else {
            statusBadge = `<button class="btn btn-success" style="padding: 0.375rem 0.75rem;" onclick="confirmCreditPayment(${payment.id})">ยืนยัน</button>`;
        }

        // Note Styling
        const noteDisplay = payment.note 
            ? `<div style="font-weight: bold; font-size: 1.1rem; color: #000; margin-top: 0.25rem;">${payment.note}</div>` 
            : '';
        
        return `
        <div class="list-item" style="${!payment.is_confirmed ? 'border-left: 4px solid #FFA726;' : 'border-left: 4px solid #10B981;'} display: flex; align-items: center; justify-content: space-between; padding: 1rem;">
            <div style="flex: 1;">
                <div style="font-size: 1.1rem; font-weight: bold; color: #333;">
                    ${payment.customer.name}
                </div>
                ${noteDisplay}
                <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem; font-size: 1rem; color: #555;">
                    <span style="font-weight: bold; color: #00A8E8; font-size: 1.2rem;">฿${NumberUtils.formatCurrency(payment.amount)}</span>
                    <span style="background: #f0f0f0; padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.9rem;">${methodIcon} ${methodText}</span>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                ${statusBadge}
                ${!payment.is_confirmed ? `<button class="btn btn-danger" style="padding: 0.375rem 0.75rem;" onclick="deleteCreditPayment(${payment.id})">ลบ</button>` : ''}
            </div>
        </div>
        `;
    }).join('');
}

// Confirm credit payment
async function confirmCreditPayment(id) {
    try {
        Loading.show();
        const result = await API.post(`/api/credit-payment/${id}/confirm`);
        Loading.hide();
        
        Swal.fire({
            icon: 'success',
            title: 'ยืนยันสำเร็จ',
            text: 'ยอดเงินถูกบันทึกเข้าบัญชีเรียบร้อยแล้ว',
            timer: 1500,
            showConfirmButton: false
        });
        
        loadData();
    } catch (error) {
        Loading.hide();
        console.error('Confirm error:', error);
        Toast.error(error.message || 'ไม่สามารถยืนยันรายการได้');
    }
}

// Delete credit payment
async function deleteCreditPayment(id) {
    if (!confirm('ต้องการลบรายการนี้?')) return;

    try {
        Loading.show();
        await API.delete(`/api/credit-payment/${id}`);
        Toast.success('ลบรายการสำเร็จ');
        loadData();
        Loading.hide();
    } catch (error) {
        Loading.hide();
        console.error('Delete error:', error);
        Toast.error('เกิดข้อผิดพลาดในการลบ');
    }
}

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    Auth.logout();
});

// Initialize on page load
init();
