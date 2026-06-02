// ===========================================
// BC PETROLEUM V2 - CASH MANAGEMENT (V1 LOGIC PORTED)
// Modern Glassmorphism Design System
// ===========================================

// Initialize
let currentDate = new Date().toISOString().split('T')[0];
let fuelPrices = { e91: 0, e95: 0, b7: 0 };
let creditPayments = [];
let personalFuelUsage = [];

document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    setupDatePicker();
    setupEventListeners();
    updateDateDisplay();
    loadData();
}

function updateDateDisplay() {
    document.getElementById('currentDate').textContent = DateUtils.getThaiDate(currentDate);
}

function setupDatePicker() {
    const dateInput = document.getElementById('selectedDate');
    if (dateInput) {
        dateInput.value = currentDate;
        dateInput.addEventListener('change', (e) => {
            currentDate = e.target.value;
            updateDateDisplay();
            loadData();
        });
    }
}

// Setup Event Listeners for Calculation
function setupEventListeners() {
    // 1. Cash Counter Inputs
    const denominations = [
        'bills_1000', 'bills_500', 'bills_100', 'bills_50', 'bills_20',
        'coins_10', 'coins_5', 'coins_2', 'coins_1'
    ];

    denominations.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', calculateCashTotal);
        }
    });

    // 2. Bank Transfer
    // 2. Bank Transfer
    const bankInput = document.getElementById('bankTransfer');
    if (bankInput) {
        bankInput.addEventListener('input', (e) => {
            // Remove non-numeric chars (allow only digits, no dots)
            let val = e.target.value.replace(/[^0-9]/g, '');

            // Handle multiple dots (Removed)
            // val = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');

            // Add commas
            if (val) {
                // const parts = val.split('.');
                // parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                // e.target.value = parts.join('.');
                e.target.value = val.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            } else {
                e.target.value = '';
            }

            updateReconciliation();
        });
    }

    // 3. Fuel Calculator
    const fuels = ['e91', 'e95', 'b7'];
    fuels.forEach(type => {
        const input = document.getElementById(`fuel${type.toUpperCase()}`);
        if (input) {
            // Remove decimals on input
            input.addEventListener('input', (e) => {
                // If user types decimal, remove it or floor it?
                // Standard number input allows 'e', '.', etc. 
                // We want strict integer.
                // Replace non-digits
                if (e.target.value.includes('.')) {
                    e.target.value = e.target.value.split('.')[0];
                }
                calculateFuelValue(type);
            });
        }
    });
}

// ==========================================
// DATA LOADING
// ==========================================
async function loadData(skipLoading = false, preserveInputs = false) {
    try {
        if (!skipLoading) {
            Loading.show();
        }

        // Fetch all data in single optimized call
        const result = await API.get(`/api/cash/${currentDate}`);

        const {
            cashRecord: fullCashRecord,
            fuelUsage: fullFuelUsage,
            creditPayments: fullCreditPayments,
            metrics,
            prices,
            totalCreditSales: creditSalesTotal
        } = result;

        // 1. Process Fuel Prices
        if (prices) {
            fuelPrices.e91 = prices.e91_sell_price || 0;
            fuelPrices.e95 = prices.e95_sell_price || 0;
            fuelPrices.b7 = prices.b7_sell_price || 0;

            updatePriceLabel('e91', fuelPrices.e91);
            updatePriceLabel('e95', fuelPrices.e95);
            updatePriceLabel('b7', fuelPrices.b7);
        }

        // 2. Process Summary & Metrics
        window.currentMetrics = metrics || {};
        window.totalCreditSales = creditSalesTotal || 0;

        // 3. Process Full Details are already destructured above

        // Populate Forms
        if (!preserveInputs) {
            if (fullCashRecord) {
                populateCashForm(fullCashRecord);
            } else {
                resetCashForm();
            }
        }

        // Populate Personal Fuel List
        personalFuelUsage = fullFuelUsage || [];
        renderPersonalFuelList();

        // Populate Credit Payments List
        creditPayments = fullCreditPayments || [];
        renderCreditPaymentsList();

        // Final Recalculation
        calculateCashTotal();
        await updateReconciliation();

        if (!skipLoading) {
            Loading.hide();
        }

    } catch (error) {
        if (!skipLoading) {
            Loading.hide();
        }
        console.error('Load data error:', error);
        Toast.error('ไม่สามารถโหลดข้อมูลได้');
    }
}

