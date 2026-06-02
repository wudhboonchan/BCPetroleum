
// Accounting Management JavaScript
Auth.requireAuth();

// Global variables
let currentDate = new Date().toISOString().split('T')[0];
let customers = [];
let transactions = [];
let balances = {
    cash_balance: 0,
    profit_balance: 0,
    bank_balance: 0,
    total_receivables: 0,
    total_payables: 0
};

// Initialize
function init() {
    loadUserInfo();
    updateDate();
    setupDatePicker();
    loadCustomers();
    loadData();
    setupModalEnterKeys();
}

// Setup Enter key to submit modals
function setupModalEnterKeys() {
    const modalActions = {
        'profitTransferModal': saveProfitTransfer,
        'fuelInvestmentModal': saveFuelInvestment,
        'depositBankModal': saveDeposit,
        'electricityModal': saveElectricity,
        'waterPurchaseModal': saveWaterPurchase,
        'debtPaymentModal': saveDebtPayment,
        'otherModal': saveOther
    };

    Object.entries(modalActions).forEach(([modalId, saveFunction]) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    saveFunction();
                }
            });
        }
    });
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

// Load customers for dropdown
async function loadCustomers() {
    try {
        const result = await API.get('/api/customer');
        customers = result.data || [];

        const select = document.getElementById('paymentCustomer');
        select.innerHTML = '<option value="">-- เลือกลูกค้า --</option>';

        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = `${customer.name} (${customer.code})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Load customers error:', error);
    }
}

// Load all data for selected date
async function loadData() {
    try {
        Loading.show();

        // Single optimized API call for transactions and balances
        const result = await API.get(`/api/accounting/summary/${currentDate}`);

        transactions = result.transactions || [];
        balances = result.balances || {
            cash_balance: 0,
            profit_balance: 0,
            bank_balance: 0,
            total_receivables: 0,
            total_payables: 0
        };

        updateBalanceDisplay();
        renderTransactionsList();

        Loading.hide();
    } catch (error) {
        Loading.hide();
        console.error('Load data error:', error);
        Toast.error('ไม่สามารถโหลดข้อมูลได้');
    }
}

// Update balance display
function updateBalanceDisplay() {
    document.getElementById('cashBalance').textContent = '฿' + NumberUtils.formatNumber(balances.cash_balance);
    document.getElementById('profitBalance').textContent = '฿' + NumberUtils.formatNumber(balances.profit_balance);
    document.getElementById('bankBalance').textContent = '฿' + NumberUtils.formatNumber(balances.bank_balance);
    document.getElementById('receivablesBalance').textContent = '฿' + NumberUtils.formatNumber(balances.total_receivables);
    document.getElementById('payablesBalance').textContent = '฿' + NumberUtils.formatNumber(balances.total_payables);
}

// Render transactions list
function renderTransactionsList() {
    const container = document.getElementById('transactionsList');
    if (!container) return;

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">ไม่มีรายการธุรกรรม</p>';
        return;
    }

    // Check if transaction is synced from cash management or daily records
    const isSyncedTransaction = (t) => {
        return (t.source === 'cash_management' && ['cash_sales', 'transfer_sales', 'customer_payment'].includes(t.transaction_type)) ||
            (t.source === 'credit_payment_confirm') ||
            (t.source === 'daily_profit_transfer');
    };

    // Helper to determine sort priority for synced transactions
    const getSortPriority = (t) => {
        // Only prioritize synced transactions
        if (!isSyncedTransaction(t)) return 99;

        switch (t.transaction_type) {
            case 'cash_sales': return 1;
            case 'transfer_sales': return 2;
            case 'customer_payment': return 3;
            default:
                // For daily_profit_transfer, show after transfer_sales
                if (t.source === 'daily_profit_transfer') return 2.5;
                return 99;
        }
    };

    // Sort transactions: Synced (ordered) first, then by created_at ascending (Oldest first -> Newest last)
    const sortedTransactions = [...transactions].sort((a, b) => {
        const priorityA = getSortPriority(a);
        const priorityB = getSortPriority(b);

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        // If priorities are equal (e.g. both non-synced), sort by time ascending
        // Recent items appear at the bottom
        return new Date(a.created_at) - new Date(b.created_at);
    });

    // Get Thai date for header
    const thaiDate = DateUtils.getThaiDate(currentDate);

    // Update main header and remove sub-header
    const headerTitle = document.getElementById('transactionsTitle');
    if (headerTitle) {
        headerTitle.textContent = `รายการธุรกรรมวันนี้: ${thaiDate}`;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; background: white;">
                <thead>
                    <tr style="background: #F3F4F6;">
                        <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #E5E7EB;">รายละเอียด</th>
                        <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #E5E7EB;">บัญชี</th>
                        <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #E5E7EB;">เงินเข้า</th>
                        <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #E5E7EB;">เงินออก</th>
                        <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid #E5E7EB;">จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedTransactions.map(t => {
        const amount = parseFloat(t.amount);
        const debit = amount < 0 ? Math.abs(amount) : 0;
        const credit = amount > 0 ? amount : 0;
        const typeLabel = getTransactionTypeLabel(t.transaction_type);
        const accountLabel = getAccountTypeLabel(t.account_type);
        const isSynced = isSyncedTransaction(t);

        // Define Tooltip Message based on transaction source
        let tooltipMessage = '';
        if (t.source === 'cash_management') {
            // Cash or Transfer sales
            tooltipMessage = 'แก้ไขยอดได้ที่หน้าเงินสด';
        } else if (t.source === 'credit_payment_confirm') {
            // Customer payment from credit
            tooltipMessage = 'ยกเลิกได้ที่หน้าเงินสด (รับชำระหนี้ลูกค้าเงินเชื่อ)';
        } else if (t.source === 'daily_profit_transfer') {
            // Auto profit transfer
            tooltipMessage = 'แก้ไขยอดที่หน้าจัดการรายวัน (คำนวณอัตโนมัติจากกำไร)';
        } else {
            // Manual entry
            tooltipMessage = 'รายการที่เพิ่มเองในหน้าบัญชี';
        }

        // Check for redundant customer name display
        // If type is customer_payment (debt payment), the description usually contains "รับชำระเงินจาก CustomerName"
        // Or if description specifically includes the customer name
        let showCustomerName = true;
        if (t.customer && t.description && t.description.includes(t.customer.name)) {
            showCustomerName = false;
        }

        return `
                            <tr style="border-bottom: 1px solid #E5E7EB; ${isSynced ? 'background-color: #F9FAFB;' : ''}">
                                <td style="padding: 0.75rem;">
                                    <div style="font-weight: 500;">${typeLabel} ${isSynced ? '🔒' : ''}</div>
                                    <div style="font-size: 0.85rem; color: #666; margin-top: 0.25rem;">${capitalizeFuelType(t.description) || '-'}</div>
                                    ${t.customer && showCustomerName ? `<div style="font-size: 0.85rem; color: #666;">• ${t.customer.name}</div>` : ''}
                                </td>
                                <td style="padding: 0.75rem;">
                                    <span style="font-size: 0.85rem; background: #F3F4F6; padding: 0.25rem 0.5rem; border-radius: 0.25rem;">${accountLabel}</span>
                                </td>
                                <td style="padding: 0.75rem; text-align: right; color: #10B981; font-weight: 500;">
                                    ${credit > 0 ? '฿' + NumberUtils.formatNumber(credit) : '-'}
                                </td>
                                <td style="padding: 0.75rem; text-align: right; color: #EF4444; font-weight: 500;">
                                    ${debit > 0 ? '฿' + NumberUtils.formatNumber(debit) : '-'}
                                </td>
                                <td style="padding: 0.75rem; text-align: center;">
                                    ${isSynced ? `
                                        <span data-bs-toggle="tooltip" 
                                              data-bs-placement="top" 
                                              title="${tooltipMessage}" 
                                              style="font-size: 1.2rem; cursor: help; color: #6B7280;">
                                            ℹ️
                                        </span>
                                    ` : `
                                        <button class="btn-delete" onclick="deleteTransaction(${t.id})" style="font-size: 0.85rem;">ลบ</button>
                                    `}
                                </td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Initialize Bootstrap Tooltips with custom delay
    try {
        const tooltipTriggerList = [].slice.call(container.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl, {
                delay: { show: 200, hide: 1000 }, // Show quickly, hide after 1.5 seconds
                trigger: 'hover focus' // Show on both hover and focus
            });
        });
    } catch (e) {
        console.warn('Bootstrap tooltip initialization failed:', e);
    }
}