// Update Price Label
function updatePriceLabel(type, price) {
    const label = document.getElementById(`price${type.toUpperCase()}`);
    if (label) label.textContent = `@ ฿${NumberUtils.formatNumber(price, 0)}`;
}

// Populate Cash Form
function populateCashForm(record) {
    document.getElementById('bills_1000').value = record.bills_1000 || '';
    document.getElementById('bills_500').value = record.bills_500 || '';
    document.getElementById('bills_100').value = record.bills_100 || '';
    document.getElementById('bills_50').value = record.bills_50 || '';
    document.getElementById('bills_20').value = record.bills_20 || '';
    document.getElementById('coins_10').value = record.coins_10 || '';
    document.getElementById('coins_5').value = record.coins_5 || '';
    document.getElementById('coins_2').value = record.coins_2 || '';
    document.getElementById('coins_1').value = record.coins_1 || '';

    // For bank transfer, we might want to keep it as is or also clear if 0
    // Usually bank transfer is less prone to this rapid-entry error, but for consistency:
    const transferAmount = record.bank_transfer_amount || 0;
    document.getElementById('bankTransfer').value = transferAmount > 0 ? NumberUtils.formatNumber(transferAmount, 0) : '';
}

// Reset Cash Form
function resetCashForm() {
    const ids = [
        'bills_1000', 'bills_500', 'bills_100', 'bills_50', 'bills_20',
        'coins_10', 'coins_5', 'coins_2', 'coins_1', 'bankTransfer'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    calculateCashTotal();
}

// Update Value Display (Cash Counter)
function updateValueDisplay(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = '฿' + NumberUtils.formatNumber(value, 0);
}

// Calculate Cash Total
function calculateCashTotal() {
    const b1000 = parseInt(document.getElementById('bills_1000').value) || 0;
    const b500 = parseInt(document.getElementById('bills_500').value) || 0;
    const b100 = parseInt(document.getElementById('bills_100').value) || 0;
    const b50 = parseInt(document.getElementById('bills_50').value) || 0;
    const b20 = parseInt(document.getElementById('bills_20').value) || 0;
    const c10 = parseInt(document.getElementById('coins_10').value) || 0;
    const c5 = parseInt(document.getElementById('coins_5').value) || 0;
    const c2 = parseInt(document.getElementById('coins_2').value) || 0;
    const c1 = parseInt(document.getElementById('coins_1').value) || 0;

    updateValueDisplay('value_1000', b1000 * 1000);
    updateValueDisplay('value_500', b500 * 500);
    updateValueDisplay('value_100', b100 * 100);
    updateValueDisplay('value_50', b50 * 50);
    updateValueDisplay('value_20', b20 * 20);
    updateValueDisplay('value_10', c10 * 10);
    updateValueDisplay('value_5', c5 * 5);
    updateValueDisplay('value_2', c2 * 2);
    updateValueDisplay('value_1', c1 * 1);

    const total = (b1000 * 1000) + (b500 * 500) + (b100 * 100) +
        (b50 * 50) + (b20 * 20) + (c10 * 10) +
        (c5 * 5) + (c2 * 2) + (c1 * 1);

    document.getElementById('totalCountedCash').textContent = '฿' + NumberUtils.formatNumber(total, 0);

    // Net Cash Sales = Total - Change(1000)
    const netCashSales = total - 1000;
    document.getElementById('netCashSales').textContent = '฿' + NumberUtils.formatNumber(netCashSales, 0);

    updateReconciliation(); // Trigger full update
}

// Update Reconciliation
async function updateReconciliation() {
    // 1. Gather Revenue
    const totalCountedCash = parseFloat(document.getElementById('totalCountedCash').textContent.replace(/[฿,]/g, '')) || 0;
    const netCashSales = totalCountedCash - 1000; // Deduct change
    const bankTransfer = parseFloat(document.getElementById('bankTransfer').value.replace(/,/g, '')) || 0;

    // IMPORTANT: Only count CASH payments in reconciliation
    // Transfer payments go directly to bank account, not counted here
    const creditPaymentsCash = creditPayments
        .filter(p => p.is_confirmed && p.payment_method === 'cash')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const totalRevenue = netCashSales + bankTransfer + creditPaymentsCash;

    // 2. Gather Expectations
    const nozzleSales = window.currentMetrics?.total_sales || 0;
    const totalCreditSales = window.totalCreditSales || 0; // Sold on credit today
    const personalFuelTotal = (personalFuelUsage || []).reduce((sum, f) => sum + parseFloat(f.total_value), 0);

    // Expected Cash = Nozzle Sales - Credit Sales - Personal Use
    const expectedSales = nozzleSales - totalCreditSales - personalFuelTotal;

    // 3. Difference
    const difference = totalRevenue - expectedSales;

    // 4. Update UI
    setText('reconTotalRevenue', totalRevenue);
    setText('reconCashSales', netCashSales);
    setText('reconBankTransfer', bankTransfer);
    setText('reconCreditPayments', creditPaymentsCash); // Only CASH payments

    setText('reconNozzleSales', nozzleSales);
    setText('reconCreditSales', totalCreditSales);
    setText('reconPersonalFuel', personalFuelTotal);
    setText('reconExpectedSales', expectedSales);

    const diffEl = document.getElementById('reconDifference');
    if (diffEl) diffEl.textContent = '฿' + NumberUtils.formatNumber(Math.abs(difference), 0);

    const labelEl = document.getElementById('reconDifferenceLabel');
    if (labelEl) {
        if (difference > 0) {
            labelEl.textContent = 'เงินเกิน';
            labelEl.style.color = '#10b981';
            if (diffEl) diffEl.style.color = '#10b981';
        } else if (difference < 0) {
            labelEl.textContent = 'เงินขาด';
            labelEl.style.color = '#ef4444';
            if (diffEl) diffEl.style.color = '#ef4444';
        } else {
            labelEl.textContent = 'สมดุล';
            labelEl.style.color = '#64748b';
            if (diffEl) diffEl.style.color = '#64748b';
        }
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = '฿' + NumberUtils.formatNumber(value, 0);
}

// Render Personal Fuel List
function renderPersonalFuelList() {
    const div = document.getElementById('personalFuelList');
    if (!div) return;

    if (personalFuelUsage.length === 0) {
        div.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center;">ไม่มีรายการใช้วันนี้</p>';
        return;
    }

    div.innerHTML = personalFuelUsage.map(f => `
        <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.1);">
            <div>
                <span style="font-weight: bold; color: #00A8E8;">${f.fuel_type.toUpperCase()}</span>
                <span style="margin-left: 8px; font-size: 0.9rem;">${f.liters} ลิตร</span>
                <div style="font-size: 0.85rem; color: var(--text-muted);">฿${NumberUtils.formatNumber(f.total_value, 0)}</div>
            </div>
            <button class="btn-icon delete" onclick="deletePersonalFuel('${f.id}')" style="color: #ef4444;">🗑️</button>
        </div>
    `).join('');
}

// Render Credit Payments List
function renderCreditPaymentsList() {
    const container = document.getElementById('creditPaymentsList');
    if (!container) return;

    if (creditPayments.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #94a3b8;">ไม่มีรายการรับชำระวันนี้</div>';
        return;
    }

    container.innerHTML = creditPayments.map(p => {
        const method = p.payment_method === 'transfer' ? '📲 โอน' : '💵 สด';
        const isConfirmed = p.is_confirmed;

        return `
            <div class="credit-payment-item" style="background: ${isConfirmed ? '#f0fdf4' : '#fef3c7'}; border: 1px solid ${isConfirmed ? '#10b981' : '#f59e0b'}; border-left: 3px solid ${isConfirmed ? '#10b981' : '#f59e0b'};">
                <div style="flex: 1;">
                    <div class="credit-payment-customer">${p.customer?.name || 'ลูกค้า'}</div>
                    <div style="font-size: 0.875rem; color: #64748b; margin-top: 0.25rem;">${method} - ${p.note || '-'}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="credit-payment-amount">+฿${NumberUtils.formatNumber(p.amount, 0)}</div>
                    ${!isConfirmed ? `
                        <button onclick="confirmCreditPayment('${p.id}')" 
                                style="background: #10b981; color: white; padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; font-size: 0.875rem; transition: all 0.2s;"
                                onmouseover="this.style.background='#059669'" 
                                onmouseout="this.style.background='#10b981'">
                            ✓ ยืนยัน
                        </button>
                    ` : `
                        <span style="background: #10b981; color: white; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; font-size: 0.875rem;">
                            ✓ ยืนยันแล้ว
                        </span>
                    `}
                    <button onclick="deleteCreditPayment('${p.id}', '${p.customer_id}', '${p.invoice_id || ''}')" 
                            style="background: #ef4444; color: white; padding: 0.5rem 0.75rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; font-size: 0.875rem; transition: all 0.2s;"
                            onmouseover="this.style.background='#dc2626'" 
                            onmouseout="this.style.background='#ef4444'">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Confirm Credit Payment
window.confirmCreditPayment = async function (paymentId) {
    let loadingShown = false;
    try {
        Loading.show();
        loadingShown = true;

        console.log('Confirming payment:', paymentId);

        // Update payment status to confirmed
        const result = await API.put(`/api/credit-payment/${paymentId}/confirm`, {
            is_confirmed: true
        });

        console.log('Confirm result:', result);

        Toast.success('ยืนยันการชำระเงินสำเร็จ');

        // Reload data to update reconciliation (skip loading since we're already showing it)
        await loadData(true, true);

    } catch (error) {
        console.error('Confirm payment error:', error);
        Toast.error('ยืนยันไม่สำเร็จ: ' + (error.message || 'เกิดข้อผิดพลาด'));
    } finally {
        if (loadingShown) {
            Loading.hide();
            console.log('Loading hidden');
        }
    }
}

// Delete Credit Payment - Revert to pending bill
window.deleteCreditPayment = async function (paymentId, customerId, invoiceId) {
    // 1. Check for conflicting active invoices
    if (customerId && invoiceId) {
        try {
            Loading.show();
            // Fetch active invoices for this customer
            const result = await API.get('/api/invoices', { customer_id: customerId, status: 'active' });
            Loading.hide();

            const activeInvoices = result.invoices || [];
            // Filter out the invoice related to this payment (if it happens to be active/partial)
            // We want to see if there is a DIFFERENT active invoice (e.g. INV-003 while we revert INV-001)
            const otherActive = activeInvoices.filter(inv => inv.id != invoiceId);

            if (otherActive.length > 0) {
                const conflictInv = otherActive[0];
                Modal.confirm(
                    'ไม่สามารถยกเลิกการชำระเงินได้',
                    `<div style="text-align: left;">
                        ลูกค้ารายนี้มีใบวางบิล <strong>${conflictInv.invoice_number}</strong> ที่ค้างชำระอยู่ในระบบ<br><br>
                        ระบบไม่อนุญาตให้มีใบวางบิลค้างชำระพร้อมกัน 2 ใบ<br>
                        <hr style="margin: 1rem 0; border: 0; border-top: 1px solid #eee;">
                        <strong>คำแนะนำ:</strong><br>
                        กรุณาไปที่หน้าลูกค้าและ <strong>"ยกเลิกใบวางบิล ${conflictInv.invoice_number}"</strong> ก่อน<br>
                        จึงจะสามารถย้อนกลับรายการนี้ได้
                    </div>`,
                    () => { }
                );
                return; // BLOCK DELETION
            }

        } catch (error) {
            Loading.hide();
            console.error('Check invoice conflict error:', error);
            // If check fails, allows proceed but warn? NO, block safely.
            Toast.error('ตรวจสอบข้อมูลใบวางบิลล้มเหลว กรุณาลองใหม่');
            return;
        }
    }

    // 2. Proceed with Deletion Confirmation
    Modal.confirm(
        'ลบรายการชำระหนี้',
        'ต้องการลบรายการนี้ใช่หรือไม่? ยอดเงินจะถูกคืนกลับไปที่ใบวางบิลรอการชำระ',
        async () => {
            let loadingShown = false;
            try {
                Loading.show();
                loadingShown = true;

                console.log('Deleting payment:', paymentId);

                // Delete payment - backend will handle reverting the bill status
                const result = await API.delete(`/api/credit-payment/${paymentId}`);

                console.log('Delete result:', result);

                Toast.success('ลบรายการสำเร็จ ยอดเงินคืนกลับไปที่ใบวางบิล');

                // Reload data (skip loading since we're already showing it)
                await loadData(true, true);

            } catch (error) {
                console.error('Delete payment error:', error);
                Toast.error('ลบไม่สำเร็จ: ' + (error.message || 'เกิดข้อผิดพลาด'));
            } finally {
                if (loadingShown) {
                    Loading.hide();
                    console.log('Loading hidden');
                }
            }
        }
    );
}

// ==========================================
// ACTION HANDLERS
// ==========================================

// Save Cash Record
// Save Cash Record
window.saveCashRecord = async function () {
    let loadingShown = false;
    try {
        Loading.show();
        loadingShown = true;

        const data = {
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
            bank_transfer_amount: parseFloat(document.getElementById('bankTransfer').value.replace(/,/g, '')) || 0,
            note: '' // Optional
        };

        const result = await API.post('/api/cash', data);

        console.log('Save result:', result);
        Toast.success('บันทึกข้อมูลเรียบร้อยแล้ว');

        // Reload to update reconciliation
        await loadData(true, false);

    } catch (error) {
        console.error('Save error:', error);
        Toast.error('บันทึกไม่สำเร็จ: ' + error.message);
    } finally {
        if (loadingShown) {
            Loading.hide();
        }
    }
}

// Save Personal Fuel
window.savePersonalFuel = async function () {
    let loadingShown = false;
    try {
        // Find which fuel type has value
        const fuels = ['e91', 'e95', 'b7'];
        let selectedFuel = null;
        let amount = 0;

        for (const f of fuels) {
            const val = parseFloat(document.getElementById(`fuel${f.toUpperCase()}`).value);
            if (val > 0) {
                selectedFuel = f;
                amount = val;
                break;
            }
        }

        if (!selectedFuel) {
            Toast.warning('กรุณาระบุยอดเงินสำหรับน้ำมันที่ต้องการบันทึก');
            return;
        }

        Loading.show();
        loadingShown = true;

        const result = await API.post('/api/personal-fuel', {
            date: currentDate,
            fuel_type: selectedFuel,
            amount: amount,
            note: 'เติมเอง'
        });

        console.log('Save fuel result:', result);
        Toast.success('บันทึกการเติมน้ำมันเรียบร้อย');

        // Clear inputs
        document.getElementById(`fuel${selectedFuel.toUpperCase()}`).value = '';

        // Reload
        await loadData(true, true);

    } catch (error) {
        console.error('Save fuel error:', error);
        Toast.error('บันทึกไม่สำเร็จ: ' + error.message);
    } finally {
        if (loadingShown) Loading.hide();
    }
}

// Delete Personal Fuel
window.deletePersonalFuel = async function (id) {
    Modal.confirm('ลบรายการ', 'ต้องการลบรายการนี้ใช่หรือไม่?', async () => {
        try {
            Loading.show();
            await API.delete(`/api/personal-fuel/${id}`);
            Toast.success('ลบรายการเรียบร้อย');
            await loadData(true, true);
        } catch (error) {
            console.error('Delete fuel error:', error);
            Toast.error('ลบไม่สำเร็จ: ' + error.message);
        } finally {
            Loading.hide();
        }
    });
}