// Helper function to capitalize fuel types in descriptions
function capitalizeFuelType(description) {
    if (!description) return description;

    // Replace lowercase fuel types with uppercase
    return description
        .replace(/\be91\b/gi, 'E91')
        .replace(/\be95\b/gi, 'E95')
        .replace(/\bb7\b/gi, 'B7');
}

// Get transaction type label
function getTransactionTypeLabel(type) {
    const labels = {
        'cash_sales': '💵 ขายเงินสด',
        'transfer_sales': '🏦 ขายเงินโอน',
        'customer_payment': '💳 รับชำระเงิน',
        'deposit_to_bank': '💸 ฝากธนาคาร',
        'electricity': '💡 ค่าไฟฟ้า',
        'profit_transfer': '💎 หักเก็บกำไร',
        'fuel_investment': '⛽ ลงทุนน้ำมัน',
        'fuel_payment': '⛽ ลงทุนน้ำมัน',
        'water_investment': '💧 น้ำดื่มสมนาคุณ',
        'debt_payment': '💸 ชำระหนี้',
        'loan_received': '💰 เงินกู้ยืม',
        'other_income': '📈 รายรับอื่นๆ',
        'other_expense': '📉 รายจ่ายอื่นๆ'
    };
    return labels[type] || type;
}

// Get account type label
function getAccountTypeLabel(type) {
    const labels = {
        'cash': 'เงินสดหมุนเวียน',
        'profit': 'เงินกำไร',
        'bank': 'บัญชีธนาคาร',
        'receivables': 'บัญชีลูกหนี้',
        'payables': 'บัญชีเจ้าหนี้'
    };
    return labels[type] || type;
}

// Modal functions
function openModal(modalName) {
    document.getElementById(modalName + 'Modal').style.display = 'block';
}

function closeModal(modalName) {
    document.getElementById(modalName + 'Modal').style.display = 'none';
}

// Toggle fuel payment method visibility
function toggleFuelPaymentMethod() {
    const status = document.getElementById('fuelPaymentStatus').value;
    const methodGroup = document.getElementById('fuelPaymentMethodGroup');
    methodGroup.style.display = status === 'paid' ? 'block' : 'none';
}

// ============================================================================
// SAVE FUNCTIONS
// ============================================================================

// Save cash sales


// Save transfer sales


// Save customer payment


// Save fuel investment
async function saveFuelInvestment() {
    try {
        const fuelType = document.getElementById('fuelType').value;
        const liters = parseFloat(document.getElementById('fuelLiters').value);
        const totalAmount = parseFloat(document.getElementById('fuelTotalAmount').value);
        const paymentStatus = document.getElementById('fuelPaymentStatus').value;
        const paymentMethod = document.getElementById('fuelPaymentMethod').value;

        if (!liters || liters <= 0) {
            Toast.warning('กรุณากรอกจำนวนลิตร');
            return;
        }

        if (!totalAmount || totalAmount <= 0) {
            Toast.warning('กรุณากรอกจำนวนเงินรวม');
            return;
        }

        // Calculate cost per liter
        const costPerLiter = totalAmount / liters;

        Loading.show();

        await API.post('/api/accounting/fuel-investment', {
            date: currentDate,
            fuel_type: fuelType,
            liters: liters,
            cost_per_liter: costPerLiter,
            payment_status: paymentStatus,
            payment_method: paymentStatus === 'paid' ? paymentMethod : null,
            note: ''
        });

        Toast.success('บันทึกการลงทุนน้ำมันสำเร็จ');
        closeModal('fuelInvestment');
        document.getElementById('fuelLiters').value = '';
        document.getElementById('fuelTotalAmount').value = '';
        document.getElementById('fuelPaymentStatus').value = 'unpaid';
        toggleFuelPaymentMethod();
        loadData();
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Save fuel investment error:', error);
        Toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// Save deposit to bank
async function saveDeposit() {
    try {
        const amount = parseFloat(document.getElementById('depositAmount').value);
        const note = document.getElementById('depositNote').value;

        if (!amount || amount <= 0) {
            Toast.warning('กรุณากรอกจำนวนเงิน');
            return;
        }

        Loading.show();

        // Subtract from cash
        await API.post('/api/accounting/transaction', {
            date: currentDate,
            transaction_type: 'deposit_to_bank',
            category: 'Transfer',
            description: note || 'ฝากเงินธนาคาร',
            amount: -amount,
            payment_method: null,
            account_type: 'cash'
        });

        // Add to bank
        await API.post('/api/accounting/transaction', {
            date: currentDate,
            transaction_type: 'deposit_to_bank',
            category: 'Transfer',
            description: 'รับฝากจากเงินสดหมุนเวียน' + (note ? ` (${note})` : ''),
            amount: amount,
            payment_method: null,
            account_type: 'bank'
        });

        Toast.success('บันทึกการฝากเงินสำเร็จ');
        closeModal('depositBank');
        document.getElementById('depositAmount').value = '';
        document.getElementById('depositNote').value = '';
        loadData();
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Save deposit error:', error);
        Toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// Save profit transfer
async function saveProfitTransfer() {
    try {
        const amount = parseFloat(document.getElementById('profitTransferAmount').value);
        const note = document.getElementById('profitTransferNote').value;

        if (!amount || amount <= 0) {
            Toast.warning('กรุณากรอกจำนวนเงิน');
            return;
        }

        Loading.show();

        // Subtract from cash
        await API.post('/api/accounting/transaction', {
            date: currentDate,
            transaction_type: 'profit_transfer',
            category: 'Profit Transfer',
            description: 'หักเก็บกำไร' + (note ? ` (${note})` : ''),
            amount: -amount,
            payment_method: null,
            account_type: 'cash'
        });

        // Add to profit
        await API.post('/api/accounting/transaction', {
            date: currentDate,
            transaction_type: 'profit_transfer',
            category: 'Profit Transfer',
            description: 'เก็บกำไรรายวันจากเงินสด' + (note ? ` (${note})` : ''),
            amount: amount,
            payment_method: null,
            account_type: 'profit'
        });

        Toast.success('บันทึกการหักเก็บกำไรสำเร็จ');
        closeModal('profitTransfer');
        document.getElementById('profitTransferAmount').value = '';
        document.getElementById('profitTransferNote').value = '';
        loadData();
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Save profit transfer error:', error);
        Toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// Save electricity
async function saveElectricity() {
    try {
        const month = document.getElementById('electricityMonth').value;
        const amount = parseFloat(document.getElementById('electricityAmount').value);

        if (!amount || amount <= 0) {
            Toast.warning('กรุณากรอกจำนวนเงิน');
            return;
        }

        Loading.show();

        await API.post('/api/accounting/transaction', {
            date: currentDate,
            transaction_type: 'electricity',
            category: 'Utilities',
            description: `ค่าไฟฟ้า (${month})`,
            amount: -amount,
            payment_method: 'cash',
            account_type: 'cash'
        });

        Toast.success('บันทึกค่าไฟฟ้าสำเร็จ');
        closeModal('electricity');
        document.getElementById('electricityAmount').value = '';
        loadData();
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Save electricity error:', error);
        Toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// Save water purchase
async function saveWaterPurchase() {
    try {
        const packs = parseInt(document.getElementById('waterPacks').value);
        const costPerPack = parseFloat(document.getElementById('waterCostPerPack').value);

        if (!packs || packs <= 0) {
            Toast.warning('กรุณากรอกจำนวนแพค');
            return;
        }

        Loading.show();

        await API.post('/api/accounting/water-investment', {
            date: currentDate,
            packs: packs,
            cost_per_pack: costPerPack,
            note: ''
        });

        Toast.success('บันทึกน้ำดื่มสมนาคุณสำเร็จ');
        closeModal('waterPurchase');
        document.getElementById('waterPacks').value = '';
        loadData();
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Save water purchase error:', error);
        Toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// Toggle other type fields (income/expense vs loan)
function toggleOtherType() {
    const type = document.getElementById('otherType').value;
    const otherAccountGroup = document.getElementById('otherAccountGroup');
    const loanAccountGroup = document.getElementById('loanAccountGroup');
    const loanNoteGroup = document.getElementById('loanNoteGroup');
    const descLabel = document.getElementById('otherDescriptionLabel');

    if (type === 'loan') {
        otherAccountGroup.style.display = 'none';
        loanAccountGroup.style.display = 'block';
        loanNoteGroup.style.display = 'block';
        descLabel.textContent = 'รายละเอียดการกู้ยืม';
        document.getElementById('otherDescription').placeholder = 'เช่น ยืมเงินจากนาย ก., ยืมชั่วคราวจากพี่...';
    } else {
        otherAccountGroup.style.display = 'block';
        loanAccountGroup.style.display = 'none';
        loanNoteGroup.style.display = 'none';
        descLabel.textContent = 'รายละเอียด';
        document.getElementById('otherDescription').placeholder = 'ระบุรายละเอียด';
    }
}

// Save other transaction
async function saveOther() {
    try {
        const type = document.getElementById('otherType').value;
        const description = document.getElementById('otherDescription').value;
        const amount = parseFloat(document.getElementById('otherAmount').value);

        if (!description) {
            Toast.warning('กรุณากรอกรายละเอียด');
            return;
        }

        if (!amount || amount <= 0) {
            Toast.warning('กรุณากรอกจำนวนเงิน');
            return;
        }

        Loading.show();

        if (type === 'loan') {
            // Handle loan type - call dedicated loan API
            const loanAccount = document.getElementById('loanAccount').value;
            const loanNote = document.getElementById('loanNote').value;

            await API.post('/api/accounting/loan', {
                date: currentDate,
                description: description,
                amount: amount,
                account_type: loanAccount,
                note: loanNote
            });

            Toast.success('บันทึกเงินกู้ยืมสำเร็จ');
            closeModal('other');
            document.getElementById('otherDescription').value = '';
            document.getElementById('otherAmount').value = '';
            document.getElementById('loanNote').value = '';
            document.getElementById('otherType').value = 'income';
            toggleOtherType();
            loadData();
            Loading.hide();
        } else {
            // Handle income/expense type - existing logic
            const account = document.getElementById('otherAccount').value;
            const finalAmount = type === 'income' ? amount : -amount;

            await API.post('/api/accounting/transaction', {
                date: currentDate,
                transaction_type: type === 'income' ? 'other_income' : 'other_expense',
                category: 'Other',
                description: description,
                amount: finalAmount,
                payment_method: null,
                account_type: account
            });

            Toast.success('บันทึกรายการสำเร็จ');
            closeModal('other');
            document.getElementById('otherDescription').value = '';
            document.getElementById('otherAmount').value = '';
            loadData();
            Loading.hide();
        }

    } catch (error) {
        Loading.hide();
        console.error('Save other transaction error:', error);
        Toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// Show account details
async function showAccountDetails(accountType) {
    try {
        Loading.show();

        const result = await API.get(`/api/accounting/account-details/${accountType}/${currentDate}`);
        const transactions = result.transactions || [];

        const accountTitles = {
            'cash': '💵 เงินสดหมุนเวียน',
            'profit': '💰 เงินกำไร',
            'bank': '🏦 บัญชีธนาคาร'
        };

        document.getElementById('accountDetailsTitle').textContent = accountTitles[accountType];

        const tbody = document.getElementById('accountDetailsBody');

        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: #999;">ไม่มีรายการธุรกรรม</td></tr>';
        } else {
            tbody.innerHTML = transactions.map(t => {
                const amount = parseFloat(t.amount);
                const debit = amount < 0 ? Math.abs(amount) : 0;
                const credit = amount > 0 ? amount : 0;
                const date = new Date(t.date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                return `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                        <td style="padding: 0.75rem;">${date}</td>
                        <td style="padding: 0.75rem;">${capitalizeFuelType(t.description) || '-'}</td>
                        <td style="padding: 0.75rem; text-align: right; color: #10B981;">${credit > 0 ? '฿' + NumberUtils.formatNumber(credit) : '-'}</td>
                        <td style="padding: 0.75rem; text-align: right; color: #EF4444;">${debit > 0 ? '฿' + NumberUtils.formatNumber(debit) : '-'}</td>
                        <td style="padding: 0.75rem; text-align: right; font-weight: bold;">฿${NumberUtils.formatNumber(t.running_balance)}</td>
                    </tr>
                `;
            }).join('');
        }

        openModal('accountDetails');
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Show account details error:', error);
        Toast.error('ไม่สามารถโหลดรายละเอียดได้');
    }
}

// Show receivables details
async function showReceivablesDetails() {
    try {
        Loading.show();

        const result = await API.get(`/api/accounting/receivables/${currentDate}`);
        const receivables = result.receivables || {};

        const fuelReceivables = receivables.fuel || [];
        const waterReceivables = receivables.water || [];
        const loanReceivables = receivables.loan || [];

        document.getElementById('debtDetailsTitle').textContent = '📥 เป็นลูกหนี้';

        const tbody = document.getElementById('debtDetailsBody');

        if (fuelReceivables.length === 0 && waterReceivables.length === 0 && loanReceivables.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: #999;">ไม่มีรายการ</td></tr>';
        } else {
            let html = '';

            // Fuel receivables
            fuelReceivables.forEach(f => {
                const date = new Date(f.date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const remaining = parseFloat(f.remaining_amount);

                html += `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                        <td style="padding: 0.75rem;">${date}</td>
                        <td style="padding: 0.75rem;">⛽ ลงทุนน้ำมัน ${f.fuel_type.toUpperCase()} ${f.liters} ลิตร @ ฿${NumberUtils.formatCurrency(f.cost_per_liter)}</td>
                        <td style="padding: 0.75rem; text-align: right; color: #10B981; font-weight: 500;">฿${NumberUtils.formatCurrency(remaining)}</td>
                        <td style="padding: 0.75rem; text-align: right;">
                            <span style="background: #FEF3C7; color: #92400E; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.85rem;">
                                ${f.payment_status === 'unpaid' ? 'ยังไม่ชำระ' : 'ชำระบางส่วน'}
                            </span>
                        </td>
                    </tr>
                `;
            });

            // Water receivables
            waterReceivables.forEach(r => {
                const date = new Date(r.date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const remaining = parseFloat(r.remaining_amount);

                html += `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                        <td style="padding: 0.75rem;">${date}</td>
                        <td style="padding: 0.75rem;">💧 ลงทุนน้ำดื่มสมนาคุณ ${r.packs} แพ็ค @ ฿${NumberUtils.formatCurrency(r.cost_per_pack)}</td>
                        <td style="padding: 0.75rem; text-align: right; color: #10B981; font-weight: 500;">฿${NumberUtils.formatCurrency(remaining)}</td>
                        <td style="padding: 0.75rem; text-align: right;">
                            <span style="background: #FEF3C7; color: #92400E; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.85rem;">
                                ${r.payment_status === 'unpaid' ? 'ยังไม่ชำระ' : 'ชำระบางส่วน'}
                            </span>
                        </td>
                    </tr>
                `;
            });

            // Loan receivables
            loanReceivables.forEach(l => {
                const date = new Date(l.date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const remaining = parseFloat(l.remaining_amount);
                const accountLabel = l.account_type === 'cash' ? 'เงินสด' : 'ธนาคาร';

                html += `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                        <td style="padding: 0.75rem;">${date}</td>
                        <td style="padding: 0.75rem;">💰 เงินกู้ยืม: ${l.description} (เข้า${accountLabel})</td>
                        <td style="padding: 0.75rem; text-align: right; color: #10B981; font-weight: 500;">฿${NumberUtils.formatCurrency(remaining)}</td>
                        <td style="padding: 0.75rem; text-align: right;">
                            <span style="background: #FEF3C7; color: #92400E; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.85rem;">
                                ${l.payment_status === 'unpaid' ? 'ยังไม่ชำระ' : 'ชำระบางส่วน'}
                            </span>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
        }
        openModal('debtDetails');
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Show receivables details error:', error);
        Toast.error('ไม่สามารถโหลดรายละเอียดได้');
    }
}

// Load debt items based on debt type
async function loadDebtItems() {
    try {
        const debtType = document.getElementById('debtType').value;
        const debtItemSelect = document.getElementById('debtItem');

        debtItemSelect.innerHTML = '<option value="">-- เลือกรายการ --</option>';

        if (!debtType) return;

        Loading.show();

        if (debtType === 'fuel') {
            const result = await API.get(`/api/accounting/fuel-investments/${currentDate}?status=unpaid`);
            const investments = result.investments || [];
            const unpaid = investments.filter(inv => inv.payment_status !== 'paid');

            unpaid.forEach(inv => {
                const option = document.createElement('option');
                option.value = inv.id;
                option.textContent = `น้ำมัน ${inv.fuel_type.toUpperCase()} ${inv.liters} ลิตร - คงเหลือ ฿${NumberUtils.formatCurrency(inv.remaining_amount)}`;
                option.dataset.remaining = inv.remaining_amount;
                debtItemSelect.appendChild(option);
            });
        } else if (debtType === 'water') {
            const result = await API.get(`/api/accounting/water-investments/${currentDate}?status=unpaid`);
            const investments = result.investments || [];
            const unpaid = investments.filter(inv => inv.payment_status !== 'paid');

            unpaid.forEach(inv => {
                const option = document.createElement('option');
                option.value = inv.id;
                option.textContent = `น้ำดื่มสมนาคุณ ${inv.packs} แพ็ค - คงเหลือ ฿${NumberUtils.formatCurrency(inv.remaining_amount)}`;
                option.dataset.remaining = inv.remaining_amount;
                debtItemSelect.appendChild(option);
            });
        } else if (debtType === 'loan') {
            const result = await API.get(`/api/accounting/loans/${currentDate}?status=unpaid`);
            const loans = result.loans || [];
            const unpaid = loans.filter(l => l.payment_status !== 'paid');

            unpaid.forEach(loan => {
                const option = document.createElement('option');
                option.value = loan.id;
                const date = new Date(loan.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                option.textContent = `💰 ${loan.description} (${date}) - คงเหลือ ฿${NumberUtils.formatCurrency(loan.remaining_amount)}`;
                option.dataset.remaining = loan.remaining_amount;
                debtItemSelect.appendChild(option);
            });
        }

        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Load debt items error:', error);
        Toast.error('ไม่สามารถโหลดรายการหนี้ได้');
    }
}

// Save debt payment
async function saveDebtPayment() {
    try {
        const debtType = document.getElementById('debtType').value;
        const debtId = document.getElementById('debtItem').value;
        const amount = parseFloat(document.getElementById('debtPaymentAmount').value);
        const paymentAccount = document.getElementById('debtPaymentAccount').value;
        const note = document.getElementById('debtPaymentNote').value;

        if (!debtType) {
            Toast.warning('กรุณาเลือกประเภทหนี้');
            return;
        }

        if (!debtId) {
            Toast.warning('กรุณาเลือกรายการหนี้');
            return;
        }

        if (!amount || amount <= 0) {
            Toast.warning('กรุณากรอกจำนวนเงิน');
            return;
        }

        // Check if amount exceeds remaining
        const selectedOption = document.querySelector(`#debtItem option[value="${debtId}"]`);
        const remaining = parseFloat(selectedOption?.dataset.remaining || 0);

        if (amount > remaining) {
            Toast.warning(`จำนวนเงินเกินยอดค้างชำระ (฿${NumberUtils.formatCurrency(remaining)})`);
            return;
        }

        Loading.show();

        await API.post('/api/accounting/pay-debt', {
            date: currentDate,
            debt_type: debtType,
            debt_id: debtId,
            payment_amount: amount,
            payment_account: paymentAccount,
            note: note
        });

        Toast.success('บันทึกการชำระหนี้สำเร็จ');
        closeModal('debtPayment');
        document.getElementById('debtType').value = '';
        document.getElementById('debtItem').innerHTML = '<option value="">-- เลือกรายการ --</option>';
        document.getElementById('debtPaymentAmount').value = '';
        document.getElementById('debtPaymentNote').value = '';
        loadData();
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Save debt payment error:', error);
        Toast.error(error.message || 'เกิดข้อผิดพลาดในการบันทึก');
    }
}

// Show payables details
async function showPayablesDetails() {
    try {
        Loading.show();

        const result = await API.get(`/api/accounting/payables/${currentDate}`);
        const payables = result.payables || {};

        const creditPayables = payables.credit || [];

        document.getElementById('debtDetailsTitle').textContent = '📤 เป็นเจ้าหนี้';

        const tbody = document.getElementById('debtDetailsBody');

        if (creditPayables.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: #999;">ไม่มีรายการ</td></tr>';
        } else {
            let html = '';

            // Backend already grouped by date and customer
            creditPayables.forEach(group => {
                const date = new Date(group.date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                html += `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                        <td style="padding: 0.75rem;">${date}</td>
                        <td style="padding: 0.75rem;">${group.customer?.name || 'Unknown'} (${group.bill_count} บิล)</td>
                        <td style="padding: 0.75rem; text-align: right; color: #EF4444; font-weight: 500;">฿${NumberUtils.formatCurrency(group.total_amount)}</td>
                        <td style="padding: 0.75rem; text-align: right;">
                            <span style="background: #FEE2E2; color: #991B1B; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.85rem;">
                                ค้างชำระ
                            </span>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
        }

        openModal('debtDetails');
        Loading.hide();

    } catch (error) {
        Loading.hide();
        console.error('Show payables details error:', error);
        Toast.error('ไม่สามารถโหลดรายละเอียดได้');
    }
}



// Close modals when clicking outside
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Delete transaction with confirmation
// Delete transaction with confirmation
async function deleteTransaction(transactionId) {
    // Use Modal.confirm for better UX
    Modal.confirm(
        'ยืนยันการลบรายการ?',
        'คุณต้องการลบรายการธุรกรรมนี้ใช่หรือไม่?<br><br><small style="color: #64748b;">• รายการที่เกี่ยวข้อง (คู่ เดบิต/เครดิต) จะถูกลบด้วย<br>• จะมีการคืนค่ายอดลงทุนหากเป็นการชำระหนี้</small>',
        async () => {
            try {
                Loading.show();

                const response = await API.delete(`/api/accounting/transactions/${transactionId}`);

                // Show success message with details
                let message = 'ลบรายการสำเร็จ';
                if (response.deleted_transactions && response.deleted_transactions.length > 1) {
                    message += `\nลบรายการที่เกี่ยวข้อง ${response.deleted_transactions.length} รายการ`;
                }
                if (response.restored_investments && response.restored_investments.length > 0) {
                    message += '\nคืนค่ายอดลงทุนเรียบร้อย';
                }

                Toast.success(message);
                loadData(); // Reload all data
                Loading.hide();

            } catch (error) {
                Loading.hide();
                console.error('Delete transaction error:', error);
                Toast.error('ไม่สามารถลบรายการได้: ' + (error.message || 'เกิดข้อผิดพลาด'));
            }
        }
    );
}

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
});

// Initialize on page load
init();
